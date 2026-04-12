import { v4 as uuidv4 } from 'uuid';
import type { FuelEntry, FuelStatus, FuelBudget, FuelProjectReport, FuelTaskType } from '../../shared/types';
import * as store from '../store';

// --- Cost per model (USD per 1M tokens) ---

interface ModelCost {
  input: number;
  output: number;
}

const MODEL_COSTS: Record<string, ModelCost> = {
  // GitHub Models (free)
  'gpt-4o':                        { input: 0, output: 0 },
  'gpt-4o-mini':                   { input: 0, output: 0 },
  'claude-3-5-sonnet':             { input: 0, output: 0 },
  'meta-llama-3.1-405b-instruct':  { input: 0, output: 0 },
  'meta-llama-3.1-70b-instruct':   { input: 0, output: 0 },
  'mistral-large':                 { input: 0, output: 0 },
  'mistral-nemo':                  { input: 0, output: 0 },

  // Anthropic (paid)
  'claude-opus-4-6':               { input: 15,  output: 75 },
  'claude-sonnet-4-6':             { input: 3,   output: 15 },
  'claude-haiku-4-5-20251001':     { input: 0.8, output: 4 },

  // OpenAI (paid)
  'gpt-4-turbo':                   { input: 10, output: 30 },
  'o1-preview':                    { input: 15, output: 60 },
  'o1-mini':                       { input: 3,  output: 12 },

  // Google (paid)
  'gemini-2.0-flash':              { input: 0.1, output: 0.4 },
  'gemini-1.5-pro':                { input: 1.25, output: 5 },
  'gemini-1.5-flash':              { input: 0.075, output: 0.3 },
};

// Reference model cost for "what would this have cost at full price"
const REFERENCE_COST: ModelCost = { input: 10, output: 30 }; // GPT-4 Turbo equivalent

export function estimateCost(model: string, tokensIn: number, tokensOut: number): { cost: number; savedAmount: number } {
  const costs = MODEL_COSTS[model] ?? { input: 2.5, output: 10 }; // default to GPT-4o pricing
  const cost = (tokensIn * costs.input + tokensOut * costs.output) / 1_000_000;

  const refCost = (tokensIn * REFERENCE_COST.input + tokensOut * REFERENCE_COST.output) / 1_000_000;
  const savedAmount = Math.max(0, refCost - cost);

  return { cost, savedAmount };
}

export function recordUsage(opts: {
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  projectId: string;
  taskType: FuelTaskType;
}): FuelEntry {
  const { cost, savedAmount } = estimateCost(opts.model, opts.tokensIn, opts.tokensOut);

  const entry: FuelEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    provider: opts.provider,
    model: opts.model,
    tokensIn: opts.tokensIn,
    tokensOut: opts.tokensOut,
    cost,
    savedAmount,
    projectId: opts.projectId,
    taskType: opts.taskType,
  };

  store.addFuelEntry(entry);
  return entry;
}

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export function getDailyUsage(): { totalCost: number; totalSaved: number; freeRequests: number } {
  const today = todayDateStr();
  const entries = store.getFuelEntries();

  let totalCost = 0;
  let totalSaved = 0;
  let freeRequests = 0;

  for (const entry of entries) {
    if (entry.timestamp.startsWith(today)) {
      totalCost += entry.cost;
      totalSaved += entry.savedAmount;
      if (entry.cost === 0) freeRequests++;
    }
  }

  return { totalCost, totalSaved, freeRequests };
}

export function getStatus(): FuelStatus {
  const budget = store.getFuelBudget();
  const { totalCost, totalSaved, freeRequests } = getDailyUsage();
  const percentage = budget.dailyCap > 0
    ? Math.min(100, (totalCost / budget.dailyCap) * 100)
    : 0;

  return {
    todayCost: totalCost,
    todaySaved: totalSaved,
    todayFreeRequests: freeRequests,
    dailyCap: budget.dailyCap,
    percentage,
    overBudget: totalCost >= budget.dailyCap,
  };
}

export function getBudget(): FuelBudget {
  return store.getFuelBudget();
}

export function setBudget(budget: Partial<FuelBudget>): FuelBudget {
  return store.setFuelBudget(budget);
}

export function getProjectReport(projectId: string): FuelProjectReport {
  const entries = store.getFuelEntries().filter((e) => e.projectId === projectId);

  let totalCost = 0;
  let totalSaved = 0;
  const byProvider: Record<string, { cost: number; requests: number }> = {};

  for (const entry of entries) {
    totalCost += entry.cost;
    totalSaved += entry.savedAmount;
    const p = byProvider[entry.provider] ?? { cost: 0, requests: 0 };
    p.cost += entry.cost;
    p.requests += 1;
    byProvider[entry.provider] = p;
  }

  return { projectId, totalCost, totalSaved, byProvider };
}

/**
 * Returns true if the conductor should auto-route a task to a free model.
 * Triggered when today's spend approaches the daily cap.
 */
export function shouldRouteToFreeModel(): boolean {
  const budget = store.getFuelBudget();
  const { totalCost } = getDailyUsage();
  const threshold = budget.dailyCap * (budget.warnAt / 100);
  return totalCost >= threshold;
}

/**
 * Returns true if any more paid API calls should be blocked.
 */
export function isHardStopped(): boolean {
  const budget = store.getFuelBudget();
  if (!budget.hardStop) return false;
  const { totalCost } = getDailyUsage();
  return totalCost >= budget.dailyCap;
}
