import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { GhostTestResult, GhostTestSettings, Project } from '../../shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

function friendlyError(result: GhostTestResult): string {
  const raw = (result.stderr || result.stdout || '').trim();
  if (!raw) return 'The code exited with an error but produced no output.';

  // Extract the most useful first line(s)
  const lines = raw.split('\n').filter(Boolean);

  // Common error patterns → plain English
  if (/SyntaxError/i.test(raw)) return `Syntax error in your code. ${lines[0]}`;
  if (/TypeError/i.test(raw)) return `Type error — a variable was the wrong type. ${lines[0]}`;
  if (/ReferenceError/i.test(raw)) return `Reference error — something was used before it was defined. ${lines[0]}`;
  if (/ModuleNotFoundError|Cannot find module/i.test(raw)) return `Missing dependency. Try running "npm install" or "pip install".`;
  if (/ENOENT/i.test(raw)) return `A file or directory was not found. ${lines[0]}`;
  if (/EACCES|Permission denied/i.test(raw)) return `Permission denied. The file or directory is not accessible.`;
  if (/failed to compile|Build failed/i.test(raw)) return `The code failed to compile. Check for syntax errors.`;
  if (/error\[E/i.test(raw)) return `Rust compile error. ${lines[0]}`;

  // Fallback: first two meaningful lines
  return lines.slice(0, 2).join(' ');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusIcon({ status }: { status: GhostTestResult['status'] | 'running' | null }) {
  if (status === 'running') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-4 h-4 rounded-full border-2 border-white/20 border-t-accent"
      />
    );
  }
  if (status === 'passed') return <span className="text-status-ready text-sm">✓</span>;
  if (status === 'auto-fixed') return <span className="text-status-ready text-sm">✓</span>;
  if (status === 'failed') return <span className="text-status-error text-sm">✗</span>;
  if (status === 'timeout') return <span className="text-yellow-400 text-sm">⏱</span>;
  return <span className="text-text-muted text-sm">○</span>;
}

function StatusLabel({ status, fixAttempts, fixDescription }: {
  status: GhostTestResult['status'] | 'running' | null;
  fixAttempts?: number;
  fixDescription?: string;
}) {
  if (status === 'running') return <span className="text-accent text-xs">Running…</span>;
  if (status === 'passed') return <span className="text-status-ready text-xs">Passed</span>;
  if (status === 'auto-fixed') {
    return (
      <span className="text-status-ready text-xs">
        {fixDescription ?? `Auto-fixed${fixAttempts ? ` (${fixAttempts} attempt${fixAttempts > 1 ? 's' : ''})` : ''}`}
      </span>
    );
  }
  if (status === 'failed') return <span className="text-status-error text-xs">Failed</span>;
  if (status === 'timeout') return <span className="text-yellow-400 text-xs">Timed out</span>;
  return <span className="text-text-muted text-xs">Not tested</span>;
}

