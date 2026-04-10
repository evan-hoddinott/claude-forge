import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { Project } from '../../shared/types';

interface Props {
  project: Project;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '< 1 KB';
  if (bytes < 1024 * 1024) return `~${Math.round(bytes / 1024)} KB`;
  return `~${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function ExportSnapshotDialog({ project, onClose }: Props) {
  const api = useAPI();
  const { toast } = useToast();

  const [includeSource, setIncludeSource] = useState(true);
  const [includeGit, setIncludeGit] = useState(true);
  const [includeVibe, setIncludeVibe] = useState(true);
  const [includeChatHistory, setIncludeChatHistory] = useState(false);
  const [includeApiKeys, setIncludeApiKeys] = useState(false);

  const [estimatedSize, setEstimatedSize] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEstimating(true);
    setEstimatedSize(null);
    api.snapshot.estimateSize(project.id, includeSource, includeGit)
      .then((size) => { if (!cancelled) setEstimatedSize(size); })
      .catch(() => { if (!cancelled) setEstimatedSize(null); })
      .finally(() => { if (!cancelled) setEstimating(false); });
    return () => { cancelled = true; };
  }, [api, project.id, includeSource, includeGit]);

  async function handleExport() {
    setExporting(true);
    try {
      const result = await api.snapshot.export({
        projectId: project.id,
        includeSource,
        includeGit,
        includeVibe,
        includeChatHistory,
        includeApiKeys,
      });
      if (result) {
        setExported(result);
        toast('Snapshot exported successfully');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-md mx-4 rounded-xl bg-surface border border-white/[0.1] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <SnapshotIcon />
              <h2 className="text-base font-semibold text-text-primary">Export Project Snapshot</h2>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {exported ? (
              <SuccessState filePath={exported} onClose={onClose} />
            ) : (
              <>
                <p className="text-xs text-text-muted leading-relaxed">
                  A <span className="font-mono text-accent">.cfsnap</span> archive captures
                  everything — code, git history, AI context, and chat. Hand a friend the
                  whole project so they can pick up exactly where you left off.
                </p>

                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">What to include</p>
                  <div className="space-y-2.5">
                    <Checkbox
                      checked={includeSource}
                      onChange={setIncludeSource}
                      label="Source code"
                      detail="All project files, respecting .gitignore"
                    />
                    <Checkbox
                      checked={includeGit}
                      onChange={setIncludeGit}
                      label="Git history"
                      detail="Full commit history as a git bundle"
                    />
                    <Checkbox
                      checked={includeVibe}
                      onChange={setIncludeVibe}
                      label="AI context files (.vibe bundle)"
                      detail="CLAUDE.md, GEMINI.md, and other agent context"
                    />
                    <Checkbox
                      checked={includeChatHistory}
                      onChange={setIncludeChatHistory}
                      label="Chat history"
                      detail="All AI chat messages for this project"
                    />
                    <Checkbox
                      checked={includeApiKeys}
                      onChange={setIncludeApiKeys}
                      label={
                        <span className="flex items-center gap-1.5">
                          API keys
                          <span className="text-[10px] text-amber-400/80 font-medium px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                            ⚠ sensitive
                          </span>
                        </span>
                      }
                      detail="Vault entries — recipient will have access to your keys"
                    />
                  </div>
                </div>

                <div className="border-t border-white/[0.06]" />

                {/* Security note */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <span className="text-text-muted mt-0.5 shrink-0">
                    <ShieldIcon />
                  </span>
                  <p className="text-xs text-text-muted leading-relaxed">
                    <span className="text-text-secondary font-medium">.env files are never included.</span>{' '}
                    Absolute paths are stripped from context files. Git history is included
                    as-is — review for secrets before sharing.
                  </p>
                </div>

                {/* Estimated size */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Estimated size</span>
                  <span className="text-text-secondary font-mono">
                    {estimating ? (
                      <span className="text-text-muted animate-pulse">calculating…</span>
                    ) : estimatedSize !== null ? (
                      formatBytes(estimatedSize)
                    ) : (
                      '—'
                    )}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!exported && (
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || (!includeSource && !includeGit && !includeVibe && !includeChatHistory)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-bg/40 border-t-bg animate-spin" />
                    Exporting…
                  </>
                ) : (
                  <>
                    <SnapshotIcon small />
                    Export Snapshot
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
  label,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  detail?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group" onClick={() => onChange(!checked)}>
      <div
        className={`mt-0.5 w-4 h-4 rounded border transition-colors flex-shrink-0 flex items-center justify-center ${
          checked
            ? 'bg-accent border-accent'
            : 'border-white/[0.2] bg-transparent group-hover:border-white/[0.35]'
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-bg" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5 5 4 7.5 8.5 2.5" />
          </svg>
        )}
      </div>
      <div>
        <div className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{label}</div>
        {detail && <div className="text-xs text-text-muted mt-0.5">{detail}</div>}
      </div>
    </label>
  );
}

function SuccessState({ filePath, onClose }: { filePath: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-6 text-center"
    >
      <div className="text-3xl mb-3">📸</div>
      <p className="text-base font-semibold text-text-primary mb-1">Snapshot Exported!</p>
      <p className="text-xs text-text-muted mb-4">Share it with anyone — they get the code, history, AI context, and chats.</p>
      <p className="text-xs text-text-secondary font-mono bg-bg rounded-lg px-3 py-2 mb-5 break-all">{filePath}</p>
      <button
        onClick={onClose}
        className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
      >
        Done
      </button>
    </motion.div>
  );
}

function SnapshotIcon({ small }: { small?: boolean }) {
  const cls = small ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
      <path d="M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M11.1 4.9l1.4-1.4M3.5 12.5l1.4-1.4" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1L2 3.5v4C2 11 5 13.5 8 15c3-1.5 6-4 6-7.5v-4L8 1z" />
      <polyline points="5.5 8 7 9.5 10.5 6" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}
