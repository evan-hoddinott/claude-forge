import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import type { DependencyStatus, SetupCheckResult } from '../../shared/types';

interface SetupAssistantProps {
  onComplete: () => void;
}

export default function SetupAssistant({ onComplete }: SetupAssistantProps) {
  const api = useAPI();
  const [checkResult, setCheckResult] = useState<SetupCheckResult | null>(null);
  const [checking, setChecking] = useState(true);
  const [installingDep, setInstallingDep] = useState<string | null>(null);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const result = await api.setup.checkDependencies();
      setCheckResult(result);
    } catch {
      // If check fails, show empty state
    } finally {
      setChecking(false);
    }
  }, [api]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  async function handleInstall(dep: DependencyStatus) {
    setInstallingDep(dep.command);
    try {
      if (checkResult?.platform === 'native-windows') {
        // Windows: open download page
        await api.system.openExternal(dep.installUrl);
      } else {
        // Linux/WSL: open download page (apt requires terminal + sudo which we can't do from Electron sandbox)
        await api.system.openExternal(dep.installUrl);
      }
    } catch {
      // ignore
    } finally {
      setInstallingDep(null);
    }
  }

  async function handleInstallWSL() {
    // This only applies on native Windows — open WSL docs
    await api.system.openExternal('https://learn.microsoft.com/en-us/windows/wsl/install');
  }

  async function handleFinish() {
    await api.preferences.update({ setupCompleted: true });
    onComplete();
  }

  const allInstalled = checkResult?.dependencies.every((d) => d.installed) ?? false;
  const missingCount = checkResult?.dependencies.filter((d) => !d.installed).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-lg mx-4"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
            <svg className="w-7 h-7 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-primary mb-2">
            Welcome to Claude Forge
          </h1>
          <p className="text-sm text-text-muted max-w-sm mx-auto">
            Let's make sure you have the tools needed for the best experience.
          </p>
        </div>

        {/* Dependencies card */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">
              Required Tools
            </h2>
            {checking && (
              <span className="text-xs text-text-muted animate-pulse">
                Checking...
              </span>
            )}
            {!checking && allInstalled && (
              <span className="text-xs text-status-ready font-medium">
                All set
              </span>
            )}
            {!checking && !allInstalled && missingCount > 0 && (
              <span className="text-xs text-amber-400 font-medium">
                {missingCount} missing
              </span>
            )}
          </div>

          <AnimatePresence mode="wait">
            {checking && !checkResult ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="p-5 space-y-4"
              >
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-16 rounded-lg bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="divide-y divide-white/[0.04]"
              >
                {checkResult?.dependencies.map((dep) => (
                  <DependencyRow
                    key={dep.command}
                    dep={dep}
                    installing={installingDep === dep.command}
                    onInstall={() => handleInstall(dep)}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* WSL recommendation (only on native Windows without WSL) */}
        {checkResult && checkResult.platform === 'native-windows' && !checkResult.wslAvailable && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4 rounded-xl bg-blue-500/[0.06] border border-blue-500/[0.12] p-4"
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-blue-300 font-medium mb-1">
                  WSL recommended
                </p>
                <p className="text-xs text-blue-300/70 mb-3">
                  Windows Subsystem for Linux is recommended for the best AI coding experience. It provides a native Linux environment with better performance for development tools.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleInstallWSL}
                    className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-xs font-medium text-blue-300 transition-colors"
                  >
                    Install WSL
                  </button>
                  <span className="text-xs text-blue-300/50">
                    or continue without it
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={handleFinish}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip setup
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={runCheck}
              disabled={checking}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors disabled:opacity-50"
            >
              {checking ? 'Checking...' : 'Check Again'}
            </button>
            <button
              onClick={handleFinish}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                allInstalled
                  ? 'bg-accent hover:bg-accent/90 text-white'
                  : 'bg-white/5 hover:bg-white/10 text-text-secondary'
              }`}
            >
              {allInstalled ? 'Get Started' : 'Continue Anyway'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function DependencyRow({
  dep,
  installing,
  onInstall,
}: {
  dep: DependencyStatus;
  installing: boolean;
  onInstall: () => void;
}) {
  return (
    <div className="px-5 py-3.5 flex items-center gap-4">
      {/* Status indicator */}
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        dep.installed ? 'bg-status-ready/10' : 'bg-white/[0.04]'
      }`}>
        {dep.installed ? (
          <svg className="w-4 h-4 text-status-ready" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg className="w-4 h-4 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{dep.name}</span>
          {dep.installed && dep.version && (
            <span className="text-xs text-text-muted">
              {dep.version.match(/(\d+\.\d+\.\d+)/)?.[1] ?? dep.version}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">{dep.description}</p>
      </div>

      {/* Action */}
      {!dep.installed && (
        <button
          onClick={onInstall}
          disabled={installing}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-xs font-medium text-accent transition-colors disabled:opacity-50"
        >
          {installing ? 'Opening...' : 'Install'}
        </button>
      )}
    </div>
  );
}
