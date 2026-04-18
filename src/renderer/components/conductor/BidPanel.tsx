import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BidRound, ScoredBid, AgentType } from '../../../shared/types';

const AGENT_COLORS: Record<string, string> = {
  claude:  'var(--caboo-accent-amber)',
  gemini:  '#4285F4',
  codex:   '#10A37F',
  copilot: '#6e40c9',
  ollama:  '#666666',
};

const AGENT_LABELS: Record<string, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
  ollama:  'Local AI',
};

const MEDALS = ['🥇', '🥈', '🥉'];

function medal(idx: number): string {
  return MEDALS[idx] ?? `${idx + 1}.`;
}

function scoreBar(score: number): string {
  const filled = Math.round(score * 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

interface BidCardProps {
  bid: ScoredBid;
  rank: number;
  isAwarded: boolean;
  onAward: (agent: AgentType) => void;
  canOverride: boolean;
}

function BidCard({ bid, rank, isAwarded, onAward, canOverride }: BidCardProps) {
  const [expanded, setExpanded] = useState(rank === 0);
  const color = AGENT_COLORS[bid.agent] ?? '#888';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06 }}
      style={{
        border: `1px solid ${isAwarded ? color : 'var(--caboo-border)'}`,
        background: isAwarded ? `${color}14` : 'var(--caboo-bg-mid)',
        marginBottom: '8px',
        padding: '10px 12px',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '13px' }}>{medal(rank)}</span>
        <span style={{ color, fontFamily: 'var(--caboo-font-heading)', fontSize: '12px', letterSpacing: '0.5px' }}>
          {AGENT_LABELS[bid.agent] ?? bid.agent}
        </span>
        <span style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '10px', color: 'var(--caboo-text-muted)', marginLeft: 'auto' }}>
          Score: {bid.score.toFixed(2)}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{ color: 'var(--caboo-text-muted)', fontSize: '10px', marginLeft: '6px' }}
        >
          {expanded ? '▲' : '▼'}
        </button>
      </div>

      {/* Score bar */}
      <div style={{ fontFamily: 'monospace', fontSize: '9px', color, marginTop: '4px', letterSpacing: '1px' }}>
        {scoreBar(bid.score)}
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {/* Stats row */}
            <div
              className="flex gap-4 mt-2"
              style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '10px', color: 'var(--caboo-text-secondary)' }}
            >
              <span>Confidence: {Math.round(bid.confidence * 100)}%</span>
              <span>~{bid.estimatedTokens.toLocaleString()} tok</span>
              <span>~{bid.estimatedMinutes}m</span>
              <span>Context: {Math.round(bid.contextRelevance * 100)}%</span>
            </div>

            {/* Reasoning */}
            <p
              className="mt-2"
              style={{ fontFamily: 'var(--caboo-font-body)', fontSize: '10px', color: 'var(--caboo-text-muted)', lineHeight: '1.4', fontStyle: 'italic' }}
            >
              "{bid.reasoning}"
            </p>

            {/* Award button */}
            {canOverride && (
              <button
                onClick={() => onAward(bid.agent as AgentType)}
                style={{
                  marginTop: '8px',
                  border: `1px solid ${color}`,
                  color,
                  background: 'transparent',
                  fontFamily: 'var(--caboo-font-heading)',
                  fontSize: '10px',
                  padding: '3px 10px',
                  letterSpacing: '0.5px',
                  cursor: 'pointer',
                }}
              >
                {isAwarded ? '✓ AWARDED' : 'AWARD'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

interface BidPanelProps {
  rounds: BidRound[];
  controlLevel: 'guided' | 'full-control';
  onApply: (awards: Record<string, AgentType>) => void;
  onSkip: () => void;
  loading?: boolean;
}

export default function BidPanel({ rounds, controlLevel, onApply, onSkip, loading = false }: BidPanelProps) {
  // Initialise with suggested winners
  const [awards, setAwards] = useState<Record<string, AgentType>>(() =>
    Object.fromEntries(rounds.map(r => [r.taskId, r.awarded ?? 'claude'] as [string, AgentType])),
  );

  const [activeTask, setActiveTask] = useState<string | null>(rounds[0]?.taskId ?? null);

  const canOverride = controlLevel === 'full-control';

  const activeRound = rounds.find(r => r.taskId === activeTask);

  return (
    <div
      className="flex flex-col"
      style={{
        border: '2px solid var(--caboo-border)',
        background: 'var(--caboo-bg-mid)',
        padding: '16px',
        fontFamily: 'var(--caboo-font-body)',
        maxHeight: '80vh',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ borderBottom: '2px solid var(--caboo-border)', paddingBottom: '10px', marginBottom: '12px' }}>
        <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '14px', color: 'var(--caboo-text-heading)', letterSpacing: '1px' }}>
          ⚖ CONTRACT NET PROTOCOL
        </div>
        <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)', marginTop: '2px' }}>
          Agents bid on tasks based on confidence and context relevance
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Task list */}
        <div style={{ width: '160px', flexShrink: 0, overflowY: 'auto' }}>
          {rounds.map(r => {
            const winner = awards[r.taskId];
            const winnerColor = AGENT_COLORS[winner] ?? '#888';
            return (
              <button
                key={r.taskId}
                onClick={() => setActiveTask(r.taskId)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '6px 8px',
                  marginBottom: '4px',
                  border: activeTask === r.taskId ? `1px solid var(--caboo-accent-amber)` : '1px solid var(--caboo-border)',
                  background: activeTask === r.taskId ? 'var(--caboo-accent-amber)14' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '9px', color: 'var(--caboo-text-muted)', fontFamily: 'var(--caboo-font-heading)', letterSpacing: '0.5px' }}>
                  TASK
                </div>
                <div style={{ fontSize: '10px', color: 'var(--caboo-text-secondary)', lineHeight: '1.3', marginTop: '2px' }}>
                  {r.taskDescription.slice(0, 50)}{r.taskDescription.length > 50 ? '…' : ''}
                </div>
                <div style={{ fontSize: '9px', color: winnerColor, marginTop: '3px', fontFamily: 'var(--caboo-font-heading)' }}>
                  → {AGENT_LABELS[winner] ?? winner}
                </div>
              </button>
            );
          })}
        </div>

        {/* Bid cards for active task */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          {activeRound && (
            <>
              <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)', marginBottom: '8px' }}>
                {activeRound.taskDescription}
              </div>

              {activeRound.bids.length === 0 ? (
                <div style={{ color: 'var(--caboo-text-muted)', fontSize: '10px', fontStyle: 'italic' }}>
                  No bids collected. Task will use static assignment.
                </div>
              ) : (
                activeRound.bids.map((bid, idx) => (
                  <BidCard
                    key={bid.agent}
                    bid={bid}
                    rank={idx}
                    isAwarded={awards[activeRound.taskId] === bid.agent}
                    canOverride={canOverride}
                    onAward={(agent) => setAwards(a => ({ ...a, [activeRound.taskId]: agent }))}
                  />
                ))
              )}
            </>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div
        className="flex justify-between items-center"
        style={{ borderTop: '1px solid var(--caboo-border)', paddingTop: '10px', marginTop: '10px' }}
      >
        <button
          onClick={onSkip}
          style={{
            fontFamily: 'var(--caboo-font-body)',
            fontSize: '10px',
            color: 'var(--caboo-text-muted)',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Skip bidding — use static assignment
        </button>

        <button
          onClick={() => onApply(awards)}
          disabled={loading}
          style={{
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: '11px',
            letterSpacing: '0.5px',
            color: 'var(--caboo-accent-amber)',
            border: '1px solid var(--caboo-accent-amber)',
            background: 'transparent',
            padding: '5px 16px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}
        >
          {canOverride ? 'APPLY MY SELECTIONS' : 'AUTO-ASSIGN BEST BIDS'}
        </button>
      </div>
    </div>
  );
}
