import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Page } from '../App';
import type { GhAuthStatus } from '../../shared/types';
import { useAPI } from '../hooks/useAPI';

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
// Claude icon (terminal-style)
// ---------------------------------------------------------------------------

const ClaudeIcon = (
  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="2" width="14" height="12" rx="2" />
    <polyline points="4 7 6 9 4 11" />
    <line x1="8" y1="11" x2="12" y2="11" />
  </svg>
);

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

function GitHubTab({ collapsed }: { collapsed: boolean }) {
  const api = useAPI();
  const [expanded, setExpanded] = useState(false);
  const [auth, setAuth] = useState<GhAuthStatus | null>(null);
  const [repoCount, setRepoCount] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loginState, setLoginState] = useState<'idle' | 'waiting' | 'polling'>('idle');
  const [deviceCode, setDeviceCode] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Initial check + auto-refresh every 60s
  useEffect(() => {
    checkAuth();
    autoRefreshRef.current = setInterval(checkAuth, 60000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkAuth]);

  async function handleLogin() {
    setLoginState('waiting');
    const result = await api.github.loginStart();
    if ('error' in result) {
      setLoginState('idle');
      return;
    }
    setDeviceCode(result.code);
    setLoginState('polling');

    // Poll for auth completion
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
      {/* Tab header */}
      <button
        onClick={() => !collapsed && setExpanded((v) => !v)}
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

      {/* Expanded panel */}
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
              {/* Loading state */}
              {!auth && (
                <div className="text-xs text-text-muted py-1">Checking...</div>
              )}

              {/* gh CLI not installed */}
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

              {/* Connected state */}
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

              {/* Disconnected state (gh installed but not authenticated) */}
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

              {/* Waiting for device code */}
              {loginState === 'waiting' && (
                <div className="flex items-center gap-2 py-1">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-3 h-3 border border-white/10 border-t-accent rounded-full shrink-0"
                  />
                  <p className="text-xs text-text-muted">Starting login...</p>
                </div>
              )}

              {/* Show device code */}
              {loginState === 'polling' && deviceCode && (
                <div className="space-y-2">
                  <p className="text-[10px] text-text-muted">Enter this code in your browser:</p>
                  <div className="bg-white/5 border border-white/8 rounded-md px-2.5 py-1.5 text-center">
                    <span className="text-sm font-mono font-bold text-accent tracking-wider">
                      {deviceCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                      className="w-2.5 h-2.5 border border-white/10 border-t-accent rounded-full shrink-0"
                    />
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
// Claude Code tab content
// ---------------------------------------------------------------------------

function ClaudeTab({ collapsed }: { collapsed: boolean }) {
  const api = useAPI();
  const [expanded, setExpanded] = useState(false);
  const [claudeCheck, setClaudeCheck] = useState<{ installed: boolean; version: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkClaude = useCallback(async () => {
    setRefreshing(true);
    try {
      const status = await api.system.checkClaude();
      setClaudeCheck(status);
    } catch {
      setClaudeCheck({ installed: false, version: '' });
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => {
    checkClaude();
    autoRefreshRef.current = setInterval(checkClaude, 60000);
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [checkClaude]);

  const isInstalled = claudeCheck?.installed ?? false;

  function handleInstall() {
    api.system.openExternal('https://docs.anthropic.com/en/docs/claude-code/overview');
  }

  return (
    <div>
      {/* Tab header */}
      <button
        onClick={() => !collapsed && setExpanded((v) => !v)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
          expanded && !collapsed
            ? 'bg-white/[0.04]'
            : 'hover:bg-white/[0.03]'
        }`}
      >
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-text-muted">
          {ClaudeIcon}
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-xs font-medium text-text-secondary truncate">
              Claude Code
            </span>
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isInstalled ? 'bg-status-ready' : 'bg-white/20'
              }`}
            />
          </>
        )}
        {collapsed && (
          <span
            className={`absolute left-11 w-1.5 h-1.5 rounded-full ${
              isInstalled ? 'bg-status-ready' : 'bg-white/20'
            }`}
          />
        )}
      </button>

      {/* Expanded panel */}
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
              {!claudeCheck && (
                <div className="text-xs text-text-muted py-1">Checking...</div>
              )}

              {/* Installed */}
              {claudeCheck?.installed && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-ready shrink-0" />
                      <span className="text-xs text-text-primary font-medium">Installed</span>
                    </div>
                    <RefreshButton onClick={checkClaude} spinning={refreshing} />
                  </div>
                  {claudeCheck.version && (
                    <p className="text-[10px] text-text-muted font-mono truncate">
                      {claudeCheck.version}
                    </p>
                  )}
                </div>
              )}

              {/* Not installed */}
              {claudeCheck && !claudeCheck.installed && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-text-muted">Not installed</p>
                    <RefreshButton onClick={checkClaude} spinning={refreshing} />
                  </div>
                  <p className="text-[10px] text-text-muted">
                    Install via{' '}
                    <code className="bg-white/5 px-1 py-0.5 rounded text-text-secondary">
                      npm i -g @anthropic-ai/claude-code
                    </code>
                  </p>
                  <button
                    onClick={handleInstall}
                    className="w-full px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/8 border border-white/6 text-xs font-medium text-text-secondary transition-colors"
                  >
                    View Install Guide
                  </button>
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
// Main sidebar
// ---------------------------------------------------------------------------

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onNewProject,
}: SidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full flex flex-col border-r border-white/6 bg-surface overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
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
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight whitespace-nowrap text-text-primary">
            Claude Forge
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="px-2 py-2 space-y-1">
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
      <div className="mx-3 border-t border-white/6" />

      {/* Connection Status Tabs */}
      <div className="px-2 py-2 space-y-0.5 relative">
        <GitHubTab collapsed={collapsed} />
        <ClaudeTab collapsed={collapsed} />
      </div>

      {/* Separator */}
      <div className="mx-3 border-t border-white/6" />

      {/* Spacer */}
      <div className="flex-1" />

      {/* New Project Button */}
      <div className="px-2 py-2 shrink-0">
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
