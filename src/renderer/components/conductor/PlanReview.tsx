import { useState, useEffect } from 'react';
import type { ConductorPlan, ConductorStation, ConductorTask, AgentType, BidRound, AgentAvailability } from '../../../shared/types';
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
  ollama:  '#777777',
};

const AGENT_LABELS: Record<AgentType, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
  ollama:  'Local AI',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  hard:   '#E25822',
  medium: 'var(--caboo-accent-amber)',
  easy:   'var(--caboo-accent-green)',
};

const COMPLEXITY_LABELS: Record<string, string> = {
  hard:   '●●● hard',
  medium: '●●○ med',
  easy:   '●○○ easy',
};

const ALL_AGENTS: AgentType[] = ['claude', 'gemini', 'codex', 'copilot', 'ollama'];

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
  const [expandedStation, setExpandedStation] = useState<string | null>(plan.stations[0]?.id ?? null);
  const [reassignTarget, setReassignTarget] = useState<string | null>(null);
  const [availability, setAvailability] = useState<AgentAvailability[]>([]);

  const totalTime = totalEstimatedTime(plan.stations);
  const agentCounts = agentTaskCount(plan.stations);
  const isFullControl = plan.controlLevel === 'full-control';
  const showCNP = plan.controlLevel === 'guided' || plan.controlLevel === 'full-control';

  const api = useAPI();
  const [bidRounds, setBidRounds] = useState<BidRound[] | null>(null);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [showBids, setShowBids] = useState(false);

  useEffect(() => {
    api.conductor.checkAvailability().then(setAvailability).catch(() => setAvailability([]));
  }, [api]);

  const availMap = new Map(availability.map((a) => [a.agent, a]));

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

  // Compute free-route savings
  const freeTaskCount = plan.stations
    .flatMap((s) => s.tasks)
    .filter((t) => availMap.get(t.assignedAgent)?.isFree).length;
  const totalTasks = plan.stations.flatMap((s) => s.tasks).length;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 flex items-center justify-between"
        style={{ borderBottom: '2px solid var(--caboo-border)' }}
      >
        <div>
          <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '16px', color: 'var(--caboo-text-heading)', letterSpacing: '1px' }}>
            🚂 THE PLAN
          </div>
          <div style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '11px', color: 'var(--caboo-text-muted)', marginTop: '2px' }}>
            {plan.goal}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 text-[10px]" style={{ color: 'var(--caboo-text-muted)', fontFamily: 'var(--caboo-font-body)' }}>
          {totalTime > 0 && <div>⏱ ~{totalTime} min total</div>}
          <div>
            {Object.entries(agentCounts)
              .map(([agent, count]) => `${AGENT_LABELS[agent as AgentType] ?? agent} (${count})`)
              .join(' · ')}
          </div>
          {freeTaskCount > 0 && (
            <div style={{ color: 'var(--caboo-accent-green)' }}>
              ✓ {freeTaskCount}/{totalTasks} tasks route FREE (GitHub/Ollama)
            </div>
          )}
        </div>
      </div>

      {/* Availability banner — warn about unavailable assigned agents */}
      {availability.length > 0 && (() => {
        const unavailableAssigned = plan.stations
          .flatMap((s) => s.tasks)
          .filter((t) => {
            const a = availMap.get(t.assignedAgent);
            return a && !a.available;
          });
        if (unavailableAssigned.length === 0) return null;
        const agentsDown = [...new Set(unavailableAssigned.map((t) => t.assignedAgent))];
        return (
          <div className="shrink-0 px-4 py-2 text-[11px]" style={{
            background: 'rgba(220,80,30,0.1)',
            borderBottom: '1px solid var(--caboo-accent-rust)',
            color: 'var(--caboo-accent-rust)',
            fontFamily: 'var(--caboo-font-body)',
          }}>
            ⚠ {agentsDown.map((a) => AGENT_LABELS[a]).join(', ')} {agentsDown.length === 1 ? 'is' : 'are'} unavailable — tasks will auto-fallback at runtime. {availMap.get(agentsDown[0])?.reason}
          </div>
        );
      })()}

      {/* Plan content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {plan.stations.map((station, si) => (
          <div key={station.id}>
            <div
              className="flex items-center justify-between cursor-pointer py-2 px-3"
              style={{ border: '2px solid var(--caboo-border)', background: 'var(--caboo-bg-mid)' }}
              onClick={() => setExpandedStation(expandedStation === station.id ? null : station.id)}
            >
              <div className="flex items-center gap-2">
                <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '10px', color: 'var(--caboo-accent-amber)' }}>
                  Station {si + 1}:
                </span>
                <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '10px', color: 'var(--caboo-text-heading)' }}>
                  {station.name}
                </span>
                {station.hasCheckpoint && (
                  <span style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '9px', color: 'var(--caboo-accent-amber)', border: '1px solid var(--caboo-accent-amber)', padding: '0 4px' }}>
                    ⏸ checkpoint
                  </span>
                )}
                {/* Parallel badge */}
                {station.tasks.length > 1 && (
                  <span style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '9px', color: 'var(--caboo-accent-green)', border: '1px solid var(--caboo-accent-green)', padding: '0 4px' }}>
                    ⚡ {station.tasks.length} parallel
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

            {expandedStation === station.id && (
              <div style={{ border: '2px solid var(--caboo-border)', borderTop: 'none', background: 'var(--caboo-bg-deep)' }}>
                {station.tasks.map((task, ti) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isFirst={ti === 0}
                    isFullControl={isFullControl}
                    reassignTarget={reassignTarget}
                    agentAvail={availMap}
                    onStartReassign={() => setReassignTarget(reassignTarget === task.id ? null : task.id)}
                    onReassign={(agent) => {
                      onReassignTask?.(task.id, agent);
                      setReassignTarget(null);
                    }}
                  />
                ))}

                {station.hasCheckpoint && (
                  <div className="px-4 py-2 text-[10px]" style={{
                    borderTop: '1px solid var(--caboo-border)',
                    color: 'var(--caboo-accent-amber)',
                    fontFamily: 'var(--caboo-font-body)',
                    background: 'var(--caboo-bg-mid)',
                  }}>
                    💡 CHECKPOINT: Review and approve before continuing
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 flex items-center justify-between" style={{ borderTop: '2px solid var(--caboo-border)' }}>
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
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.7)' }}>
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
  agentAvail,
  onStartReassign,
  onReassign,
}: {
  task: ConductorTask;
  isFirst: boolean;
  isFullControl: boolean;
  reassignTarget: string | null;
  agentAvail: Map<AgentType, AgentAvailability>;
  onStartReassign: () => void;
  onReassign: (agent: AgentType) => void;
}) {
  const agentColor = AGENT_COLORS[task.assignedAgent] ?? 'var(--caboo-text-muted)';
  const avail = agentAvail.get(task.assignedAgent);
  const isUnavailable = avail && !avail.available;

  return (
    <div className="px-4 py-2" style={{ borderTop: isFirst ? 'none' : '1px solid var(--caboo-border)' }}>
      <div className="flex items-center gap-2">
        <span style={{ color: 'var(--caboo-text-muted)', fontSize: '11px', fontFamily: 'var(--caboo-font-body)' }}>├─</span>
        <span style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '11px', color: 'var(--caboo-text-secondary)', flex: 1 }}>
          {task.description}
        </span>

        {/* Complexity badge */}
        {task.complexity && (
          <span style={{
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: '8px',
            color: COMPLEXITY_COLORS[task.complexity] ?? 'var(--caboo-text-muted)',
            letterSpacing: '0.5px',
          }}>
            {COMPLEXITY_LABELS[task.complexity]}
          </span>
        )}

        {/* Model variant badge */}
        {task.modelVariant && (
          <span style={{
            fontFamily: 'var(--caboo-font-body)',
            fontSize: '9px',
            color: 'var(--caboo-text-muted)',
            border: '1px solid var(--caboo-border)',
            padding: '0 3px',
            maxWidth: 100,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={task.modelVariant}
          >
            {task.modelVariant}
          </span>
        )}

        {/* Agent badge */}
        <div className="flex items-center gap-1">
          <span
            style={{
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '9px',
              color: isUnavailable ? 'var(--caboo-accent-rust)' : agentColor,
              border: `1px solid ${isUnavailable ? 'var(--caboo-accent-rust)' : agentColor}`,
              padding: '0 4px',
              cursor: isFullControl ? 'pointer' : 'default',
              textDecoration: isUnavailable ? 'line-through' : 'none',
            }}
            onClick={isFullControl ? onStartReassign : undefined}
            title={isUnavailable ? `Unavailable: ${avail?.reason}` : (isFullControl ? 'Click to reassign' : undefined)}
          >
            {isUnavailable ? '⚠ ' : '→ '}{AGENT_LABELS[task.assignedAgent] ?? task.assignedAgent}
          </span>

          {/* Free indicator */}
          {avail?.isFree && avail.available && (
            <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '8px', color: 'var(--caboo-accent-green)' }}>FREE</span>
          )}

          {isFullControl && reassignTarget === task.id && (
            <div className="flex gap-1">
              {ALL_AGENTS.filter((a) => a !== task.assignedAgent).map((agent) => {
                const aAvail = agentAvail.get(agent);
                return (
                  <button
                    key={agent}
                    onClick={() => onReassign(agent)}
                    style={{
                      fontFamily: 'var(--caboo-font-heading)',
                      fontSize: '9px',
                      color: aAvail?.available ? AGENT_COLORS[agent] : '#555',
                      border: `1px solid ${aAvail?.available ? AGENT_COLORS[agent] : '#333'}`,
                      background: 'var(--caboo-bg-deep)',
                      padding: '0 4px',
                      cursor: 'pointer',
                      opacity: aAvail?.available ? 1 : 0.5,
                    }}
                    title={aAvail?.available ? undefined : aAvail?.reason}
                  >
                    {AGENT_LABELS[agent]}
                    {aAvail?.isFree ? ' ✓free' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Show availability warning inline */}
      {isUnavailable && (
        <div className="mt-1" style={{ fontSize: '9px', color: 'var(--caboo-accent-rust)', paddingLeft: '20px', fontStyle: 'italic' }}>
          Will auto-fallback at runtime: {avail?.reason}
        </div>
      )}
    </div>
  );
}
