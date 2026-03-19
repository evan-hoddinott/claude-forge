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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative z-40 border-b border-white/[0.06] bg-white/[0.03] backdrop-blur-sm"
      >
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center gap-3">
          {/* Available state */}
          {status.status === 'available' && (
            <>
              <span className="text-xs text-accent-primary">&#x2B06;</span>
              <span className="text-xs text-text-secondary flex-1">
                {mode === 'simple' ? (
                  <>A new version of Claude Forge is ready!</>
                ) : (
                  <>v{status.version} available (current: v{status.currentVersion})</>
                )}
              </span>
              <div className="flex items-center gap-2">
                {status.releaseNotes && (
                  <button
                    onClick={() => setShowNotes((v) => !v)}
                    className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                  >
                    {showNotes ? 'Hide notes' : "What's new"}
                  </button>
                )}
                <button
                  onClick={() => api.updater.download()}
                  className="px-3 py-1 rounded-md bg-accent-primary/20 text-accent-primary text-xs font-medium hover:bg-accent-primary/30 transition-colors"
                >
                  Download Now
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="text-text-muted hover:text-text-secondary text-xs transition-colors"
                >
                  Later
                </button>
              </div>
            </>
          )}

          {/* Downloading state */}
          {status.status === 'downloading' && (
            <>
              <span className="text-xs text-accent-primary">&#x2B07;</span>
              <span className="text-xs text-text-secondary">
                Downloading update... {status.percent}%
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-accent-primary/60"
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
              <span className="text-xs text-status-ready">&#x2705;</span>
              <span className="text-xs text-text-secondary flex-1">
                {mode === 'simple' ? (
                  <>Update ready! Restart to get the latest version.</>
                ) : (
                  <>Update ready! Restart to apply v{status.version}.</>
                )}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => api.updater.install()}
                  className="px-3 py-1 rounded-md bg-status-ready/20 text-status-ready text-xs font-medium hover:bg-status-ready/30 transition-colors"
                >
                  Restart Now
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="text-text-muted hover:text-text-secondary text-xs transition-colors"
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
              className="overflow-hidden border-t border-white/[0.06]"
            >
              <div className="max-w-4xl mx-auto px-4 py-3">
                <pre className="text-xs text-text-muted whitespace-pre-wrap font-sans leading-relaxed">
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
