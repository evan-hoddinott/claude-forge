import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type {
  AgentType,
  BattleSideProgressDTO,
  BattleProgressDTO,
  BattleRecord,
  AgentLeaderboardEntry,
  Project,
  GhostTestStatus,
} from '../../shared/types';
import { AGENTS } from '../../shared/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number): string {
  if (ms === 0) return '–';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const AGENT_COLORS: Record<AgentType, string> = {
  claude: '#D97706',
  gemini: '#4285F4',
  codex: '#10A37F',
  copilot: '#6e40c9',
  ollama: '#333333',
};

function AgentIcon({ type, size = 16 }: { type: AgentType; size?: number }) {
  const s = `${size}px`;
  switch (type) {
    case 'claude':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <polyline points="4 7 6 9 4 11" />
          <line x1="8" y1="11" x2="12" y2="11" />
        </svg>
      );
    case 'gemini':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C8 4.42 4.42 8 0 8c4.42 0 8 3.58 8 8 0-4.42 3.58-8 8-8-4.42 0-8-3.58-8-8z" />
        </svg>
      );
    case 'codex':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0L14.93 4v8L8 16 1.07 12V4L8 0zm0 1.6L2.47 4.8v6.4L8 14.4l5.53-3.2V4.8L8 1.6z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
    case 'copilot':
      return (
        <svg width={s} height={s} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1L9.5 6.5H15L10.5 9.5L12 15L8 12L4 15L5.5 9.5L1 6.5H6.5Z" />
        </svg>
      );
  }
}

function GhostBadge({ status }: { status: GhostTestStatus | undefined }) {
  if (!status) return null;
  const map: Record<GhostTestStatus, { label: string; color: string }> = {
    passed: { label: 'Tests pass', color: 'text-green-400' },
    'auto-fixed': { label: 'Auto-fixed', color: 'text-blue-400' },
    failed: { label: 'Tests fail', color: 'text-red-400' },
    timeout: { label: 'Test timeout', color: 'text-yellow-400' },
  };
  const { label, color } = map[status];
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}

// ── View types ────────────────────────────────────────────────────────────────

type View = 'setup' | 'battle' | 'results' | 'history';

// ── Main Component ────────────────────────────────────────────────────────────

