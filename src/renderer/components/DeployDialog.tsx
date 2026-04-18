import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { DeployStep, DeployResult, Project } from '../../shared/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type DeployMode = 'create' | 'push';

interface Props {
  project: Project;
  onClose: () => void;
  onSuccess?: (repoUrl?: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sanitizeRepoName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_.]/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

function StepIcon({ status }: { status: DeployStep['status'] }) {
  if (status === 'done') {
    return (
      <span className="w-5 h-5 rounded-full bg-status-ready/20 text-status-ready flex items-center justify-center text-xs">✓</span>
    );
  }
  if (status === 'error') {
    return (
      <span className="w-5 h-5 rounded-full bg-status-error/20 text-status-error flex items-center justify-center text-xs">✗</span>
    );
  }
  if (status === 'running') {
    return (
      <span className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
    );
  }
  // pending
  return (
    <span className="w-5 h-5 rounded-full border border-white/[0.12] bg-white/[0.03]" />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeployDialog({ project, onClose, onSuccess }: Props) {
  const api = useAPI();
  const { toast } = useToast();

  const [mode, setMode] = useState<DeployMode>('create');
  const [repoName, setRepoName] = useState(sanitizeRepoName(project.name));
  const [isPrivate, setIsPrivate] = useState(true);
  const [description, setDescription] = useState(project.description ?? '');
  const [repoUrl, setRepoUrl] = useState(project.githubUrl ?? '');
  const [includeContextFiles, setIncludeContextFiles] = useState(true);
  const [includeEnvFiles, setIncludeEnvFiles] = useState(false);
  const [commitMessage, setCommitMessage] = useState('Initial commit from Caboo');

  const [deploying, setDeploying] = useState(false);
  const [steps, setSteps] = useState<DeployStep[]>([]);
  const [result, setResult] = useState<DeployResult | null>(null);
  const [conflictPending, setConflictPending] = useState(false);
  const [forcePushing, setForcePushing] = useState(false);

  const listenerRef = useRef(false);

  // Subscribe to deploy events
  useEffect(() => {
    if (!listenerRef.current) {
      listenerRef.current = true;
      api.deploy.onProgress((data) => {
        const s = data as DeployStep;
        setSteps((prev) => {
          const idx = prev.findIndex((x) => x.id === s.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = s;
            return next;
          }
          return [...prev, s];
        });
      });
      api.deploy.onDone((data) => {
        const r = data as DeployResult;
        setResult(r);
        setDeploying(false);
        if (!r.success && r.error === 'CONFLICT') {
          setConflictPending(true);
        }
        if (r.success) {
          onSuccess?.(r.repoUrl);
        }
      });
    }
    return () => {
      api.deploy.offProgress();
      api.deploy.offDone();
      listenerRef.current = false;
    };
  }, []);

  const STEP_LABELS: Record<string, string> = {
    init: 'Setting up version history',
    gitignore: 'Preparing your files',
    stage: 'Staging files',
    commit: 'Saving a snapshot of your work',
    remote: mode === 'create' ? 'Creating online copy' : 'Connecting to repository',
    upload: 'Uploading to GitHub',
  };

  async function handleDeploy() {
    setDeploying(true);
    setSteps([]);
    setResult(null);
    setConflictPending(false);

    try {
      await api.deploy.start({
        projectPath: project.path,
        projectId: project.id,
        mode,
        repoName: mode === 'create' ? repoName : undefined,
        isPrivate: mode === 'create' ? isPrivate : undefined,
        description: mode === 'create' ? description : undefined,
        repoUrl: mode === 'push' ? repoUrl : undefined,
        includeContextFiles,
        includeEnvFiles,
        commitMessage,
      });
    } catch (err) {
      setDeploying(false);
      toast(err instanceof Error ? err.message : 'Deploy failed', 'error');
    }
  }

  async function handleForcePush() {
    setForcePushing(true);
    setConflictPending(false);
    try {
      const r = await api.deploy.forcePush(project.path);
      if (r.success) {
        setResult({ success: true, repoUrl: r.repoUrl ?? repoUrl });
        onSuccess?.(r.repoUrl ?? repoUrl);
      } else {
        setResult({ success: false, error: r.error ?? 'Force push failed' });
      }
    } catch (err) {
      setResult({ success: false, error: err instanceof Error ? err.message : 'Force push failed' });
    } finally {
      setForcePushing(false);
    }
  }

  const isDeploying = deploying || forcePushing;
  const isDone = result?.success === true;
  const isFailed = result?.success === false && !conflictPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!isDeploying ? onClose : undefined}
      />

      {/* Dialog */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="relative w-full max-w-lg mx-4 rounded-2xl bg-bg border border-white/[0.08] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-text-muted" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <h2 className="text-sm font-semibold text-text-primary">Deploy to GitHub</h2>
          </div>
          {!isDeploying && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors p-1"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Show deploy form only when not in progress */}
          {!deploying && !result && !conflictPending && (
            <>
              {/* Mode selector */}
              <div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={mode === 'create'}
                      onChange={() => setMode('create')}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-primary">Create new repository</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={mode === 'push'}
                      onChange={() => setMode('push')}
                      className="accent-accent"
                    />
                    <span className="text-sm text-text-primary">Push to existing</span>
                  </label>
                </div>
              </div>

              {/* Create form */}
              {mode === 'create' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Repository name</label>
                    <input
                      value={repoName}
                      onChange={(e) => setRepoName(sanitizeRepoName(e.target.value))}
                      className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Visibility</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={isPrivate} onChange={() => setIsPrivate(true)} className="accent-accent" />
                        <span className="text-sm text-text-secondary">Private</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" checked={!isPrivate} onChange={() => setIsPrivate(false)} className="accent-accent" />
                        <span className="text-sm text-text-secondary">Public</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-muted mb-1.5">Description (optional)</label>
                    <input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of your project"
                      className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Push form */}
              {mode === 'push' && (
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1.5">Repository URL</label>
                  <input
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/user/repo"
                    className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                  />
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-white/[0.06]" />

              {/* Options */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-text-muted mb-2">What to deploy</p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={true}
                    readOnly
                    disabled
                    className="rounded border-white/20 bg-white/5 accent-accent"
                  />
                  <span className="text-sm text-text-secondary">All project files</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeContextFiles}
                    onChange={(e) => setIncludeContextFiles(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 accent-accent"
                  />
                  <span className="text-sm text-text-secondary">Include context files (CLAUDE.md, etc.)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeEnvFiles}
                    onChange={(e) => setIncludeEnvFiles(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 accent-accent"
                  />
                  <span className="text-sm text-text-secondary">
                    Include .env files
                  </span>
                  {includeEnvFiles && (
                    <span className="text-xs text-yellow-400">⚠ may contain secrets</span>
                  )}
                </label>
              </div>

              {/* Commit message */}
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Commit message</label>
                <input
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
            </>
          )}

          {/* Progress view */}
          {(deploying || (steps.length > 0 && !result)) && (
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {steps.map((s) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3"
                  >
                    <StepIcon status={s.status} />
                    <span className={`text-sm ${
                      s.status === 'done' ? 'text-text-primary' :
                      s.status === 'running' ? 'text-text-primary font-medium' :
                      s.status === 'error' ? 'text-status-error' :
                      'text-text-muted'
                    }`}>
                      {STEP_LABELS[s.id] ?? s.label}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Success */}
          {result?.success && (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-status-ready/10 border border-status-ready/20">
                <span className="text-status-ready text-lg mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Your project is live!</p>
                  {result.repoUrl && (
                    <button
                      onClick={() => window.open(result.repoUrl, '_blank')}
                      className="text-xs text-accent hover:text-accent-hover mt-1 font-mono"
                    >
                      {result.repoUrl}
                    </button>
                  )}
                </div>
              </div>
              {/* Show all completed steps */}
              {steps.length > 0 && (
                <div className="space-y-1.5">
                  {steps.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <span className="text-status-ready text-xs">✓</span>
                      <span className="text-xs text-text-secondary">{STEP_LABELS[s.id] ?? s.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Conflict */}
          {conflictPending && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
                <p className="text-sm font-semibold text-text-primary mb-1">
                  The remote has changes not in your local copy
                </p>
                <p className="text-xs text-text-secondary">
                  Force pushing will overwrite the remote history with your local changes.
                  This cannot be undone.
                </p>
              </div>
            </div>
          )}

          {/* Error (non-conflict) */}
          {isFailed && (
            <div className="p-4 rounded-xl bg-status-error/10 border border-status-error/20">
              <p className="text-sm font-semibold text-status-error mb-1">Deploy failed</p>
              <p className="text-xs text-text-secondary font-mono">{result?.error}</p>
              {result?.error === 'REPO_EXISTS' && (
                <p className="text-xs text-text-muted mt-1">
                  Try a different repository name.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-white/[0.06]">
          <button
            onClick={onClose}
            disabled={isDeploying}
            className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary disabled:opacity-40 transition-colors"
          >
            {isDone ? 'Close' : 'Cancel'}
          </button>

          <div className="flex items-center gap-2">
            {conflictPending && (
              <button
                onClick={handleForcePush}
                disabled={forcePushing}
                className="px-4 py-2 rounded-lg bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border border-yellow-400/30 text-sm font-semibold disabled:opacity-50 transition-all"
              >
                {forcePushing ? 'Pushing…' : 'Force Push'}
              </button>
            )}
            {!isDone && !conflictPending && (
              <button
                onClick={isFailed ? handleDeploy : handleDeploy}
                disabled={isDeploying || (mode === 'create' && !repoName.trim()) || (mode === 'push' && !repoUrl.trim())}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-bg text-sm font-semibold transition-all"
              >
                {isDeploying ? (
                  <>
                    <span className="w-3 h-3 border-2 border-bg/40 border-t-bg rounded-full animate-spin" />
                    Deploying…
                  </>
                ) : isFailed ? (
                  'Try Again'
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                    </svg>
                    Deploy Now
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
