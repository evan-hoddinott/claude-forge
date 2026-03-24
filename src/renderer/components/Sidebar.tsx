import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Page } from '../App';
import type { GhAuthStatus, AgentStatus, AgentType, AppMode } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { useAPI, useQuery } from '../hooks/useAPI';
import { setMode as setLanguageMode } from '../utils/language';
import { useVisibleInterval, useDeferredInit } from '../hooks/usePerformance';
import { useTheme } from '../contexts/ThemeContext';
import ForgeFire from './retro/ForgeFire';
import ForgeCounter from './retro/ForgeCounter';
import AsciiDivider from './retro/AsciiDivider';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewProject: () => void;
}

// ---------------------------------------------------------------------------
// Nav item
// ---------------------------------------------------------------------------

function NavItem({
  icon,
  label,
  active,
  onClick,
  collapsed,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-white/8 text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      <span className="shrink-0 w-5 h-5 flex items-center justify-center">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

// ---------------------------------------------------------------------------
// GitHub icon (octocat)
// ---------------------------------------------------------------------------

const GitHubIcon = (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Agent brand icons
// ---------------------------------------------------------------------------

function AgentIcon({ agentType, className }: { agentType: AgentType; className?: string }) {
  const cls = className || 'w-4 h-4';
  switch (agentType) {
    case 'claude':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <polyline points="4 7 6 9 4 11" />
          <line x1="8" y1="11" x2="12" y2="11" />
        </svg>
      );
    case 'gemini':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C8 4.42 4.42 8 0 8c4.42 0 8 3.58 8 8 0-4.42 3.58-8 8-8-4.42 0-8-3.58-8-8z" />
        </svg>
      );
    case 'codex':
      return (
        <svg className={cls} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0L14.93 4v8L8 16 1.07 12V4L8 0zm0 1.6L2.47 4.8v6.4L8 14.4l5.53-3.2V4.8L8 1.6z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Refresh icon
// ---------------------------------------------------------------------------

function RefreshButton({ onClick, spinning }: { onClick: () => void; spinning: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="p-0.5 rounded text-text-muted hover:text-text-secondary transition-colors"
      title="Refresh status"
    >
      <motion.svg
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : { duration: 0 }}
        className="w-3 h-3"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M2 8a6 6 0 0110.47-4M14 8a6 6 0 01-10.47 4" />
        <polyline points="2 4 2 8 6 8" />
        <polyline points="14 12 14 8 10 8" />
      </motion.svg>
    </button>
  );
}

// ---------------------------------------------------------------------------
// GitHub tab content
// ---------------------------------------------------------------------------

function GitHubTab({ collapsed, expanded, onToggle }: { collapsed: boolean; expanded: boolean; onToggle: () => void }) {
  const api = useAPI();
  const [auth, setAuth] = useState<GhAuthStatus | null>(null);
  const [repoCount, setRepoCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loginState, setLoginState] = useState<'idle' | 'waiting' | 'polling'>('idle');
  const [deviceCode, setDeviceCode] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAuth = useCallback(async () => {
    setRefreshing(true);
    try {
      const status = await api.github.checkAuth();
      setAuth(status);
      if (status.authenticated) {
        api.github.repoCount().then(setRepoCount).catch(() => undefined);
      }
    } catch {
      setAuth({ authenticated: false, username: '', ghInstalled: false });
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  // Initial check deferred by 3s to not block startup
  useDeferredInit(3000, checkAuth);

  // Only poll when app is visible
  useVisibleInterval(checkAuth, 60000);

  // Cleanup login polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleLogin() {
    setLoginState('waiting');
    const result = await api.github.loginStart();
    if ('error' in result) {
      setLoginState('idle');
      return;
    }
    setDeviceCode(result.code);
    setLoginState('polling');

    pollRef.current = setInterval(async () => {
      const status = await api.github.checkAuth();
      if (status.authenticated) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        setAuth(status);
        setLoginState('idle');
        setDeviceCode('');
        api.github.repoCount().then(setRepoCount).catch(() => undefined);
      }
    }, 3000);
  }

  async function handleLogout() {
    await api.github.logout();
    setAuth({ authenticated: false, username: '', ghInstalled: auth?.ghInstalled ?? false });
    setRepoCount(null);
  }

  function handleInstall() {
    api.system.openExternal('https://cli.github.com');
  }

  const isConnected = auth?.authenticated ?? false;

  return (
    <div>
      <button
        onClick={() => !collapsed && onToggle()}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          expanded && !collapsed
            ? 'bg-white/[0.04]'
            : 'hover:bg-white/[0.03]'
        }`}
      >
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-text-muted">
          {GitHubIcon}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-xs font-medium text-text-secondary truncate">
              GitHub
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isConnected ? 'bg-status-ready' : 'bg-white/20'
              }`}
            />
          </>
        )}
        {collapsed && (
          <span
            className={`absolute left-11 w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-status-ready' : 'bg-white/20'
            }`}
          />
        )}
      </button>

      <AnimatePresence>
        {expanded && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 pt-1 space-y-2">
              {!auth && (
                <div className="text-xs text-text-muted py-1">Checking...</div>
              )}

              {auth && !auth.ghInstalled && (
                <div className="space-y-2">
                  <p className="text-xs text-text-muted">GitHub CLI required</p>
                  <button
                    onClick={handleInstall}
                    className="w-full px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/8 border border-white/6 text-xs font-medium text-text-secondary transition-colors"
                  >
                    Install GitHub CLI
                  </button>
                </div>
              )}

              {auth?.ghInstalled && auth.authenticated && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={`https://github.com/${auth.username}.png?size=32`}
                      alt=""
                      className="w-6 h-6 rounded-full bg-white/5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-text-primary truncate">
                        @{auth.username}
                      </p>
                      {repoCount !== null && (
                        <p className="text-[10px] text-text-muted">
                          {repoCount} {repoCount === 1 ? 'repo' : 'repos'}
                        </p>
                      )}
                    </div>
                    <RefreshButton onClick={checkAuth} spinning={refreshing} />
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {auth?.ghInstalled && !auth.authenticated && loginState === 'idle' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted">Not connected</p>
                    <RefreshButton onClick={checkAuth} spinning={refreshing} />
                  </div>
                  <button
                    onClick={handleLogin}
                    className="w-full px-3 py-1.5 rounded-md bg-accent/10 hover:bg-accent/15 border border-accent/20 text-xs font-medium text-accent transition-colors"
                  >
                    Connect GitHub
                  </button>
                </div>
              )}

              {loginState === 'waiting' && (
                <div className="flex items-center gap-2 py-1">
                  <Spinner />
                  <p className="text-xs text-text-muted">Starting login...</p>
                </div>
              )}

              {loginState === 'polling' && deviceCode && (
                <div className="space-y-2">
                  <p className="text-[10px] text-text-muted">Enter this code on GitHub:</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-center">
                      <span className="text-sm font-mono font-bold text-accent tracking-wider">
                        {deviceCode}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(deviceCode);
                      }}
                      className="px-2 py-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/8 text-[10px] font-medium text-text-secondary transition-colors shrink-0"
                      title="Copy code"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    onClick={() => api.system.openExternal('https://github.com/login/device')}
                    className="w-full px-3 py-1.5 rounded-md bg-accent/10 hover:bg-accent/15 border border-accent/20 text-xs font-medium text-accent transition-colors"
                  >
                    Open GitHub in Browser
                  </button>
                  <div className="flex items-center gap-2">
                    <Spinner size="xs" />
                    <p className="text-[10px] text-text-muted">Waiting for authorization...</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Spinner helper
// ---------------------------------------------------------------------------

function Spinner({ size = 'sm' }: { size?: 'sm' | 'xs' }) {
  const cls = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      className={`${cls} border border-white/10 border-t-accent rounded-full shrink-0`}
    />
  );
}

// ---------------------------------------------------------------------------
// Single agent card (accordion-style)
// ---------------------------------------------------------------------------

function AgentCard({
  agentType,
  collapsed,
  statuses,
  onRefresh,
  refreshing,
  expanded,
  onToggle,
}: {
  agentType: AgentType;
  collapsed: boolean;
  statuses: Record<AgentType, AgentStatus> | null;
  onRefresh: () => void;
  refreshing: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const api = useAPI();
  const config = AGENTS[agentType];
  const status = statuses?.[agentType] ?? null;
  const [installing, setInstalling] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [installError, setInstallError] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [installLog]);

  async function handleInstall() {
    setInstalling(true);
    setInstallLog([]);
    setInstallError('');

    api.agent.onInstallProgress(({ line }) => {
      setInstallLog(prev => [...prev.slice(-50), line]);
    });

    const result = await api.agent.install(agentType);
    api.agent.offInstallProgress();
    setInstalling(false);

    if (result.success) {
      onRefresh();
    } else {
      setInstallError(result.error || 'Installation failed');
    }
  }

  async function handleUpdate() {
    setUpdating(true);
    setInstallLog([]);
    setInstallError('');

    api.agent.onInstallProgress(({ line }) => {
      setInstallLog(prev => [...prev.slice(-50), line]);
    });

    const result = await api.agent.update(agentType);
    api.agent.offInstallProgress();
    setUpdating(false);

    if (result.success) {
      setInstallLog([]);
      onRefresh();
    } else {
      setInstallError(result.error || 'Update failed');
    }
  }

  async function handleLogin() {
    await api.agent.login(agentType);
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const s = await api.agent.checkFullStatus(agentType);
      if (s.authenticated || attempts > 60) {
        clearInterval(poll);
        onRefresh();
      }
    }, 3000);
  }

  function handleOpenDocs() {
    api.system.openExternal(config.docsUrl);
  }

  function handleGetSubscription() {
    api.system.openExternal(config.subscriptionUrl);
  }

  function handleInstallNode() {
    api.system.openExternal('https://nodejs.org');
  }

  const isOk = status?.installed && status?.authenticated;
  const needsAction = status?.installed && !status?.authenticated;

  const dotColor = !status
    ? 'bg-white/20'
    : isOk
      ? 'bg-status-ready'
      : needsAction
        ? 'bg-status-in-progress'
        : status.installed
          ? 'bg-status-ready'
          : 'bg-status-error';

  return (
    <div>
      <button
        onClick={() => !collapsed && onToggle()}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
          expanded && !collapsed
            ? 'bg-white/[0.04]'
            : 'hover:bg-white/[0.03]'
        }`}
      >
        <span
          className="shrink-0 w-5 h-5 flex items-center justify-center"
          style={{ color: config.color }}
        >
          <AgentIcon agentType={agentType} />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-xs font-medium text-text-secondary truncate">
              {config.displayName}
            </span>
            {status?.version && (
              <span className="text-[9px] text-text-muted font-mono mr-1 truncate max-w-[50px]">
                {status.version.match(/(\d+\.\d+\.\d+)/)?.[1] ?? ''}
              </span>
            )}
            <motion.span
              key={dotColor}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`}
            />
          </>
        )}
        {collapsed && (
          <motion.span
            key={dotColor}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={`absolute left-11 w-1.5 h-1.5 rounded-full ${dotColor}`}
          />
        )}
      </button>

      <AnimatePresence>
        {expanded && !collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 pt-1 space-y-2.5 ml-5 border-l-2" style={{ borderColor: config.color + '30' }}>
              {/* Loading */}
              {!status && (
                <div className="flex items-center gap-2 py-1">
                  <Spinner />
                  <span className="text-xs text-text-muted">Checking...</span>
                </div>
              )}

              {/* Node.js not installed */}
              {status && !status.nodeInstalled && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-error shrink-0" />
                      <span className="text-xs text-text-primary font-medium">Node.js required</span>
                    </div>
                    <RefreshButton onClick={onRefresh} spinning={refreshing} />
                  </div>
                  <button
                    onClick={handleInstallNode}
                    className="w-full px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/8 border border-white/6 text-xs font-medium text-text-secondary transition-colors"
                  >
                    Install Node.js
                  </button>
                </div>
              )}

              {/* Not installed */}
              {status && status.nodeInstalled && !status.installed && !installing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-error shrink-0" />
                      <span className="text-xs text-text-primary font-medium">Not installed</span>
                    </div>
                    <RefreshButton onClick={onRefresh} spinning={refreshing} />
                  </div>
                  <button
                    onClick={handleInstall}
                    className="w-full px-3 py-1.5 rounded-md hover:brightness-110 border text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: config.color + '18',
                      borderColor: config.color + '30',
                      color: config.color,
                    }}
                  >
                    Install {config.displayName}
                  </button>
                  {installError && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-status-error">
                        {installError.length > 120 ? installError.slice(-120) : installError}
                      </p>
                      <button
                        onClick={handleOpenDocs}
                        className="text-[10px] hover:underline"
                        style={{ color: config.color }}
                      >
                        Try manual install
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Installing / Updating */}
              {(installing || updating) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Spinner />
                    <span className="text-xs text-text-primary font-medium">
                      {installing ? 'Installing...' : 'Updating...'}
                    </span>
                  </div>
                  {installLog.length > 0 && (
                    <div className="bg-white/[0.03] border border-white/6 rounded-md p-2 max-h-24 overflow-y-auto font-mono text-[9px] text-text-muted leading-relaxed">
                      {installLog.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
                      ))}
                      <div ref={logEndRef} />
                    </div>
                  )}
                </div>
              )}

              {/* Installed */}
              {status?.installed && !installing && !updating && (
                <>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-ready shrink-0" />
                        <span className="text-xs text-text-primary font-medium">Installed</span>
                      </div>
                      <RefreshButton onClick={onRefresh} spinning={refreshing} />
                    </div>
                    {status.version && (
                      <p className="text-[10px] text-text-muted font-mono truncate">
                        {status.version}
                      </p>
                    )}
                    {status.updateAvailable && status.latestVersion && (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-status-in-progress">
                          Update available: v{status.latestVersion}
                        </span>
                        <button
                          onClick={handleUpdate}
                          className="px-2 py-0.5 rounded border text-[10px] font-medium transition-colors"
                          style={{
                            backgroundColor: config.color + '18',
                            borderColor: config.color + '30',
                            color: config.color,
                          }}
                        >
                          Update
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/6" />

                  {/* Auth status */}
                  {status.authenticated ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-status-ready" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 8 6.5 11.5 13 5" />
                        </svg>
                        <span className="text-xs text-text-primary font-medium">Logged in</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <svg className="w-3 h-3 text-status-in-progress" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8 5v3M8 11h.01" />
                          <circle cx="8" cy="8" r="6.5" />
                        </svg>
                        <span className="text-xs text-text-primary font-medium">Not logged in</span>
                      </div>
                      <button
                        onClick={handleLogin}
                        className="w-full px-3 py-1.5 rounded-md border text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: config.color + '18',
                          borderColor: config.color + '30',
                          color: config.color,
                        }}
                      >
                        Log in to {config.displayName}
                      </button>
                      <button
                        onClick={handleGetSubscription}
                        className="text-[10px] hover:underline"
                        style={{ color: config.color }}
                      >
                        Get a subscription
                      </button>
                    </div>
                  )}

                  {/* Docs link */}
                  <button
                    onClick={handleOpenDocs}
                    className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                  >
                    Documentation
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Agents section — shows all three agents
// ---------------------------------------------------------------------------

function AgentsSection({ collapsed, expandedAgent, onToggleAgent }: { collapsed: boolean; expandedAgent: AgentType | null; onToggleAgent: (agentType: AgentType) => void }) {
  const api = useAPI();
  const [statuses, setStatuses] = useState<Record<AgentType, AgentStatus> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const checkAll = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await api.agent.checkAllStatuses();
      setStatuses(result);
    } catch {
      // failed to check
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  // Defer initial check by 3s to not block startup
  useDeferredInit(3000, checkAll);

  // Only poll when app is visible
  useVisibleInterval(checkAll, 60000);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      api.agent.offInstallProgress();
    };
  }, [api]);

  return (
    <div className="space-y-0.5">
      {!collapsed && (
        <div className="flex items-center justify-between px-3 pt-1 pb-0.5">
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider">
            AI Agents
          </span>
          <RefreshButton onClick={checkAll} spinning={refreshing} />
        </div>
      )}
      {(['claude', 'gemini', 'codex'] as AgentType[]).map((agentType) => (
        <AgentCard
          key={agentType}
          agentType={agentType}
          collapsed={collapsed}
          statuses={statuses}
          onRefresh={checkAll}
          refreshing={refreshing}
          expanded={expandedAgent === agentType}
          onToggle={() => onToggleAgent(agentType)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isForge = theme === 'forge';

  return (
    <div className="px-3 pb-1 shrink-0">
      <button
        onClick={toggleTheme}
        className={isForge ? 'forge-theme-toggle' : 'clean-theme-toggle'}
        title={isForge ? 'Switch to Clean theme' : 'Switch to Forge theme'}
        style={collapsed ? { margin: '0 auto' } : undefined}
      >
        {isForge ? (
          /* Tree icon for forge theme */
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 1L4 6h2L3 10h3v4h4v-4h3L10 6h2L8 1z" fill="var(--forge-accent-green, #5a7a3a)" />
            <rect x="7" y="10" width="2" height="4" fill="var(--forge-accent-brown, #6b4e2e)" />
          </svg>
        ) : (
          /* Clean minimal icon */
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="3" />
            <path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.8 3.8L5.2 5.2M10.8 10.8L12.2 12.2M3.8 12.2L5.2 10.8M10.8 5.2L12.2 3.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode toggle (Simple / Developer)
// ---------------------------------------------------------------------------

function ModeToggle({ collapsed }: { collapsed: boolean }) {
  const api = useAPI();
  const { data: prefs, refetch } = useQuery(() => api.preferences.get());
  const mode: AppMode = prefs?.mode || 'simple';

  // Keep language module in sync
  useEffect(() => {
    setLanguageMode(mode);
  }, [mode]);

  async function toggle() {
    const next: AppMode = mode === 'simple' ? 'developer' : 'simple';
    setLanguageMode(next);
    await api.preferences.update({ mode: next });
    refetch();
  }

  if (collapsed) return null;

  return (
    <div className="px-3 pb-1 shrink-0">
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
      >
        <span className="text-[10px] text-text-muted">
          {mode === 'simple' ? '\uD83D\uDE80' : '\uD83D\uDD27'}
        </span>
        <span className="text-[10px] font-medium text-text-secondary truncate">
          {mode === 'simple' ? 'Simple Mode' : 'Developer Mode'}
        </span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main sidebar
// ---------------------------------------------------------------------------

type SidebarSection = 'github' | AgentType | null;

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onNewProject,
}: SidebarProps) {
  const { theme } = useTheme();

  // Accordion state: only one section expanded at a time
  const [expandedSection, setExpandedSection] = useState<SidebarSection>(() => {
    try {
      return (localStorage.getItem('sidebar-expanded-section') as SidebarSection) || null;
    } catch { return null; }
  });

  function toggleSection(section: SidebarSection) {
    setExpandedSection((prev) => {
      const next = prev === section ? null : section;
      try { localStorage.setItem('sidebar-expanded-section', next || ''); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full flex flex-col border-r border-white/6 bg-surface overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        {theme === 'forge' ? (
          <ForgeFire size={collapsed ? 28 : 24} className="shrink-0" />
        ) : (
          <div className="forge-logo-icon w-8 h-8 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-accent"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M3 10h10v1.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 013 11.5V10z" />
              <path d="M2 8.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5V10H2V8.5z" />
              <path
                d="M4.5 5h7a1.5 1.5 0 011.5 1.5V8H3V6.5A1.5 1.5 0 014.5 5z"
                opacity="0.6"
              />
              <rect x="6" y="13" width="4" height="1.5" rx="0.5" />
            </svg>
          </div>
        )}
        {!collapsed && (
          <span className="forge-logo-text font-semibold text-sm tracking-tight whitespace-nowrap text-text-primary">
            Claude Forge
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav data-tutorial="sidebar" className="px-2 py-2 space-y-1">
        <NavItem
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" />
              <rect x="9.5" y="1.5" width="5" height="5" rx="1.2" />
              <rect x="1.5" y="9.5" width="5" height="5" rx="1.2" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" />
            </svg>
          }
          label="Dashboard"
          active={activePage === 'dashboard'}
          onClick={() => onNavigate('dashboard')}
          collapsed={collapsed}
        />
        <NavItem
          icon={
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <line x1="2" y1="5" x2="14" y2="5" />
              <line x1="2" y1="11" x2="14" y2="11" />
              <circle cx="5.5" cy="5" r="1.8" fill="currentColor" />
              <circle cx="10.5" cy="11" r="1.8" fill="currentColor" />
            </svg>
          }
          label="Settings"
          active={activePage === 'settings'}
          onClick={() => onNavigate('settings')}
          collapsed={collapsed}
        />
      </nav>

      {/* Separator */}
      <AsciiDivider variant="vine" />

      {/* Connection Status Tabs */}
      <div data-tutorial="connections" className="px-2 py-2 space-y-0.5 relative">
        <GitHubTab
          collapsed={collapsed}
          expanded={expandedSection === 'github'}
          onToggle={() => toggleSection('github')}
        />
      </div>

      {/* Separator */}
      <AsciiDivider variant="vine" />

      {/* AI Agents */}
      <div className="px-2 py-2 relative overflow-y-auto flex-shrink min-h-0">
        <AgentsSection
          collapsed={collapsed}
          expandedAgent={expandedSection === 'claude' || expandedSection === 'gemini' || expandedSection === 'codex' ? expandedSection as AgentType : null}
          onToggleAgent={(agentType) => toggleSection(agentType)}
        />
      </div>

      {/* Separator */}
      <AsciiDivider variant="single" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Forge Stats Counter */}
      {!collapsed && <ForgeCounter className="mx-3 mb-2" />}

      {/* Theme toggle */}
      <ThemeToggle collapsed={collapsed} />

      {/* Mode toggle */}
      <ModeToggle collapsed={collapsed} />

      {/* New Project Button */}
      <div data-tutorial="new-project" className="px-2 py-2 shrink-0">
        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all hover:shadow-[0_0_20px_var(--color-accent-glow)]"
        >
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          {!collapsed && <span className="whitespace-nowrap">New Project</span>}
        </button>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center py-2.5 border-t border-white/6 text-text-muted hover:text-text-secondary transition-colors shrink-0"
      >
        <motion.svg
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 4L6 8l4 4" />
        </motion.svg>
      </button>
    </motion.aside>
  );
}
