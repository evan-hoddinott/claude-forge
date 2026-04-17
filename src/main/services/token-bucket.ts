/**
 * token-bucket.ts
 * Hard token-budget enforcement derived from today's FuelEntries.
 * No separate persistence — truth lives in the existing fuel store.
 */

import type { TokenBucketStatus, TokenBucketResult, BudgetAt80Action, BudgetAt100Action } from '../../shared/types';
import * as store from '../store';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function secondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}

export function getTokensUsedToday(): number {
  const today = todayStr();
  return store.getFuelEntries()
    .filter(e => e.timestamp.startsWith(today))
    .reduce((sum, e) => sum + (e.tokensIn ?? 0) + (e.tokensOut ?? 0), 0);
}

export function getStatus(): TokenBucketStatus {
  const budget = store.getFuelBudget();
  const capacity = budget.dailyTokenBudget ?? 100_000;
  const used = getTokensUsedToday();
  const available = Math.max(0, capacity - used);
  const percentUsed = capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0;
  return { available, capacity, used, percentUsed };
}

export function check(tokens: number): TokenBucketResult {
  const budget = store.getFuelBudget();
  const capacity = budget.dailyTokenBudget ?? 100_000;
  if (capacity <= 0) return { allowed: true, remaining: Infinity };

  const { available } = getStatus();
  if (available >= tokens) {
    return { allowed: true, remaining: available - tokens };
  }

  return { allowed: false, remaining: available, resetIn: secondsUntilMidnight() };
}

export interface BudgetEnforcement {
  shouldBlock: boolean;
  shouldDownshift: boolean;
  percentUsed: number;
  at80Action: BudgetAt80Action;
  at100Action: BudgetAt100Action;
}

export function getBudgetEnforcement(): BudgetEnforcement {
  const budget = store.getFuelBudget();
  const { percentUsed } = getStatus();

  const at80 = budget.at80Action ?? 'warn';
  const at100 = budget.at100Action ?? 'shift-to-free';

  const shouldBlock = percentUsed >= 100 && at100 === 'hard-stop';
  const shouldDownshift =
    (percentUsed >= 80 && at80 === 'downshift') ||
    (percentUsed >= 100 && at100 === 'shift-to-free');

  return { shouldBlock, shouldDownshift, percentUsed, at80Action: at80, at100Action: at100 };
}

// Monthly cap check (in USD)
export function isMonthlyCapExceeded(): boolean {
  const budget = store.getFuelBudget();
  if (!budget.monthlyCap || budget.monthlyCap <= 0) return false;

  const thisMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthCost = store.getFuelEntries()
    .filter(e => e.timestamp.startsWith(thisMonth))
    .reduce((sum, e) => sum + e.cost, 0);

  return monthCost >= budget.monthlyCap;
}
