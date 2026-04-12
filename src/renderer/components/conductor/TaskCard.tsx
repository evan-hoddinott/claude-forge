import type { ConductorTask, AgentType } from '../../../shared/types';

interface TaskCardProps {
  task: ConductorTask;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const AGENT_COLORS: Record<AgentType, string> = {
  claude:  '#D97706',
  gemini:  '#4285F4',
  codex:   '#10A37F',
  copilot: '#6e40c9',
};

const AGENT_LABELS: Record<AgentType, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
};

function StatusBadge({ status }: { status: ConductorTask['status'] }) {
  const styles: Record<ConductorTask['status'], { color: string; label: string }> = {
    pending:   { color: 'var(--forge-text-muted)', label: 'waiting' },
    running:   { color: 'var(--forge-accent-amber)', label: 'running...' },
    completed: { color: 'var(--forge-accent-green)', label: '✅ done' },
    failed:    { color: 'var(--forge-accent-rust)', label: '❌ failed' },
    skipped:   { color: 'var(--forge-text-muted)', label: 'skipped' },
  };
  const s = styles[status];
  return (
    <span style={{ color: s.color, fontSize: '9px', fontFamily: 'var(--forge-font-body)' }}>
      {s.label}
    </span>
  );
}

function formatDuration(ms?: number): string {
  if (!ms) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(0)}s`;
}

export default function TaskCard({ task, onClick, onContextMenu }: TaskCardProps) {
  const agentColor = AGENT_COLORS[task.assignedAgent] ?? 'var(--forge-border)';

  return (
    <div
      className="cursor-pointer transition-all select-none"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        border: '2px solid var(--forge-border)',
        borderLeft: `4px solid ${agentColor}`,
        background: task.status === 'running'
          ? 'var(--forge-bg-surface)'
          : task.status === 'completed'
          ? 'rgba(90,122,58,0.08)'
          : 'var(--forge-bg-mid)',
        padding: '8px 10px',
        fontFamily: 'var(--forge-font-body)',
        transition: 'background 0.15s',
      }}
    >
      {/* Task description */}
      <div
        style={{
          fontSize: '10px',
          color: task.status === 'completed' ? 'var(--forge-text-muted)' : 'var(--forge-text-primary)',
          marginBottom: '6px',
          lineHeight: '1.4',
        }}
      >
        {task.description}
      </div>

      {/* Agent + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {/* Small agent color dot */}
          <div
            style={{
              width: '6px',
              height: '6px',
              background: agentColor,
            }}
          />
          <span style={{ fontSize: '9px', color: agentColor, fontFamily: 'var(--forge-font-heading)' }}>
            {AGENT_LABELS[task.assignedAgent] ?? task.assignedAgent}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {task.duration && (
            <span style={{ fontSize: '9px', color: 'var(--forge-text-muted)' }}>
              {formatDuration(task.duration)}
            </span>
          )}
          <StatusBadge status={task.status} />
        </div>
      </div>

      {/* Running spinner */}
      {task.status === 'running' && (
        <div
          className="mt-1"
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, var(--forge-accent-amber), transparent)',
            backgroundSize: '200% 100%',
            animation: 'conductor-loading 1.5s linear infinite',
          }}
        />
      )}
    </div>
  );
}