export default function BattleDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const api = useAPI();
  const { toast } = useToast();

  const projectAgents: AgentType[] = project.agents?.length ? project.agents : ['claude'];
  const defaultA1: AgentType = projectAgents[0] ?? 'claude';
  const defaultA2: AgentType = projectAgents[1] ?? (projectAgents[0] === 'gemini' ? 'claude' : 'gemini');

  // Setup state
  const [task, setTask] = useState('');
  const [agent1, setAgent1] = useState<AgentType>(defaultA1);
  const [agent2, setAgent2] = useState<AgentType>(defaultA2);

  // Battle state
  const [view, setView] = useState<View>('setup');
  const [agents, setAgents] = useState<[AgentType, AgentType]>([defaultA1, defaultA2]);
  const [progress, setProgress] = useState<[BattleSideProgressDTO, BattleSideProgressDTO]>([
    makeFreshProgress(),
    makeFreshProgress(),
  ]);
  const [starting, setStarting] = useState(false);

  // Results state
  const [diffSide, setDiffSide] = useState<0 | 1 | null>(null);
  const [diffContent, setDiffContent] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [applyingSide, setApplyingSide] = useState<0 | 1 | null>(null);

  // History state
  const [history, setHistory] = useState<BattleRecord[]>([]);
  const [leaderboard, setLeaderboard] = useState<AgentLeaderboardEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Check if a battle is already running on mount
  useEffect(() => {
    void api.battle.getProgress().then((p) => {
      if (p) {
        setAgents(p.agents);
        setProgress(p.progress);
        setView('battle');
      }
    });
  }, [api.battle]);

  // Subscribe to battle progress events
  useEffect(() => {
    const handler = (event: BattleProgressDTO) => {
      if (event.progress) {
        setProgress((prev) => {
          const next = [...prev] as [BattleSideProgressDTO, BattleSideProgressDTO];
          next[event.side] = event.progress as BattleSideProgressDTO;
          return next;
        });
      }
    };
    api.battle.onProgress(handler as (e: unknown) => void);
    return () => { api.battle.offProgress(); };
  }, [api.battle]);

  // Auto-advance to results when both sides are done
  useEffect(() => {
    if (view !== 'battle') return;
    const both = progress[0].status !== 'waiting' && progress[0].status !== 'running'
      && progress[1].status !== 'waiting' && progress[1].status !== 'running';
    if (both) {
      setView('results');
    }
  }, [progress, view]);

  const startBattle = async () => {
    if (!task.trim()) { toast('Enter a task first'); return; }
    if (agent1 === agent2) { toast('Pick two different agents'); return; }
    setStarting(true);
    try {
      await api.battle.start(project.id, project.path, task.trim(), [agent1, agent2]);
      setAgents([agent1, agent2]);
      setProgress([makeFreshProgress(), makeFreshProgress()]);
      setView('battle');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to start battle');
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    await api.battle.cancel();
    setView('setup');
    setProgress([makeFreshProgress(), makeFreshProgress()]);
  };

  const handleViewDiff = async (side: 0 | 1) => {
    setLoadingDiff(true);
    setDiffSide(side);
    try {
      const diff = await api.battle.getDiff(side);
      setDiffContent(diff || '(no changes detected)');
    } catch {
      setDiffContent('Could not load diff.');
    } finally {
      setLoadingDiff(false);
    }
  };

  const handlePickWinner = async (side: 0 | 1) => {
    setApplyingSide(side);
    try {
      const record = await api.battle.applyWinner(side, project.path);
      const winnerName = AGENTS[agents[side]].displayName;
      toast(`${winnerName} wins! Changes applied to your project.`);
      // Reload history
      const [h, lb] = await Promise.all([
        api.battle.getHistory(project.id),
        api.battle.getLeaderboard(),
      ]);
      setHistory(h);
      setLeaderboard(lb);
      setHistoryLoaded(true);
      // Show history after a brief delay
      setTimeout(() => {
        setView('history');
            setProgress([makeFreshProgress(), makeFreshProgress()]);
      }, 800);
      void record;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to apply winner');
    } finally {
      setApplyingSide(null);
    }
  };

  const handleDiscard = async () => {
    await api.battle.discard();
    setView('setup');
    setProgress([makeFreshProgress(), makeFreshProgress()]);
  };

  const loadHistory = useCallback(async () => {
    if (historyLoaded) return;
    try {
      const [h, lb] = await Promise.all([
        api.battle.getHistory(project.id),
        api.battle.getLeaderboard(),
      ]);
      setHistory(h);
      setLeaderboard(lb);
      setHistoryLoaded(true);
    } catch {
      // ignore
    }
  }, [api.battle, historyLoaded, project.id]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={view === 'setup' || view === 'history' ? onClose : undefined}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative z-10 w-full max-w-4xl mx-4 bg-bg-secondary border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-lg">⚔️</span>
            <div>
              <h2 className="text-base font-bold text-text-primary tracking-tight">Agent Battle</h2>
              <p className="text-xs text-text-muted">
                {view === 'setup' && 'Challenge two agents on the same task'}
                {view === 'battle' && 'Battle in progress…'}
                {view === 'results' && 'Pick the winner'}
                {view === 'history' && 'Battle history & leaderboard'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'setup' && (
              <button
                onClick={() => { void loadHistory(); setView('history'); }}
                className="text-xs text-text-muted hover:text-text-secondary px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                History
              </button>
            )}
            {view === 'history' && (
              <button
                onClick={() => setView('setup')}
                className="text-xs text-text-muted hover:text-text-secondary px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
              >
                New Battle
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            {view === 'setup' && (
              <SetupView
                key="setup"
                task={task}
                setTask={setTask}
                agent1={agent1}
                agent2={agent2}
                setAgent1={setAgent1}
                setAgent2={setAgent2}
                starting={starting}
                onStart={startBattle}
                onClose={onClose}
              />
            )}
            {view === 'battle' && (
              <BattleView
                key="battle"
                agents={agents}
                progress={progress}
                onCancel={handleCancel}
              />
            )}
            {view === 'results' && (
              <ResultsView
                key="results"
                agents={agents}
                progress={progress}
                applyingSide={applyingSide}
                onViewDiff={handleViewDiff}
                onPickWinner={handlePickWinner}
                onDiscard={handleDiscard}
              />
            )}
            {view === 'history' && (
              <HistoryView
                key="history"
                history={history}
                leaderboard={leaderboard}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Diff Modal */}
      <AnimatePresence>
        {diffSide !== null && (
          <DiffModal
            side={diffSide}
            agentType={agents[diffSide]}
            content={diffContent}
            loading={loadingDiff}
            onClose={() => setDiffSide(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Setup View ────────────────────────────────────────────────────────────────

function SetupView({
  task, setTask, agent1, agent2, setAgent1, setAgent2, starting, onStart, onClose,
}: {
  task: string;
  setTask: (v: string) => void;
  agent1: AgentType;
  agent2: AgentType;
  setAgent1: (v: AgentType) => void;
  setAgent2: (v: AgentType) => void;
  starting: boolean;
  onStart: () => void;
  onClose: () => void;
}) {
  const allAgents = Object.values(AGENTS);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="p-6 space-y-6"
    >
      {/* VS header graphic */}
      <div className="flex items-center justify-center gap-6 py-2">
        <AgentPill agentType={agent1} />
        <div className="text-2xl font-black text-text-muted tracking-widest select-none">VS</div>
        <AgentPill agentType={agent2} />
      </div>

      {/* Task */}
      <div>
        <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Task</label>
        <textarea
          ref={textareaRef}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe what you want both agents to build or fix…"
          rows={4}
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent/40 focus:ring-1 focus:ring-accent/20 transition-all"
        />
      </div>

      {/* Agent selection */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Challenger 1</label>
          <AgentSelector value={agent1} onChange={setAgent1} exclude={agent2} agents={allAgents} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-muted mb-2 uppercase tracking-wider">Challenger 2</label>
          <AgentSelector value={agent2} onChange={setAgent2} exclude={agent1} agents={allAgents} />
        </div>
      </div>

      {/* Note about non-interactive mode */}
      <p className="text-xs text-text-muted bg-white/[0.03] rounded-lg px-3 py-2 border border-white/[0.05]">
        Agents run in non-interactive mode (<code className="font-mono">-p</code> flag) on isolated copies of your project.
        Both copies are discarded after you pick a winner.
      </p>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onStart}
          disabled={starting || !task.trim() || agent1 === agent2}
          className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {starting ? (
            <>
              <Spinner /> Preparing…
            </>
          ) : (
            <>⚔️ Start Battle!</>
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ── Battle View (Progress) ────────────────────────────────────────────────────

function BattleView({
  agents,
  progress,
  onCancel,
}: {
  agents: [AgentType, AgentType];
  progress: [BattleSideProgressDTO, BattleSideProgressDTO];
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="p-6 space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <SideCard agentType={agents[0]} progress={progress[0]} side={0} />
        <SideCard agentType={agents[1]} progress={progress[1]} side={1} />
      </div>

      <div className="flex justify-center">
        <button
          onClick={onCancel}
          className="px-4 py-1.5 text-xs text-text-muted hover:text-red-400 border border-white/[0.08] hover:border-red-400/30 rounded-lg transition-colors"
        >
          Cancel Battle
        </button>
      </div>
    </motion.div>
  );
}

// ── Results View ──────────────────────────────────────────────────────────────

function ResultsView({
  agents,
  progress,
  applyingSide,
  onViewDiff,
  onPickWinner,
  onDiscard,
}: {
  agents: [AgentType, AgentType];
  progress: [BattleSideProgressDTO, BattleSideProgressDTO];
  applyingSide: 0 | 1 | null;
  onViewDiff: (side: 0 | 1) => void;
  onPickWinner: (side: 0 | 1) => void;
  onDiscard: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="p-6 space-y-4"
    >
      <p className="text-center text-sm text-text-muted">Both agents finished. Pick the winner to apply their changes.</p>

      <div className="grid grid-cols-2 gap-4">
        {([0, 1] as const).map((side) => (
          <ResultCard
            key={side}
            side={side}
            agentType={agents[side]}
            progress={progress[side]}
            applying={applyingSide === side}
            onViewDiff={() => onViewDiff(side)}
            onPickWinner={() => onPickWinner(side)}
          />
        ))}
      </div>

      <div className="flex justify-center">
        <button
          onClick={onDiscard}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Discard both &amp; close
        </button>
      </div>
    </motion.div>
  );
}

// ── SideCard (used during battle) ─────────────────────────────────────────────

function SideCard({
  agentType,
  progress,
}: {
  agentType: AgentType;
  progress: BattleSideProgressDTO;
  side: 0 | 1;
}) {
  const config = AGENTS[agentType];
  const color = AGENT_COLORS[agentType];
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress.log]);

  const statusIcon = {
    waiting: '⏳',
    running: '⚙️',
    done: '✅',
    error: '❌',
  }[progress.status];

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        progress.status === 'done'
          ? 'border-green-500/20 bg-green-500/[0.03]'
          : progress.status === 'error'
          ? 'border-red-500/20 bg-red-500/[0.03]'
          : 'border-white/[0.08] bg-white/[0.02]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <span style={{ color }}><AgentIcon type={agentType} size={14} /></span>
        <span className="text-sm font-semibold text-text-primary">{config.displayName}</span>
        <span className="ml-auto text-base">{statusIcon}</span>
        {progress.status === 'running' && (
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        )}
      </div>

      {/* Stats */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs border-b border-white/[0.04]">
        <Stat label="Files" value={progress.filesModified > 0 ? `${progress.filesModified}` : '–'} />
        <Stat label="Runtime" value={fmtMs(progress.runtimeMs)} />
        <Stat label="+Lines" value={progress.linesAdded > 0 ? `+${progress.linesAdded}` : '–'} />
        <Stat label="-Lines" value={progress.linesRemoved > 0 ? `-${progress.linesRemoved}` : '–'} />
      </div>

      {/* Log */}
      <div
        ref={logRef}
        className="px-4 py-3 h-32 overflow-y-auto font-mono text-xs text-text-muted space-y-0.5"
      >
        {progress.log.length === 0 ? (
          <span className="text-text-muted/50">
            {progress.status === 'waiting' ? 'Waiting to start…' : 'No output yet…'}
          </span>
        ) : (
          progress.log.slice(-30).map((line, i) => (
            <div key={i} className="leading-snug truncate opacity-70 hover:opacity-100 transition-opacity">
              {line}
            </div>
          ))
        )}
      </div>

      {/* Error */}
      {progress.error && (
        <div className="px-4 py-2 text-xs text-red-400 border-t border-red-500/10">
          {progress.error}
        </div>
      )}
    </div>
  );
}

// ── ResultCard (used in results view) ─────────────────────────────────────────

function ResultCard({
  agentType,
  progress,
  applying,
  onViewDiff,
  onPickWinner,
}: {
  side: 0 | 1;
  agentType: AgentType;
  progress: BattleSideProgressDTO;
  applying: boolean;
  onViewDiff: () => void;
  onPickWinner: () => void;
}) {
  const config = AGENTS[agentType];
  const color = AGENT_COLORS[agentType];

  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <span style={{ color }}><AgentIcon type={agentType} size={14} /></span>
        <span className="text-sm font-semibold text-text-primary">{config.displayName}</span>
        {progress.status === 'error' && (
          <span className="ml-auto text-xs text-red-400">Failed</span>
        )}
      </div>

      {/* Metrics */}
      <div className="px-4 py-4 space-y-2">
        <MetricRow label="Files changed" value={`${progress.filesModified}`} />
        <MetricRow label="Lines added" value={`+${progress.linesAdded}`} good />
        <MetricRow label="Lines removed" value={`-${progress.linesRemoved}`} />
        <MetricRow label="Runtime" value={fmtMs(progress.runtimeMs)} />
        {progress.ghostTestStatus && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">Ghost test</span>
            <GhostBadge status={progress.ghostTestStatus} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 space-y-2">
        <button
          onClick={onViewDiff}
          className="w-full py-1.5 text-xs text-text-muted hover:text-text-secondary border border-white/[0.08] hover:border-white/[0.15] rounded-lg transition-colors"
        >
          View Diff
        </button>
        <button
          onClick={onPickWinner}
          disabled={applying}
          className="w-full py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5"
          style={{
            background: `${color}18`,
            border: `1px solid ${color}40`,
            color: color,
            opacity: applying ? 0.7 : 1,
          }}
        >
          {applying ? <><Spinner /> Applying…</> : <>👑 Pick Winner</>}
        </button>
      </div>
    </div>
  );
}

// ── History View ──────────────────────────────────────────────────────────────

function HistoryView({
  history,
  leaderboard,
}: {
  history: BattleRecord[];
  leaderboard: AgentLeaderboardEntry[];
}) {
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="p-6 space-y-6"
    >
      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">⚔️ Agent Leaderboard</h3>
          <div className="rounded-xl border border-white/[0.08] overflow-hidden divide-y divide-white/[0.04]">
            {leaderboard.map((entry, i) => {
              const config = AGENTS[entry.agentType];
              const color = AGENT_COLORS[entry.agentType];
              const total = entry.wins + entry.losses;
              const winRate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
              return (
                <div key={entry.agentType} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-base w-6">{medals[i] ?? `${i + 1}.`}</span>
                  <span style={{ color }}><AgentIcon type={entry.agentType} size={14} /></span>
                  <span className="text-sm text-text-primary flex-1">{config.displayName}</span>
                  <span className="text-xs text-green-400 font-medium">{entry.wins}W</span>
                  <span className="text-xs text-text-muted mx-1">/</span>
                  <span className="text-xs text-red-400 font-medium">{entry.losses}L</span>
                  <span className="text-xs text-text-muted ml-2">{winRate}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History list */}
      <div>
        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Past Battles</h3>
        {history.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">No battles yet. Start one!</p>
        ) : (
          <div className="space-y-3">
            {history.map((record) => (
              <BattleHistoryCard key={record.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function BattleHistoryCard({ record }: { record: BattleRecord }) {
  const winner = record.winnerSide !== null ? record.sides[record.winnerSide] : null;
  const loser = record.winnerSide !== null ? record.sides[record.winnerSide === 0 ? 1 : 0] : null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-primary font-medium leading-snug flex-1">"{record.task}"</p>
        <span className="text-xs text-text-muted shrink-0">{fmtDate(record.timestamp)}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        {winner && (
          <>
            <span className="text-yellow-400">👑 {AGENTS[winner.agentType].displayName}</span>
            <span>vs</span>
            <span>{loser ? AGENTS[loser.agentType].displayName : '?'}</span>
            <span className="mx-1">·</span>
            <span className="text-text-muted">
              Winner: {winner.filesModified} files, {fmtMs(winner.runtimeMs)}
              {winner.ghostTestStatus && <>, <GhostBadge status={winner.ghostTestStatus} /></>}
            </span>
          </>
        )}
        {record.winnerSide === null && <span className="text-text-muted">No winner selected</span>}
      </div>
    </div>
  );
}

// ── Diff Modal ────────────────────────────────────────────────────────────────

function DiffModal({
  agentType,
  content,
  loading,
  onClose,
}: {
  side: 0 | 1;
  agentType: AgentType;
  content: string;
  loading: boolean;
  onClose: () => void;
}) {
  const config = AGENTS[agentType];
  const color = AGENT_COLORS[agentType];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.97 }}
        className="relative z-10 w-full max-w-3xl mx-4 bg-bg-secondary border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <span style={{ color }}><AgentIcon type={agentType} size={13} /></span>
            <span className="text-sm font-semibold text-text-primary">{config.displayName} — Diff</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/5 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-text-muted text-sm gap-2">
              <Spinner /> Loading diff…
            </div>
          ) : (
            <DiffRenderer content={content} />
          )}
        </div>
      </motion.div>
    </div>
  );
}

function DiffRenderer({ content }: { content: string }) {
  const lines = content.split('\n');
  return (
    <div className="font-mono text-xs leading-relaxed overflow-x-auto">
      {lines.map((line, i) => {
        let className = 'px-4 py-0.5 block whitespace-pre';
        if (line.startsWith('+++') || line.startsWith('---')) {
          className += ' text-text-muted font-semibold';
        } else if (line.startsWith('+')) {
          className += ' bg-green-500/10 text-green-400';
        } else if (line.startsWith('-')) {
          className += ' bg-red-500/10 text-red-400';
        } else if (line.startsWith('@@')) {
          className += ' text-blue-400 bg-blue-500/5';
        } else {
          className += ' text-text-muted/60';
        }
        return <span key={i} className={className}>{line || ' '}</span>;
      })}
    </div>
  );
}

// ── Small shared components ───────────────────────────────────────────────────

function AgentPill({ agentType }: { agentType: AgentType }) {
  const config = AGENTS[agentType];
  const color = AGENT_COLORS[agentType];
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04]">
      <span style={{ color }}><AgentIcon type={agentType} size={13} /></span>
      <span className="text-sm font-medium text-text-primary">{config.displayName}</span>
    </div>
  );
}

function AgentSelector({
  value,
  onChange,
  exclude,
  agents,
}: {
  value: AgentType;
  onChange: (v: AgentType) => void;
  exclude: AgentType;
  agents: typeof AGENTS[AgentType][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AgentType)}
      className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent/40 cursor-pointer"
    >
      {agents.filter((a) => a.type !== exclude).map((a) => (
        <option key={a.type} value={a.type}>{a.displayName}</option>
      ))}
    </select>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-secondary font-mono">{value}</span>
    </div>
  );
}

function MetricRow({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span className={`font-mono font-medium ${good ? 'text-green-400' : 'text-text-secondary'}`}>{value}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
      <path d="M8 2a6 6 0 016 6" strokeLinecap="round" />
    </svg>
  );
}

function makeFreshProgress(): BattleSideProgressDTO {
  return {
    status: 'waiting',
    filesModified: 0,
    linesAdded: 0,
    linesRemoved: 0,
    runtimeMs: 0,
    log: [],
  };
}