function ResultRow({ result, onExpand }: { result: GhostTestResult; onExpand?: () => void }) {
  const [open, setOpen] = useState(false);
  const hasDetail = result.status === 'failed' || result.status === 'timeout';

  return (
    <div className="text-xs">
      <button
        onClick={() => { setOpen(!open); onExpand?.(); }}
        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
        disabled={!hasDetail && result.stdout === '' && result.stderr === ''}
      >
        <StatusIcon status={result.status} />
        <span className="text-text-muted shrink-0">{relativeTime(result.timestamp)}</span>
        <span className="font-mono text-text-secondary truncate">{result.command}</span>
        <span className="text-text-muted shrink-0">{formatDuration(result.duration)}</span>
        <StatusLabel
          status={result.status}
          fixAttempts={result.fixAttempts}
          fixDescription={result.fixDescription}
        />
        {(hasDetail || result.stdout || result.stderr) && (
          <svg
            className={`w-3 h-3 text-text-muted shrink-0 ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] space-y-2">
              {result.status === 'failed' && (
                <p className="text-text-secondary leading-relaxed">
                  {friendlyError(result)}
                </p>
              )}
              {result.stderr && (
                <pre className="font-mono text-[10px] text-status-error/80 leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {result.stderr}
                </pre>
              )}
              {result.stdout && !result.stderr && (
                <pre className="font-mono text-[10px] text-text-muted leading-relaxed whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                  {result.stdout}
                </pre>
              )}
              {result.fixDescription && (
                <p className="text-status-ready/80 text-[10px]">↑ {result.fixDescription}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------

function GhostTestSettings({
  settings,
  onSave,
}: {
  settings: GhostTestSettings;
  onSave: (s: GhostTestSettings) => void;
}) {
  const [local, setLocal] = useState(settings);
  const hasChanges = JSON.stringify(local) !== JSON.stringify(settings);

  return (
    <div className="space-y-4 pt-1">
      <label className="flex items-center justify-between gap-3 cursor-pointer">
        <span className="text-sm text-text-secondary">Enable Ghost Testing</span>
        <button
          onClick={() => setLocal((s) => ({ ...s, enabled: !s.enabled }))}
          className={`relative w-9 h-5 rounded-full transition-colors ${local.enabled ? 'bg-accent' : 'bg-white/10'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${local.enabled ? 'translate-x-4' : ''}`}
          />
        </button>
      </label>

      <div>
        <label className="block text-xs font-medium text-text-muted mb-1.5">
          Test command <span className="text-text-muted/60">(leave blank to auto-detect)</span>
        </label>
        <input
          value={local.customCommand}
          onChange={(e) => setLocal((s) => ({ ...s, customCommand: e.target.value }))}
          placeholder="npm test"
          className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Timeout (seconds)</label>
          <input
            type="number"
            min={5}
            max={300}
            value={local.timeoutSeconds}
            onChange={(e) => setLocal((s) => ({ ...s, timeoutSeconds: Math.max(5, Math.min(300, Number(e.target.value))) }))}
            className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-muted mb-1.5">Max auto-fix retries</label>
          <input
            type="number"
            min={0}
            max={5}
            value={local.maxRetries}
            onChange={(e) => setLocal((s) => ({ ...s, maxRetries: Math.max(0, Math.min(5, Number(e.target.value))) }))}
            className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {hasChanges && (
        <button
          onClick={() => onSave(local)}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all"
        >
          Save settings
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function GhostTestPanel({ project }: { project: Project }) {
  const api = useAPI();
  const { toast } = useToast();

  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const { data: history, refetch: refetchHistory } = useQuery(
    () => api.ghostTest.getHistory(project.id),
    [project.id],
  );
  const { data: settings, refetch: refetchSettings } = useQuery(
    () => api.ghostTest.getSettings(project.id),
    [project.id],
  );

  // Subscribe to progress events for this project
  useEffect(() => {
    api.ghostTest.onProgress((data) => {
      if (data.projectId === project.id) {
        setProgressMsg(data.message);
      }
    });
    return () => {
      api.ghostTest.offProgress();
    };
  }, [project.id]);

  const runTest = useMutation(async () => {
    setIsRunning(true);
    setProgressMsg('Starting…');
    try {
      const result = await api.ghostTest.run(
        project.id,
        project.path,
        project.preferredAgent || 'claude',
      );
      refetchHistory();

      if (result.status === 'passed') {
        toast('Ghost test passed', 'success');
      } else if (result.status === 'auto-fixed') {
        toast(`Ghost test passed — ${result.fixDescription}`, 'success');
      } else if (result.status === 'timeout') {
        toast('Ghost test timed out', 'info');
      } else {
        toast('Ghost test found issues', 'error');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Ghost test failed to run', 'error');
    } finally {
      setIsRunning(false);
      setProgressMsg('');
    }
  });

  const saveSettings = useCallback(async (s: GhostTestSettings) => {
    await api.ghostTest.updateSettings(project.id, s);
    refetchSettings();
    toast('Settings saved');
  }, [project.id]);

  const lastResult = history?.[0] ?? null;

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left group"
        >
          <svg
            className={`w-3.5 h-3.5 text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}
            viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"
          >
            <polyline points="4 6 8 10 12 6" />
          </svg>

          {/* Ghost icon */}
          <svg className="w-4 h-4 text-text-muted shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a5 5 0 00-5 5v7l1.5-1.5L6 13l1.5-1.5L9 13l1.5-1.5L12 13V6a5 5 0 00-4-4.9V1zM6 8a1 1 0 110-2 1 1 0 010 2zm4 0a1 1 0 110-2 1 1 0 010 2z" />
          </svg>

          <span className="text-sm font-semibold text-text-primary">Ghost Tests</span>

          {/* Last result badge */}
          {lastResult && (
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${
              lastResult.status === 'passed' || lastResult.status === 'auto-fixed'
                ? 'bg-status-ready/10 border-status-ready/25 text-status-ready'
                : lastResult.status === 'timeout'
                  ? 'bg-yellow-400/10 border-yellow-400/25 text-yellow-400'
                  : 'bg-status-error/10 border-status-error/25 text-status-error'
            }`}>
              {lastResult.status === 'passed' && '✓ All clear'}
              {lastResult.status === 'auto-fixed' && `✓ Auto-fixed`}
              {lastResult.status === 'failed' && '⚠ Issues found'}
              {lastResult.status === 'timeout' && '⏱ Timed out'}
            </span>
          )}

          {!lastResult && (
            <span className="ml-2 text-xs text-text-muted">Not tested yet</span>
          )}
        </button>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowSettings(!showSettings)}
            title="Ghost test settings"
            className="w-7 h-7 rounded-lg hover:bg-white/[0.06] flex items-center justify-center text-text-muted hover:text-text-secondary transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="2.5" />
              <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.2 3.2l.7.7M12.1 12.1l.7.7M3.2 12.8l.7-.7M12.1 3.9l.7-.7" strokeLinecap="round" />
            </svg>
          </button>

          <button
            onClick={() => runTest.mutate()}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-xs font-medium text-text-secondary hover:text-text-primary transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-3 h-3 rounded-full border border-white/20 border-t-accent"
                />
                {progressMsg || 'Running…'}
              </>
            ) : (
              <>
                <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M5 3l8 5-8 5V3z" />
                </svg>
                Run Now
              </>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-white/[0.06]"
          >
            {/* Settings panel */}
            <AnimatePresence>
              {showSettings && settings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden border-b border-white/[0.06] px-4 py-4"
                >
                  <GhostTestSettings
                    settings={settings}
                    onSave={saveSettings}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* History list */}
            <div className="px-1 py-1">
              {isRunning && (
                <div className="flex items-center gap-2 px-4 py-2 text-xs text-text-muted">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-3 h-3 rounded-full border border-white/20 border-t-accent shrink-0"
                  />
                  {progressMsg || 'Running test…'}
                </div>
              )}

              {!isRunning && (!history || history.length === 0) && (
                <div className="px-4 py-4 text-xs text-text-muted text-center">
                  No tests run yet. Click <strong>Run Now</strong> to ghost test this project.
                </div>
              )}

              {history && history.map((result) => (
                <ResultRow key={result.id} result={result} />
              ))}
            </div>

            {/* Failure guidance */}
            {lastResult?.status === 'failed' && !isRunning && (
              <div className="px-4 py-3 border-t border-white/[0.06] bg-status-error/5">
                <p className="text-xs text-text-secondary leading-relaxed mb-2">
                  <strong className="text-status-error">Issues found.</strong>{' '}
                  {friendlyError(lastResult)}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => runTest.mutate()}
                    disabled={isRunning}
                    className="px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-semibold transition-all disabled:opacity-50"
                  >
                    Let AI try again
                  </button>
                </div>
              </div>
            )}

            {lastResult?.status === 'timeout' && !isRunning && (
              <div className="px-4 py-3 border-t border-white/[0.06] bg-yellow-400/5">
                <p className="text-xs text-text-secondary leading-relaxed">
                  <strong className="text-yellow-400">Timed out.</strong>{' '}
                  The code took too long to run. This might be normal for your project,
                  or there might be an infinite loop. You can increase the timeout in settings.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact badge — for use in project cards and header
// ---------------------------------------------------------------------------

export function GhostTestBadge({ result }: { result: GhostTestResult | null | undefined }) {
  if (!result) return null;

  const configs = {
    passed: {
      cls: 'bg-status-ready/10 border-status-ready/20 text-status-ready',
      label: '✓ Ghost tested',
    },
    'auto-fixed': {
      cls: 'bg-status-ready/10 border-status-ready/20 text-status-ready',
      label: `✓ Auto-fixed`,
    },
    failed: {
      cls: 'bg-status-error/10 border-status-error/20 text-status-error',
      label: '⚠ Issues found',
    },
    timeout: {
      cls: 'bg-yellow-400/10 border-yellow-400/20 text-yellow-400',
      label: '⏱ Timed out',
    },
  };

  const cfg = configs[result.status];
  if (!cfg) return null;

  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.cls}`}
      title={`Ghost tested ${relativeTime(result.timestamp)}`}
    >
      {cfg.label}
    </span>
  );
}
