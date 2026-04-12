import { useState } from 'react';
import type { ConductorPlan, ConductorStation, ConductorTask, AgentType } from '../../../shared/types';

interface PlanReviewProps {
  plan: ConductorPlan;
  onStart: () => void;
  onBack: () => void;
  onReassignTask?: (taskId: string, agent: AgentType) => void;
  loading?: boolean;
}

const AGENT_COLORS: Record<AgentType, string> = {
  claude:  'var(--forge-accent-amber)',
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

const ALL_AGENTS: AgentType[] = ['claude', 'gemini', 'codex', 'copilot'];

function formatMinutes(mins?: number): string {
  if (!mins) return '';
  return `~${mins} min`;
}

function totalEstimatedTime(stations: ConductorStation[]): number {
  return stations.reduce((sum, s) => sum + (s.estimatedMinutes ?? 0), 0);
}

function agentTaskCount(stations: ConductorStation[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const station of stations) {
    for (const task of station.tasks) {
      counts[task.assignedAgent] = (counts[task.assignedAgent] ?? 0) + 1;
    }
  }
  return counts;
}

export default function PlanReview({ plan, onStart, onBack, onReassignTask, loading = false }: PlanReviewProps) {
  const [expandedStation, setExpandedStation] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);

  const totalTime = totalEstimatedTime(plan.stations);
  const agentCounts = agentTaskCount(plan.stations);
  const isFullControl = plan.controlLevel === 'full-control';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '2px solid var(--forge-border)' }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--forge-font-heading)',
              fontSize: '16px',
              color: 'var(--forge-text-heading)',
              letterSpacing: '1px',
            }}
          >
            🚂 THE PLAN
          </div>
          <div
            style={{
              fontFamily: 'var(--forge-font-body)',
              fontSize: '11px',
              color: 'var(--forge-text-muted)',
              marginTop: '2px',
            }}
          >
            {plan.goal}
          </div>
        </div>
        <div className="flex gap-3 text-[10px]" style={{ color: 'var(--forge-text-muted)', fontFamily: 'var(--forge-font-body)' }}>
          {totalTime > 0 && (
            <div>⏱ ~{totalTime} min total</div>
          )}
          <div>
            {Object.entries(agentCounts)
              .map(([agent, count]) => `${AGENT_LABELS[agent as AgentType] ?? agent} (${count})`)
              .join(' · ')}
          </div>
        </div>
      </div>

      {/* Plan content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {plan.stations.map((station, si) => (
          <div key={station.id}>
            {/* Station header */}
            <div
              className="flex items-center justify-between cursor-pointer py-2 px-3"
              style={{
                border: '2px solid var(--forge-border)',
                background: 'var(--forge-bg-mid)',
              }}
              onClick={() => setExpandedStation(expandedStation === station.id ? null : station.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: 'var(--forge-font-heading)',
                    fontSize: '10px',
                    color: 'var(--forge-accent-amber)',
                  }}
                >
                  Station {si + 1}:
                </span>
                <span
                  style={{
                    fontFamily: 'var(--forge-font-heading)',
                    fontSize: '10px',
                    color: 'var(--forge-text-heading)',
                  }}
                >
                  {station.name}
                </span>
                {station.hasCheckpoint && (
                  <span
                    style={{
                      fontFamily: 'var(--forge-font-body)',
                      fontSize: '9px',
                      color: 'var(--forge-accent-amber)',
                      border: '1px solid var(--forge-accent-amber)',
                      padding: '0 4px',
                    }}
                  >
                    ⏸ checkpoint
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {station.estimatedMinutes && (
                  <span style={{ color: 'var(--forge-text-muted)', fontSize: '10px', fontFamily: 'var(--forge-font-body)' }}>
                    ⏱ {formatMinutes(station.estimatedMinutes)}
                  </span>
                )}
                <span style={{ color: 'var(--forge-text-muted)', fontSize: '10px' }}>
                  {expandedStation === station.id ? '▲' : '▼'} {station.tasks.length} tasks
                </span>
              </div>
            </div>

            {/* Tasks */}
            {expandedStation === station.id && (
              <div
                style={{
                  border: '2px solid var(--forge-border)',
                  borderTop: 'none',
                  background: 'var(--forge-bg-deep)',
                }}
              >
                {station.tasks.map((task, ti) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isFirst={ti === 0}
                    isFullControl={isFullControl}
                    reassignTarget={reassignTarget}
                    onStartReassign={() => setReassignTarget(reassignTarget === task.id ? null : task.id)}
                    onReassign={(agent) => {
                      onReassignTask?.(task.id, agent);
                      setReassignTarget(null);
                    }}
                  />
                ))}

                {station.hasCheckpoint && (
                  <div
                    className="px-4 py-2 text-[10px]"
                    style={{
                      borderTop: '1px solid var(--forge-border)',
                      color: 'var(--forge-accent-amber)',
                      fontFamily: 'var(--forge-font-body)',
                      background: 'var(--forge-bg-mid)',
                    }}
                  >
                    💡 CHECKPOINT: Review and approve before continuing
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderTop: '2px solid var(--forge-border)' }}
      >
        <button
          onClick={onBack}
          disabled={loading}
          style={{
            fontFamily: 'var(--forge-font-body)',
            fontSize: '12px',
            padding: '8px 16px',
            border: '1px solid var(--forge-border)',
            background: 'transparent',
            color: 'var(--forge-text-muted)',
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <button
          onClick={onStart}
          disabled={loading}
          style={{
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '12px',
            padding: '10px 24px',
            background: loading ? 'var(--forge-bg-surface)' : 'var(--forge-accent-amber)',
            color: loading ? 'var(--forge-text-muted)' : 'var(--forge-bg-deep)',
            border: '2px solid',
            borderColor: loading ? 'var(--forge-border)' : 'var(--forge-accent-amber)',
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '1px',
          }}
        >
          {loading ? 'Starting...' : '🚂 Depart! Start Building →'}
        </button>
      </div>
    </div>
  );
}

function TaskRow({
  task,
  isFirst,
  isFullControl,
  reassignTarget,
  onStartReassign,
  onReassign,
}: {
  task: ConductorTask;
  isFirst: boolean;
  isFullControl: boolean;
  reassignTarget: string | null;
  onStartReassign: () => void;
  onReassign: (agent: AgentType) => void;
}) {
  return (
    <div
      className="px-4 py-2"
      style={{ borderTop: isFirst ? 'none' : '1px solid var(--forge-border)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--forge-text-muted)', fontSize: '11px', fontFamily: 'var(--forge-font-body)' }}>
          ├─
        </span>
        <span
          style={{
            fontFamily: 'var(--forge-font-body)',
            fontSize: '11px',
            color: 'var(--forge-text-secondary)',
            flex: 1,
          }}
        >
          {task.description}
        </span>
        <div className="flex items-center gap-1">
          <span
            style={{
              fontFamily: 'var(--forge-font-heading)',
              fontSize: '9px',
              color: AGENT_COLORS[task.assignedAgent] ?? 'var(--forge-text-muted)',
              border: `1px solid ${AGENT_COLORS[task.assignedAgent] ?? 'var(--forge-border)'}`,
              padding: '0 4px',
              cursor: isFullControl ? 'pointer' : 'default',
            }}
            onClick={isFullControl ? onStartReassign : undefined}
            title={isFullControl ? 'Click to reassign' : undefined}
          >
            → {AGENT_LABELS[task.assignedAgent] ?? task.assignedAgent}
          </span>
          {isFullControl && reassignTarget === task.id && (
            <div className="flex gap-1">
              {ALL_AGENTS.filter((a) => a !== task.assignedAgent).map((agent) => (
                <button
                  key={agent}
                  onClick={() => onReassign(agent)}
                  style={{
                    fontFamily: 'var(--forge-font-heading)',
                    fontSize: '9px',
                    color: AGENT_COLORS[agent],
                    border: `1px solid ${AGENT_COLORS[agent]}`,
                    background: 'var(--forge-bg-deep)',
                    padding: '0 4px',
                    cursor: 'pointer',
                  }}
                >
                  {AGENT_LABELS[agent]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
