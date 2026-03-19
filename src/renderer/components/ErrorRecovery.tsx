import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types — mirrors the main-process error-recovery service shape
// ---------------------------------------------------------------------------

export interface RecoveryAction {
  label: string;
  actionId: string;
  variant: 'primary' | 'secondary';
}

export interface ErrorInfo {
  userMessage: string;
  technicalDetails?: string;
  actions: RecoveryAction[];
  blocking?: boolean;
}

interface ErrorRecoveryProps {
  error: ErrorInfo;
  onAction: (actionId: string) => void;
  onDismiss?: () => void;
  recovering?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ErrorRecovery({
  error,
  onAction,
  onDismiss,
  recovering = false,
}: ErrorRecoveryProps) {
  const [showDetails, setShowDetails] = useState(false);

  const bgColor = error.blocking
    ? 'bg-status-error/8 border-status-error/20'
    : 'bg-amber-500/8 border-amber-500/20';
  const iconColor = error.blocking ? 'text-status-error' : 'text-amber-400';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.97 }}
      className={`rounded-xl border p-4 ${bgColor}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 ${iconColor}`}>
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary">
            Something went wrong
          </p>
          <p className="text-sm text-text-secondary mt-1">
            {error.userMessage}
          </p>

          {/* Actions */}
          {error.actions.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {error.actions.map((action) => (
                <button
                  key={action.actionId}
                  onClick={() => onAction(action.actionId)}
                  disabled={recovering}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                    action.variant === 'primary'
                      ? 'bg-accent hover:bg-accent-hover text-bg'
                      : 'bg-white/5 hover:bg-white/10 text-text-secondary'
                  }`}
                >
                  {recovering ? 'Working...' : action.label}
                </button>
              ))}
            </div>
          )}

          {/* Technical details toggle */}
          {error.technicalDetails && (
            <div className="mt-3">
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
              >
                <motion.svg
                  animate={{ rotate: showDetails ? 90 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-3 h-3"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <polyline points="4 2 8 6 4 10" />
                </motion.svg>
                Show technical details
              </button>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <pre className="mt-2 p-2.5 rounded-md bg-black/20 border border-white/6 text-[10px] font-mono text-text-muted whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                      {error.technicalDetails}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors"
          >
            <svg
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Auto-fix toast — shown when an error was fixed automatically
// ---------------------------------------------------------------------------

export function AutoFixToast({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="px-4 py-2.5 rounded-lg bg-status-ready/10 border border-status-ready/20 text-sm text-status-ready flex items-center gap-2"
    >
      <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 8 6.5 11.5 13 5" />
      </svg>
      {message}
    </motion.div>
  );
}
