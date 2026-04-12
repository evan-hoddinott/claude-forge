import { useEffect, useState } from 'react';
import { useAPI, useQuery } from '../hooks/useAPI';
import type { FuelStatus } from '../../shared/types';

interface FuelGaugeProps {
  className?: string;
}

export default function FuelGauge({ className = '' }: FuelGaugeProps) {
  const api = useAPI();
  const { data: status, refetch } = useQuery(() => api.fuel.getStatus(), []);
  const [refreshTick, setRefreshTick] = useState(0);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setRefreshTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    refetch();
  }, [refreshTick, refetch]);

  // Listen for realtime fuel updates
  useEffect(() => {
    api.fuel.onStatusUpdate((data) => {
      refetch();
    });
    return () => api.fuel.offStatusUpdate();
  }, [api, refetch]);

  if (!status) return null;

  const pct = Math.min(100, status.percentage);
  const overBudget = status.overBudget;

  const barColor = overBudget
    ? 'var(--forge-accent-rust)'
    : pct >= 80
    ? 'var(--forge-accent-amber)'
    : 'var(--forge-accent-green)';

  return (
    <div
      className={`font-mono text-[11px] border border-[var(--forge-border)] bg-[var(--forge-bg-mid)] px-2 py-2 ${className}`}
      style={{ fontFamily: 'var(--forge-font-body)' }}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <span style={{ color: 'var(--forge-accent-amber)' }}>⛽</span>
        <span style={{ color: 'var(--forge-text-secondary)', fontFamily: 'var(--forge-font-heading)', fontSize: '9px' }}>
          FUEL GAUGE
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-2 mb-1"
        style={{ border: '1px solid var(--forge-border)', background: 'var(--forge-bg-deep)' }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: barColor,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Cost display */}
      <div style={{ color: 'var(--forge-text-secondary)' }}>
        <div className="flex justify-between">
          <span>${status.todayCost.toFixed(2)}</span>
          <span style={{ color: 'var(--forge-text-muted)' }}>/ ${status.dailyCap.toFixed(2)}</span>
        </div>
        {status.todaySaved > 0 && (
          <div style={{ color: 'var(--forge-accent-green)' }}>
            saved ${status.todaySaved.toFixed(2)}
          </div>
        )}
        {status.todayFreeRequests > 0 && (
          <div style={{ color: 'var(--forge-text-muted)' }}>
            {status.todayFreeRequests} free req
          </div>
        )}
      </div>

      {overBudget && (
        <div
          className="mt-1 text-center"
          style={{ color: 'var(--forge-accent-rust)', fontFamily: 'var(--forge-font-heading)', fontSize: '9px' }}
        >
          ⚠ BUDGET EXCEEDED
        </div>
      )}
    </div>
  );
}
