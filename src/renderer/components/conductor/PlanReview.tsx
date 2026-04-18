import { useState } from 'react';
import type { ConductorPlan, ConductorStation, ConductorTask, AgentType, BidRound } from '../../../shared/types';
import { useAPI } from '../../hooks/useAPI';
import BidPanel from './BidPanel';

interface PlanReviewProps {
  plan: ConductorPlan;
  onStart: () => void;
  onBack: () => void;
  onReassignTask?: (taskId: string, agent: AgentType) => void;
  loading?: boolean;
}

const AGENT_COLORS: Record<AgentType, string> = {
  claude:  'var(--caboo-accent-amber)',
  gemini:  '#4285F4',
  codex:   '#10A37F',
  copilot: '#6e40c9',
  ollama:  '#333333',
};

const AGENT_LABELS: Record<AgentType, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
  ollama:  'Local AI',
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
  const showCNP = plan.controlLevel === 'guided' || plan.controlLevel === 'full-control';

  const api = useAPI();
  const [bidRounds, setBidRounds] = useState<BidRound[] | null>(null);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [showBids, setShowBids] = useState(false);

  const requestBids = async () => {
    setBidsLoading(true);
    try {
      const rounds = await api.contractNet.requestBids(plan.projectId);
      setBidRounds(rounds);
      setShowBids(true);
    } catch {
      // ignore — fall back to static
    } finally {
      setBidsLoading(false);
    }
  };

  const applyBids = (awards: Record<string, AgentType>) => {
    for (const [taskId, agent] of Object.entries(awards)) {
      onReassignTask?.(taskId, agent);
    }
    setShowBids(false);
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '2px solid var(--caboo-border)' }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '16px',
              color: 'var(--caboo-text-heading)',
              letterSpacing: '1px',
            }}
          >
            🚂 THE PLAN
          </div>
          <div
            style={{
              fontFamily: 'var(--caboo-font-body)',
              fontSize: '11px',
              color: 'var(--caboo-text-muted)',
              marginTop: '2px',
            }}
          >
            {plan.goal}
          </div>
        </div>
        <div className="flex gap-3 text-[10px]" style={{ color: 'var(--caboo-text-muted)', fontFamily: 'var(--caboo-font-body)' }}>
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
                border: '2px solid var(--caboo-border)',
                background: 'var(--caboo-bg-mid)',
              }}
              onClick={() => setExpandedStation(expandedStation === station.id ? null : station.id)}
            >
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontFamily: 'var(--caboo-font-heading)',
                    fontSize: '10px',
                    color: 'var(--caboo-accent-amber)',
                  }}
                >
                  Station {si + 1}:
                </span>
                <span
                  style={{
                    fontFamily: 'var(--caboo-font-heading)',
                    fontSize: '10px',
                    color: 'var(--caboo-text-heading)',
                  }}
                >
                  {station.name}
                </span>
                {station.hasCheckpoint && (
                  <span
                    style={{
                      fontFamily: 'var(--caboo-font-body)',
                      fontSize: '9px',
                      color: 'var(--caboo-accent-amber)',
                      border: '1px solid var(--caboo-accent-amber)',
                      padding: '0 4px',
                    }}
                  >
                    ⏸ checkpoint
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {station.estimatedMinutes && (
                  <span style={{ color: 'var(--caboo-text-muted)', fontSize: '10px', fontFamily: 'var(--caboo-font-body)' }}>
                    ⏱ {formatMinutes(station.estimatedMinutes)}
                  </span>
                )}
                <span style={{ color: 'var(--caboo-text-muted)', fontSize: '10px' }}>
                  {expandedStation === station.id ? '▲' : '▼'} {station.tasks.length} tasks
                </span>
              </div>
            </div>

            {/* Tasks */}
            {expandedStation === station.id && (
              <div
                style={{
                  border: '2px solid var(--caboo-border)',
                  borderTop: 'none',
                  background: 'var(--caboo-bg-deep)',
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
                      borderTop: '1px solid var(--caboo-border)',
                      color: 'var(--caboo-accent-amber)',
                      fontFamily: 'var(--caboo-font-body)',
                      background: 'var(--caboo-bg-mid)',
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
        style={{ borderTop: '2px solid var(--caboo-border)' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            disabled={loading}
            style={{
              fontFamily: 'var(--caboo-font-body)',
              fontSize: '12px',
              padding: '8px 16px',
              border: '1px solid var(--caboo-border)',
              background: 'transparent',
              color: 'var(--caboo-text-muted)',
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>

          {showCNP && !showBids && (
            <button
              onClick={requestBids}
              disabled={bidsLoading || loading}
              style={{
                fontFamily: 'var(--caboo-font-heading)',
                fontSize: '11px',
                padding: '8px 14px',
                border: '1px solid var(--caboo-accent-amber)',
                background: 'transparent',
                color: 'var(--caboo-accent-amber)',
                cursor: bidsLoading ? 'wait' : 'pointer',
                letterSpacing: '0.5px',
                opacity: bidsLoading ? 0.6 : 1,
              }}
            >
              {bidsLoading ? '⏳ Collecting bids…' : '⚖ Request Agent Bids'}
            </button>
          )}
        </div>
        <button
          onClick={onStart}
          disabled={loading}
          style={{
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: '12px',
            padding: '10px 24px',
            background: loading ? 'var(--caboo-bg-surface)' : 'var(--caboo-accent-amber)',
            color: loading ? 'var(--caboo-text-muted)' : 'var(--caboo-bg-deep)',
            border: '2px solid',
            borderColor: loading ? 'var(--caboo-border)' : 'var(--caboo-accent-amber)',
            cursor: loading ? 'not-allowed' : 'pointer',
            letterSpacing: '1px',
          }}
        >
          {loading ? 'Starting...' : '🚂 Depart! Start Building →'}
        </button>
      </div>

      {/* Bid Panel overlay */}
      {showBids && bidRounds && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.7)' }}
        >
          <div style={{ width: '100%', maxWidth: '680px', maxHeight: '80vh' }}>
            <BidPanel
              rounds={bidRounds}
              controlLevel={plan.controlLevel as 'guided' | 'full-control'}
              onApply={applyBids}
              onSkip={() => setShowBids(false)}
            />
          </div>
        </div>
      )}
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
      style={{ borderTop: isFirst ? 'none' : '1px solid var(--caboo-border)' }}
    >
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--caboo-text-muted)', fontSize: '11px', fontFamily: 'var(--caboo-font-body)' }}>
          ├─
        </span>
        <span
          style={{
            fontFamily: 'var(--caboo-font-body)',
            fontSize: '11px',
            color: 'var(--caboo-text-secondary)',
            flex: 1,
          }}
        >
          {task.description}
        </span>
        <div className="flex items-center gap-1">
          <span
            style={{
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '9px',
              color: AGENT_COLORS[task.assignedAgent] ?? 'var(--caboo-text-muted)',
              border: `1px solid ${AGENT_COLORS[task.assignedAgent] ?? 'var(--caboo-border)'}`,
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
                    fontFamily: 'var(--caboo-font-heading)',
                    fontSize: '9px',
                    color: AGENT_COLORS[agent],
                    border: `1px solid ${AGENT_COLORS[agent]}`,
                    background: 'var(--caboo-bg-deep)',
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
