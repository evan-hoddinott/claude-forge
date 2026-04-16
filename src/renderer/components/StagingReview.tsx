/**
 * StagingReview — chunk-level diff review UI
 *
 * Shows all uncommitted changes in a project, grouped by file and individual
 * hunk. The user can accept or reject each hunk independently, then commit
 * only the accepted chunks via shadow-git:apply-chunks.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { Project, FileDiff, DiffChunk } from '../../shared/types';

// ─── Acceptance state ─────────────────────────────────────────────────────────

type ChunkState = 'accepted' | 'rejected' | 'pending';
type AcceptanceMap = Record<string, ChunkState>; // chunk.id → state

function initAcceptance(diffs: FileDiff[]): AcceptanceMap {
  const map: AcceptanceMap = {};
  for (const f of diffs) {
    for (const c of f.chunks) {
      map[c.id] = 'pending';
    }
  }
  return map;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HunkLine({ line }: { line: string }) {
  const isAdded = line.startsWith('+') && !line.startsWith('+++');
  const isRemoved = line.startsWith('-') && !line.startsWith('---');
  const isHunkHeader = line.startsWith('@@');

  let cls = 'font-mono text-[11px] leading-relaxed px-3 whitespace-pre-wrap break-all';
  if (isAdded) cls += ' bg-green-500/10 text-green-300';
  else if (isRemoved) cls += ' bg-red-500/10 text-red-300';
  else if (isHunkHeader) cls += ' bg-white/[0.04] text-text-muted';
  else cls += ' text-text-secondary';

  return <div className={cls}>{line}</div>;
}

function ChunkRow({
  chunk,
  state,
  onAccept,
  onReject,
  onPending,
}: {
  chunk: DiffChunk;
  state: ChunkState;
  onAccept: () => void;
  onReject: () => void;
  onPending: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hunkLines = chunk.hunk.split('\n');

  const borderColor =
    state === 'accepted'
      ? 'border-green-500/40'
      : state === 'rejected'
        ? 'border-red-500/40 opacity-50'
        : 'border-white/[0.08]';

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${borderColor}`}>
      {/* Hunk header row */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border-b border-white/[0.06]">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-text-muted hover:text-text-secondary transition-colors shrink-0"
        >
          {expanded ? '▾' : '▸'}
        </button>
        <code className="text-[10px] text-text-muted truncate flex-1">
          {chunk.hunkHeader}
        </code>
        <span className="text-[10px] text-green-400/70 shrink-0">+{chunk.linesAdded}</span>
        <span className="text-[10px] text-red-400/70 shrink-0">-{chunk.linesRemoved}</span>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {state !== 'pending' && (
            <button
              onClick={onPending}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted hover:bg-white/[0.10] transition-colors"
              title="Reset"
            >
              ↩
            </button>
          )}
          <button
            onClick={onReject}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              state === 'rejected'
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : 'border-white/[0.10] text-text-muted hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30'
            }`}
          >
            Reject
          </button>
          <button
            onClick={onAccept}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              state === 'accepted'
                ? 'bg-green-500/20 border-green-500/40 text-green-300'
                : 'border-white/[0.10] text-text-muted hover:bg-green-500/10 hover:text-green-300 hover:border-green-500/30'
            }`}
          >
            Accept
          </button>
        </div>
      </div>

      {/* Diff content */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="max-h-64 overflow-y-auto">
              {hunkLines.slice(1).map((line, idx) => (
                <HunkLine key={idx} line={line} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FileSection({
  diff,
  acceptance,
  onChunkAccept,
  onChunkReject,
  onChunkPending,
  onAcceptAll,
  onRejectAll,
}: {
  diff: FileDiff;
  acceptance: AcceptanceMap;
  onChunkAccept: (id: string) => void;
  onChunkReject: (id: string) => void;
  onChunkPending: (id: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const totalAdded = diff.chunks.reduce((s, c) => s + c.linesAdded, 0);
  const totalRemoved = diff.chunks.reduce((s, c) => s + c.linesRemoved, 0);
  const acceptedCount = diff.chunks.filter((c) => acceptance[c.id] === 'accepted').length;
  const rejectedCount = diff.chunks.filter((c) => acceptance[c.id] === 'rejected').length;

  return (
    <div className="space-y-2">
      {/* File header */}
      <div className="flex items-center gap-2 py-1">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <span className="font-mono text-xs text-text-primary flex-1">{diff.filePath}</span>
        {diff.isNew && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">new</span>
        )}
        {diff.isDeleted && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">deleted</span>
        )}
        <span className="text-[10px] text-green-400/70">+{totalAdded}</span>
        <span className="text-[10px] text-red-400/70">-{totalRemoved}</span>
        <span className="text-[10px] text-text-muted">
          {acceptedCount}/{diff.chunks.length} accepted
          {rejectedCount > 0 && `, ${rejectedCount} rejected`}
        </span>
        <button
          onClick={onRejectAll}
          className="text-[10px] px-2 py-0.5 rounded border border-white/[0.08] text-text-muted hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/30 transition-colors"
        >
          Reject All
        </button>
        <button
          onClick={onAcceptAll}
          className="text-[10px] px-2 py-0.5 rounded border border-white/[0.08] text-text-muted hover:bg-green-500/10 hover:text-green-300 hover:border-green-500/30 transition-colors"
        >
          Accept All
        </button>
      </div>

      {/* Chunks */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2 pl-4"
          >
            {diff.chunks.map((chunk) => (
              <ChunkRow
                key={chunk.id}
                chunk={chunk}
                state={acceptance[chunk.id] ?? 'pending'}
                onAccept={() => onChunkAccept(chunk.id)}
                onReject={() => onChunkReject(chunk.id)}
                onPending={() => onChunkPending(chunk.id)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StagingReview({ project }: { project: Project }) {
  const api = useAPI();
  const { toast } = useToast();

  const {
    data: diffs,
    loading,
    refetch,
  } = useQuery<FileDiff[]>(
    () => api.shadowGit.getDiffChunks(project.path),
    [project.path],
  );

  const [acceptance, setAcceptance] = useState<AcceptanceMap>({});
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  // Initialize acceptance map when diffs load
  const allDiffs = diffs ?? [];
  const acceptanceWithDefaults: AcceptanceMap = {};
  for (const f of allDiffs) {
    for (const c of f.chunks) {
      acceptanceWithDefaults[c.id] = acceptance[c.id] ?? 'pending';
    }
  }

  const setChunkState = useCallback((id: string, state: ChunkState) => {
    setAcceptance((prev) => ({ ...prev, [id]: state }));
  }, []);

  const acceptAllChunks = useCallback((diff: FileDiff) => {
    setAcceptance((prev) => {
      const next = { ...prev };
      for (const c of diff.chunks) next[c.id] = 'accepted';
      return next;
    });
  }, []);

  const rejectAllChunks = useCallback((diff: FileDiff) => {
    setAcceptance((prev) => {
      const next = { ...prev };
      for (const c of diff.chunks) next[c.id] = 'rejected';
      return next;
    });
  }, []);

  const acceptAll = useCallback(() => {
    if (!diffs) return;
    setAcceptance(initAcceptance(diffs));
    setAcceptance((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = 'accepted';
      return next;
    });
  }, [diffs]);

  const rejectAll = useCallback(() => {
    if (!diffs) return;
    setAcceptance((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) next[k] = 'rejected';
      return next;
    });
  }, [diffs]);

  const acceptedIds = Object.entries(acceptanceWithDefaults)
    .filter(([, s]) => s === 'accepted')
    .map(([id]) => id);

  const handleCommit = async () => {
    if (acceptedIds.length === 0) {
      toast('No chunks accepted — select at least one chunk to commit.', 'error');
      return;
    }
    const msg = commitMsg.trim() || 'Selective staging commit (Claude Forge)';
    setCommitting(true);
    try {
      await api.shadowGit.applyChunks(project.path, acceptedIds, msg);
      toast(`Committed ${acceptedIds.length} chunk(s) successfully.`, 'success');
      setAcceptance({});
      setCommitMsg('');
      refetch();
    } catch (err) {
      toast(`Commit failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setCommitting(false);
    }
  };

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      const snap = await api.shadowGit.snapshot(project.path, 'Manual checkpoint');
      if (snap) {
        toast(`Checkpoint created: ${snap.gitTag}`, 'success');
      } else {
        toast('No changes to checkpoint.', 'info');
      }
      refetch();
    } catch (err) {
      toast(`Snapshot failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
    } finally {
      setSnapshotting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 rounded-lg bg-white/[0.04] animate-pulse" />
        ))}
      </div>
    );
  }

  const totalChunks = allDiffs.reduce((s, f) => s + f.chunks.length, 0);
  const pendingCount = Object.values(acceptanceWithDefaults).filter((s) => s === 'pending').length;
  const rejectedCount = Object.values(acceptanceWithDefaults).filter((s) => s === 'rejected').length;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
        <span className="text-sm font-semibold text-text-primary">Review Changes</span>
        {totalChunks > 0 && (
          <span className="text-xs text-text-muted">
            {allDiffs.length} file{allDiffs.length !== 1 ? 's' : ''} · {totalChunks} hunk{totalChunks !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-text-secondary hover:text-text-primary border border-white/[0.08] transition-all disabled:opacity-50"
        >
          <CheckpointIcon />
          {snapshotting ? 'Saving…' : 'Checkpoint'}
        </button>
        {totalChunks > 0 && (
          <>
            <button
              onClick={rejectAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-red-500/10 text-text-muted hover:text-red-300 border border-white/[0.06] hover:border-red-500/30 transition-all"
            >
              Reject All
            </button>
            <button
              onClick={acceptAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-green-500/10 text-text-muted hover:text-green-300 border border-white/[0.06] hover:border-green-500/30 transition-all"
            >
              Accept All
            </button>
          </>
        )}
      </div>

      {/* Content */}
      {allDiffs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <CheckIcon className="w-6 h-6 text-green-400/60" />
          </div>
          <p className="text-sm text-text-secondary">No uncommitted changes</p>
          <p className="text-xs text-text-muted max-w-xs">
            When agents modify files, their changes will appear here for you to review and selectively commit.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-text-muted hover:text-text-secondary border border-white/[0.06] transition-all"
          >
            Refresh
          </button>
        </div>
      ) : (
        <>
          {/* Diff list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {allDiffs.map((diff) => (
              <FileSection
                key={diff.filePath}
                diff={diff}
                acceptance={acceptanceWithDefaults}
                onChunkAccept={(id) => setChunkState(id, 'accepted')}
                onChunkReject={(id) => setChunkState(id, 'rejected')}
                onChunkPending={(id) => setChunkState(id, 'pending')}
                onAcceptAll={() => acceptAllChunks(diff)}
                onRejectAll={() => rejectAllChunks(diff)}
              />
            ))}
          </div>

          {/* Commit bar */}
          <div className="shrink-0 border-t border-white/[0.06] px-4 py-3 space-y-2">
            {/* Status summary */}
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="text-green-400">{acceptedIds.length} accepted</span>
              {rejectedCount > 0 && <span className="text-red-400">{rejectedCount} rejected</span>}
              {pendingCount > 0 && <span>{pendingCount} pending review</span>}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message (optional)"
                className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white/[0.05] border border-white/[0.08] text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) handleCommit();
                }}
              />
              <button
                onClick={handleCommit}
                disabled={committing || acceptedIds.length === 0}
                className="shrink-0 flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {committing ? (
                  <>
                    <SpinnerIcon className="w-3 h-3 animate-spin" />
                    Committing…
                  </>
                ) : (
                  <>
                    <CommitIcon />
                    Accept Selected &amp; Commit
                  </>
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function CheckpointIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
    </svg>
  );
}

function CommitIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <line x1="1" y1="8" x2="5" y2="8" />
      <line x1="11" y1="8" x2="15" y2="8" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-4 h-4'} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 4L6 11L3 8" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-4 h-4'} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M8 1.5A6.5 6.5 0 1 1 1.5 8" />
    </svg>
  );
}
