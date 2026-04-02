import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import type { UpdateStatus, AppMode } from '../../shared/types';

interface Props {
  mode: AppMode;
}

export default function UpdateNotification({ mode }: Props) {
  const api = useAPI();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    api.updater.onUpdateStatus((data) => {
      setStatus(data);
      // Show the banner again when a new update becomes available
      if (data.status === 'available' || data.status === 'ready') {
        setDismissed(false);
      }
    });
    return () => api.updater.offUpdateStatus();
  }, [api]);

  // Nothing to show
  if (!status || dismissed) return null;
  if (status.status === 'checking' || status.status === 'up-to-date' || status.status === 'error') return null;

  const btnBase =
    'px-3 py-1 border border-[var(--forge-border)] text-[10px] tracking-wide uppercase transition-colors';
  const btnPrimary = `${btnBase} bg-[var(--forge-accent-green)] text-[var(--forge-text-heading)] hover:bg-[var(--forge-accent-green-bright)]`;
  const btnGhost = `${btnBase} bg-transparent text-[var(--forge-text-secondary)] hover:text-[var(--forge-text-primary)] hover:border-[var(--forge-border-light)]`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-40 border-y-2 border-[var(--forge-border)]"
        style={{
          background: 'var(--forge-bg-surface)',
          fontFamily: 'var(--forge-font-body)',
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* Available state */}
          {status.status === 'available' && (
            <>
              <span
                className="text-xs"
                style={{ color: 'var(--forge-accent-green-bright)' }}
              >
                {'>>'}
              </span>
              <span
                className="text-[11px] flex-1"
                style={{ color: 'var(--forge-text-primary)' }}
              >
                {mode === 'simple' ? (
                  <>A new version of Claude Forge is ready!</>
                ) : (
                  <>Claude Forge v{status.version} available (current: v{status.currentVersion})</>
                )}
              </span>
              <div className="flex items-center gap-2">
                {status.releaseNotes && (
                  <button
                    onClick={() => setShowNotes((v) => !v)}
                    className={btnGhost}
                  >
                    {showNotes ? 'Hide notes' : "What's new"}
                  </button>
                )}
                <button
                  onClick={() => api.updater.download()}
                  className={btnPrimary}
                >
                  Download
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className={btnGhost}
                >
                  Later
                </button>
              </div>
            </>
          )}

          {/* Downloading state */}
          {status.status === 'downloading' && (
            <>
              <span
                className="text-xs"
                style={{ color: 'var(--forge-accent-amber-bright)' }}
              >
                {'<<'}
              </span>
              <span
                className="text-[11px]"
                style={{ color: 'var(--forge-text-primary)' }}
              >
                Downloading update... {status.percent}%
              </span>
              <div
                className="flex-1 h-2 overflow-hidden border border-[var(--forge-border)]"
                style={{ background: 'var(--forge-bg-deep)' }}
              >
                <motion.div
                  className="h-full"
                  style={{ background: 'var(--forge-accent-green)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${status.percent ?? 0}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </>
          )}

          {/* Ready to install */}
          {status.status === 'ready' && (
            <>
              <span
                className="text-xs"
                style={{ color: 'var(--forge-accent-green-bright)' }}
              >
                {'OK'}
              </span>
              <span
                className="text-[11px] flex-1"
                style={{ color: 'var(--forge-text-primary)' }}
              >
                {mode === 'simple' ? (
                  <>Update ready! Restart to get the latest version.</>
                ) : (
                  <>Update ready! Restart to apply v{status.version}.</>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => api.updater.install()}
                  className={btnPrimary}
                >
                  Restart Now
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className={btnGhost}
                >
                  Later
                </button>
              </div>
            </>
          )}
        </div>

        {/* Expandable release notes */}
        <AnimatePresence>
          {showNotes && status.releaseNotes && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-[var(--forge-border)]"
            >
              <div className="max-w-4xl mx-auto px-4 py-3">
                <pre
                  className="text-[11px] whitespace-pre-wrap leading-relaxed"
                  style={{
                    color: 'var(--forge-text-secondary)',
                    fontFamily: 'var(--forge-font-body)',
                  }}
                >
                  {status.releaseNotes}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Hook for the Settings page to access update status and controls.
 */
export function useUpdateStatus() {
  const api = useAPI();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    api.updater.onUpdateStatus((data) => {
      setStatus(data);
      if (data.status !== 'checking') {
        setLastChecked(new Date());
      }
    });
    return () => api.updater.offUpdateStatus();
  }, [api]);

  return {
    status,
    lastChecked,
    checkNow: () => api.updater.checkNow(),
    download: () => api.updater.download(),
    install: () => api.updater.install(),
  };
}
