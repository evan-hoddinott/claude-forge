import type { ConductorPlan, ConductorStation } from '../../../shared/types';

interface CheckpointModalProps {
  plan: ConductorPlan;
  station: ConductorStation;
  onDecision: (decision: 'continue' | 'pause' | 'revert' | 'stop') => void;
  loading?: boolean;
}

export default function CheckpointModal({ plan, station, onDecision, loading = false }: CheckpointModalProps) {
  const completedTasks = station.tasks.filter((t) => t.status === 'completed');
  const failedTasks = station.tasks.filter((t) => t.status === 'failed');
  const allFilesChanged = station.tasks.flatMap((t) => t.filesChanged ?? []);
  const uniqueFiles = [...new Set(allFilesChanged)];

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-6 py-8"
      style={{ fontFamily: 'var(--caboo-font-body)' }}
    >
      <div className="w-full max-w-lg">
        {/* Header */}
        <div
          className="px-4 py-3 mb-4 text-center"
          style={{
            border: '2px solid var(--caboo-accent-amber)',
            background: 'rgba(184,134,11,0.1)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '14px',
              color: 'var(--caboo-accent-amber)',
              letterSpacing: '1px',
              marginBottom: '4px',
            }}
          >
            ⏸ CHECKPOINT — {station.name}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--caboo-text-muted)' }}>
            {plan.goal}
          </div>
        </div>

        {/* Summary */}
        <div className="mb-4 space-y-1">
          <div style={{ fontSize: '11px', color: 'var(--caboo-text-secondary)', marginBottom: '8px' }}>
            The conductor finished: "<strong>{station.name}</strong>"
          </div>
          <div className="flex gap-4 text-[10px]" style={{ color: 'var(--caboo-text-muted)' }}>
            <span style={{ color: 'var(--caboo-accent-green)' }}>✅ {completedTasks.length} tasks complete</span>
            {failedTasks.length > 0 && (
              <span style={{ color: 'var(--caboo-accent-rust)' }}>❌ {failedTasks.length} failed</span>
            )}
          </div>
        </div>

        {/* Changed files */}
        {uniqueFiles.length > 0 && (
          <div
            className="mb-4 p-3"
            style={{
              border: '1px solid var(--caboo-border)',
              background: 'var(--caboo-bg-deep)',
            }}
          >
            <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)', marginBottom: '4px' }}>
              Changes made:
            </div>
            {uniqueFiles.slice(0, 10).map((f) => (
              <div
                key={f}
                style={{ fontSize: '10px', color: 'var(--caboo-text-secondary)', paddingLeft: '8px' }}
              >
                + {f}
              </div>
            ))}
            {uniqueFiles.length > 10 && (
              <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)', paddingLeft: '8px' }}>
                +{uniqueFiles.length - 10} more files
              </div>
            )}
          </div>
        )}

        {/* Decision buttons */}
        <div
          style={{ fontSize: '11px', color: 'var(--caboo-text-secondary)', marginBottom: '12px' }}
        >
          Does this look right?
        </div>
        <div className="space-y-2">
          <button
            onClick={() => onDecision('continue')}
            disabled={loading}
            className="w-full px-4 py-3 text-left transition-all"
            style={{
              border: '2px solid var(--caboo-accent-green)',
              background: 'rgba(90,122,58,0.1)',
              color: 'var(--caboo-accent-green)',
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            ✅ Looks good, continue
          </button>
          <button
            onClick={() => onDecision('pause')}
            disabled={loading}
            className="w-full px-4 py-3 text-left transition-all"
            style={{
              border: '2px solid var(--caboo-border)',
              background: 'transparent',
              color: 'var(--caboo-text-secondary)',
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            ✏️ Needs changes — pause here
          </button>
          <button
            onClick={() => onDecision('revert')}
            disabled={loading}
            className="w-full px-4 py-3 text-left transition-all"
            style={{
              border: '2px solid var(--caboo-accent-amber)',
              background: 'rgba(184,134,11,0.08)',
              color: 'var(--caboo-accent-amber)',
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            ↩️ Undo this station — revert changes
          </button>
          <button
            onClick={() => onDecision('stop')}
            disabled={loading}
            className="w-full px-4 py-3 text-left transition-all"
            style={{
              border: '2px solid var(--caboo-accent-rust)',
              background: 'rgba(139,69,19,0.08)',
              color: 'var(--caboo-accent-rust)',
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '11px',
              cursor: loading ? 'not-allowed' : 'pointer',
              letterSpacing: '0.5px',
            }}
          >
            🛑 Stop here — I'll take over
          </button>
        </div>
      </div>
    </div>
  );
}
