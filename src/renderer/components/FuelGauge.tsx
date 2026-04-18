import { useEffect, useState } from 'react';
import { useAPI, useQuery } from '../hooks/useAPI';
import type { FuelStatus } from '../../shared/types';

interface FuelGaugeProps {
  className?: string;
}

const AGENT_LABELS: Record<string, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
  ollama:  'Ollama',
  anthropic: 'Claude',
  openai: 'OpenAI',
  github: 'GitHub',
};

function agentLabel(key: string): string {
  return AGENT_LABELS[key] ?? key;
}

export default function FuelGauge({ className = '' }: FuelGaugeProps) {
  const api = useAPI();
  const { data: status, refetch } = useQuery<FuelStatus>(() => api.fuel.getStatus(), []);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => { refetch(); }, [refreshTick, refetch]);

  useEffect(() => {
    api.fuel.onStatusUpdate(() => refetch());
    return () => api.fuel.offStatusUpdate();
  }, [api, refetch]);

  if (!status) return null;

  const pct = Math.min(100, status.percentage);
  const overBudget = status.overBudget;

  // Token bucket bar
  const tb = status.tokenBucket;
  const tbPct = tb ? Math.min(100, tb.percentUsed) : 0;

  const barColor = overBudget
    ? 'var(--caboo-accent-rust)'
    : pct >= 80
    ? 'var(--caboo-accent-amber)'
    : 'var(--caboo-accent-green)';

  const tbColor = tbPct >= 100
    ? 'var(--caboo-accent-rust)'
    : tbPct >= 80
    ? 'var(--caboo-accent-amber)'
    : '#60a5fa';

  // Per-agent entries (top 3 by cost/tokens)
  const agentEntries = Object.entries(status.byAgent ?? {})
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 3);

  return (
    <div
      className={`font-mono text-[11px] border border-[var(--caboo-border)] bg-[var(--caboo-bg-mid)] px-2 py-2 ${className}`}
      style={{ fontFamily: 'var(--caboo-font-body)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: 'var(--caboo-accent-amber)' }}>⛽</span>
        <span style={{ color: 'var(--caboo-text-secondary)', fontFamily: 'var(--caboo-font-heading)', fontSize: '9px' }}>
          FUEL GAUGE
        </span>
      </div>

      {/* USD spend bar */}
      <div
        className="w-full h-2 mb-1"
        style={{ border: '1px solid var(--caboo-border)', background: 'var(--caboo-bg-deep)' }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, transition: 'width 0.3s ease' }} />
      </div>

      {/* Today cost */}
      <div style={{ color: 'var(--caboo-text-secondary)' }}>
        <div className="flex justify-between">
          <span>Today: ${status.todayCost.toFixed(2)}</span>
          <span style={{ color: 'var(--caboo-text-muted)' }}>/ ${status.dailyCap.toFixed(2)}</span>
        </div>

        {/* Session cost */}
        {status.sessionCost !== undefined && status.sessionCost > 0 && (
          <div style={{ color: 'var(--caboo-text-muted)', marginTop: '2px' }}>
            Session: ${status.sessionCost.toFixed(3)}
          </div>
        )}
      </div>

      {/* Per-agent breakdown */}
      {agentEntries.length > 0 && (
        <div style={{ marginTop: '4px', borderTop: '1px solid var(--caboo-border)', paddingTop: '4px' }}>
          {agentEntries.map(([key, val], idx) => (
            <div key={key} className="flex justify-between" style={{ color: 'var(--caboo-text-muted)' }}>
              <span>{idx === agentEntries.length - 1 ? '└' : '├'} {agentLabel(key)}</span>
              <span>
                ${val.cost.toFixed(3)}
                {val.tokens > 0 && <span style={{ color: 'var(--caboo-text-muted)', opacity: 0.7 }}> ({Math.round(val.tokens / 1000)}K)</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Token bucket */}
      {tb && tb.capacity > 0 && (
        <div style={{ marginTop: '4px', borderTop: '1px solid var(--caboo-border)', paddingTop: '4px' }}>
          <div className="flex justify-between" style={{ color: 'var(--caboo-text-muted)' }}>
            <span>Tokens:</span>
            <span style={{ color: tbColor }}>
              {Math.round(tb.used / 1000)}K / {Math.round(tb.capacity / 1000)}K
            </span>
          </div>
          <div
            className="w-full h-1 mt-1"
            style={{ border: '1px solid var(--caboo-border)', background: 'var(--caboo-bg-deep)' }}
          >
            <div style={{ width: `${tbPct}%`, height: '100%', background: tbColor, transition: 'width 0.3s ease' }} />
          </div>
        </div>
      )}

      {/* Savings + free requests */}
      {(status.todaySaved > 0 || status.todayFreeRequests > 0) && (
        <div style={{ marginTop: '4px', borderTop: '1px solid var(--caboo-border)', paddingTop: '4px' }}>
          {status.todaySaved > 0 && (
            <div style={{ color: 'var(--caboo-accent-green)' }}>
              Saved ${status.todaySaved.toFixed(2)} via routing
            </div>
          )}
          {status.todayFreeRequests > 0 && (
            <div style={{ color: 'var(--caboo-text-muted)' }}>
              {status.todayFreeRequests} free req remaining
            </div>
          )}
        </div>
      )}

      {overBudget && (
        <div
          className="mt-1 text-center"
          style={{ color: 'var(--caboo-accent-rust)', fontFamily: 'var(--caboo-font-heading)', fontSize: '9px' }}
        >
          ⚠ BUDGET EXCEEDED
        </div>
      )}
    </div>
  );
}
