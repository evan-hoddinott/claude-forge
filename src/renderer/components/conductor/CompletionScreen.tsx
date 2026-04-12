import type { ConductorPlan } from '../../../shared/types';

interface CompletionScreenProps {
  plan: ConductorPlan;
  onClose: () => void;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function CompletionScreen({ plan, onClose }: CompletionScreenProps) {
  const completedStations = plan.stations.filter((s) => s.status === 'completed').length;
  const failedStations = plan.stations.filter((s) => s.status === 'failed').length;
  const completedTasks = plan.stations.flatMap((s) => s.tasks).filter((t) => t.status === 'completed').length;
  const failedTasks = plan.stations.flatMap((s) => s.tasks).filter((t) => t.status === 'failed').length;
  const allFiles = [...new Set(plan.stations.flatMap((s) => s.tasks.flatMap((t) => t.filesChanged ?? [])))];

  const totalDuration = plan.completedAt
    ? new Date(plan.completedAt).getTime() - new Date(plan.createdAt).getTime()
    : 0;

  const isSuccess = failedStations === 0 && failedTasks === 0;

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-8 py-12"
      style={{ fontFamily: 'var(--forge-font-body)', textAlign: 'center' }}
    >
      {/* Status */}
      <div
        style={{
          fontFamily: 'var(--forge-font-heading)',
          fontSize: '32px',
          marginBottom: '8px',
          color: isSuccess ? 'var(--forge-accent-green)' : 'var(--forge-accent-amber)',
        }}
      >
        {isSuccess ? '🚂 ✅' : '🚂 ⚠️'}
      </div>

      <div
        style={{
          fontFamily: 'var(--forge-font-heading)',
          fontSize: '18px',
          color: isSuccess ? 'var(--forge-accent-green)' : 'var(--forge-accent-amber)',
          letterSpacing: '2px',
          marginBottom: '4px',
        }}
      >
        {isSuccess ? 'ARRIVED!' : 'DONE (with issues)'}
      </div>

      <div
        style={{
          fontFamily: 'var(--forge-font-body)',
          fontSize: '12px',
          color: 'var(--forge-text-muted)',
          marginBottom: '24px',
        }}
      >
        {plan.goal}
      </div>

      {/* Stats */}
      <div
        className="w-full max-w-md mb-6 p-4"
        style={{
          border: '2px solid var(--forge-border)',
          background: 'var(--forge-bg-mid)',
          textAlign: 'left',
        }}
      >
        <div className="grid grid-cols-2 gap-3 text-[11px]">
          <StatRow label="Stations complete" value={`${completedStations}/${plan.stations.length}`} ok={failedStations === 0} />
          <StatRow label="Tasks complete" value={`${completedTasks}`} ok={failedTasks === 0} />
          {failedTasks > 0 && <StatRow label="Tasks failed" value={`${failedTasks}`} ok={false} />}
          {totalDuration > 0 && <StatRow label="Duration" value={formatDuration(totalDuration)} ok={true} />}
          {plan.tokenUsage.used > 0 && (
            <StatRow label="Cost" value={`$${plan.tokenUsage.used.toFixed(3)}`} ok={true} />
          )}
          {plan.tokenUsage.saved > 0 && (
            <StatRow label="Saved" value={`$${plan.tokenUsage.saved.toFixed(3)}`} ok={true} />
          )}
        </div>
      </div>

      {/* Files changed */}
      {allFiles.length > 0 && (
        <div
          className="w-full max-w-md mb-6 p-3 text-left"
          style={{ border: '1px solid var(--forge-border)', background: 'var(--forge-bg-deep)', maxHeight: '180px', overflow: 'auto' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--forge-text-muted)', marginBottom: '4px' }}>
            {allFiles.length} file{allFiles.length !== 1 ? 's' : ''} changed:
          </div>
          {allFiles.map((f) => (
            <div key={f} style={{ fontSize: '10px', color: 'var(--forge-text-secondary)', paddingLeft: '8px' }}>
              + {f}
            </div>
          ))}
        </div>
      )}

      {failedTasks > 0 && (
        <div
          className="w-full max-w-md mb-6 p-3 text-[11px]"
          style={{
            border: '1px solid var(--forge-accent-amber)',
            background: 'rgba(184,134,11,0.08)',
            color: 'var(--forge-accent-amber)',
          }}
        >
          {failedTasks} task{failedTasks !== 1 ? 's' : ''} need attention — review the timeline for details.
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          fontFamily: 'var(--forge-font-heading)',
          fontSize: '12px',
          padding: '10px 32px',
          background: 'var(--forge-accent-amber)',
          color: 'var(--forge-bg-deep)',
          border: '2px solid var(--forge-accent-amber)',
          cursor: 'pointer',
          letterSpacing: '1px',
        }}
      >
        Close Conductor
      </button>
    </div>
  );
}

function StatRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <>
      <div style={{ color: 'var(--forge-text-muted)' }}>{label}</div>
      <div style={{ color: ok ? 'var(--forge-text-primary)' : 'var(--forge-accent-rust)', fontFamily: 'var(--forge-font-heading)', fontSize: '10px' }}>
        {value}
      </div>
    </>
  );
}
