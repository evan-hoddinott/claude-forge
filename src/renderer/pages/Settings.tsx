import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useCachedQuery } from '../hooks/usePerformance';
import { useToast } from '../components/Toast';
import type { UserPreferences, EnvironmentInfo, ProjectLocationMode, AgentType, AgentStatus, AppMode } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { rawLabel } from '../utils/language';
import { useUpdateStatus } from '../components/UpdateNotification';

class SettingsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Settings render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-full overflow-y-auto">
          <div className="max-w-2xl mx-auto px-8 py-8 space-y-4">
            <h1 className="text-xl font-bold text-status-error">Settings failed to load</h1>
            <p className="text-sm text-text-secondary">
              {this.state.error.message}
            </p>
            <pre className="text-xs text-text-muted bg-white/[0.03] rounded-lg p-4 overflow-auto max-h-60">
              {this.state.error.stack}
            </pre>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Settings() {
  return (
    <SettingsErrorBoundary>
      <SettingsInner />
    </SettingsErrorBoundary>
  );
}

function SettingsInner() {
  const api = useAPI();
  const {
    data: prefs,
    loading,
    error: prefsError,
    refetch,
  } = useQuery(() => api.preferences.get());
  // Cache agent statuses for 60s — expensive IPC call (checks 3 CLIs + npm)
  const { data: ghAuth } = useCachedQuery('gh-auth', () => api.system.checkGhAuth(), 30_000);
  const { data: agentStatuses } = useCachedQuery('agent-statuses', () => api.agent.checkAllStatuses(), 60_000);
  const { data: envInfo } = useCachedQuery('environment', () => api.system.getEnvironment(), 300_000);

  if (loading) {
    return (
      <div className="p-8 space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div
            key={i}
            className="h-40 rounded-xl bg-white/[0.02] animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  if (!prefs) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8 space-y-4">
          <h1 className="text-xl font-bold text-text-primary">Settings</h1>
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
            <p className="text-sm font-medium text-status-error">Failed to load settings</p>
            {prefsError && (
              <p className="text-xs text-text-muted font-mono">{prefsError}</p>
            )}
            <button
              onClick={refetch}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>

        <ExperienceSection prefs={prefs} api={api} refetch={refetch} />
        <GeneralSection prefs={prefs} api={api} refetch={refetch} />
        <EnvironmentSection
          prefs={prefs}
          api={api}
          refetch={refetch}
          envInfo={envInfo}
        />
        <GitHubSection
          prefs={prefs}
          api={api}
          refetch={refetch}
          ghAuth={ghAuth}
        />
        <AgentsSection
          prefs={prefs}
          api={api}
          refetch={refetch}
          agentStatuses={agentStatuses}
        />
        <FileExplorerSection prefs={prefs} api={api} refetch={refetch} />
        <AccessibilitySection prefs={prefs} api={api} refetch={refetch} />
        <UpdatesSection prefs={prefs} />
        <SetupSection />
        <DataSection api={api} refetch={refetch} />
      </div>
    </div>
  );
}

// --- Helpers ---

type API = ReturnType<typeof useAPI>;

async function updatePref(
  api: API,
  refetch: () => void,
  updates: Partial<UserPreferences>,
) {
  await api.preferences.update(updates);
  refetch();
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
      <h2 className="text-sm font-semibold text-text-primary mb-5">{title}</h2>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-text-muted mb-1.5">
      {children}
    </label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-text-muted mt-1">{children}</p>;
}

function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] w-fit">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-white/8 text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full ${
        ok ? 'bg-status-ready' : 'bg-status-error'
      }`}
    />
  );
}

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

const inputClass =
  'w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors';

// --- Experience ---

function ExperienceSection({
  prefs,
  api,
  refetch,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
}) {
  const currentMode = prefs.mode || 'simple';

  return (
    <SectionCard title="Experience">
      {/* Mode toggle */}
      <div>
        <FieldLabel>Interface Mode</FieldLabel>
        <SegmentedControl
          value={currentMode}
          options={[
            { value: 'simple' as AppMode, label: 'Simple Mode' },
            { value: 'developer' as AppMode, label: 'Developer Mode' },
          ]}
          onChange={(v) => updatePref(api, refetch, { mode: v })}
        />
        <FieldHint>
          Changes how technical terms are displayed throughout the app.
        </FieldHint>

        {/* Preview */}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/6">
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">Simple</p>
            <p className="text-xs text-text-secondary">{rawLabel('git_push', 'simple')}</p>
            <p className="text-xs text-text-secondary">{rawLabel('npm_install', 'simple')}</p>
            <p className="text-xs text-text-secondary">{rawLabel('agent_launch', 'simple')}</p>
          </div>
          <div className="p-3 rounded-lg bg-white/[0.02] border border-white/6">
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1.5">Developer</p>
            <p className="text-xs text-text-secondary">{rawLabel('git_push', 'developer')}</p>
            <p className="text-xs text-text-secondary">{rawLabel('npm_install', 'developer')}</p>
            <p className="text-xs text-text-secondary">{rawLabel('agent_launch', 'developer')}</p>
          </div>
        </div>
      </div>

      {/* Replay onboarding */}
      <div className="flex gap-2">
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-setup-assistant'))}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
        >
          Re-run setup wizard
        </button>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-tutorial'))}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
        >
          Replay tutorial
        </button>
      </div>
    </SectionCard>
  );
}

// --- Accessibility ---

function AccessibilitySection({
  prefs,
  api,
  refetch,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
}) {
  const [fontSize, setFontSize] = useState(prefs.appFontSize ?? 14);

  useEffect(() => {
    setFontSize(prefs.appFontSize ?? 14);
  }, [prefs.appFontSize]);

  // Apply font size to document root
  useEffect(() => {
    document.documentElement.style.fontSize = `${fontSize}px`;
    return () => {
      document.documentElement.style.fontSize = '';
    };
  }, [fontSize]);

  return (
    <SectionCard title="Accessibility">
      <div>
        <FieldLabel>App font size: {fontSize}px</FieldLabel>
        <input
          type="range"
          min={12}
          max={20}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          onMouseUp={() => updatePref(api, refetch, { appFontSize: fontSize })}
          className="w-48 accent-accent"
        />
        <FieldHint>Affects text size throughout the entire app.</FieldHint>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.reduceAnimations ?? false}
            onChange={(e) =>
              updatePref(api, refetch, { reduceAnimations: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">Reduce animations</span>
        </label>
        <FieldHint>Disables most transition and motion effects.</FieldHint>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.highContrast ?? false}
            onChange={(e) =>
              updatePref(api, refetch, { highContrast: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">High contrast</span>
        </label>
        <FieldHint>Increases contrast for better readability.</FieldHint>
      </div>
    </SectionCard>
  );
}

// --- General ---

function GeneralSection({
  prefs,
  api,
  refetch,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
}) {
  const [dir, setDir] = useState(prefs.defaultProjectDir);
  const [editor, setEditor] = useState(prefs.defaultEditor);

  useEffect(() => {
    setDir(prefs.defaultProjectDir);
    setEditor(prefs.defaultEditor);
  }, [prefs]);

  async function pickDir() {
    const selected = await api.system.selectDirectory();
    if (selected) {
      setDir(selected);
      updatePref(api, refetch, { defaultProjectDir: selected });
    }
  }

  return (
    <SectionCard title="General">
      <div>
        <FieldLabel>Default project directory</FieldLabel>
        <div className="flex gap-2">
          <input
            value={dir}
            onChange={(e) => setDir(e.target.value)}
            onBlur={() => updatePref(api, refetch, { defaultProjectDir: dir })}
            className={inputClass}
          />
          <button
            onClick={pickDir}
            className="shrink-0 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary transition-colors"
          >
            Browse
          </button>
        </div>
      </div>

      <ThemeSection prefs={prefs} api={api} refetch={refetch} />

      <div>
        <FieldLabel>Default editor command</FieldLabel>
        <input
          value={editor}
          onChange={(e) => setEditor(e.target.value)}
          onBlur={() => updatePref(api, refetch, { defaultEditor: editor })}
          placeholder="code"
          className={inputClass + ' max-w-xs'}
        />
        <FieldHint>
          Common values: code, cursor, codium, subl, vim, nvim
        </FieldHint>
      </div>
    </SectionCard>
  );
}

// --- Theme ---

function ThemeSection({
  prefs,
  api,
  refetch,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
}) {
  return (
    <>
      <div>
        <FieldLabel>Theme</FieldLabel>
        <FieldHint>
          Retro neocities-inspired theme with pixel fonts, earthy greens, and warm amber accents.
        </FieldHint>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.showSplash !== false}
            onChange={(e) =>
              updatePref(api, refetch, { showSplash: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">
            Show splash screen on launch
          </span>
        </label>
        <FieldHint>
          Shows a brief retro boot-up animation when the app starts.
        </FieldHint>
      </div>
    </>
  );
}

// --- Environment ---

function EnvironmentSection({
  prefs,
  api,
  refetch,
  envInfo,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
  envInfo: EnvironmentInfo | null;
}) {
  const platformLabel = envInfo
    ? envInfo.platform === 'wsl'
      ? 'WSL'
      : envInfo.platform === 'native-windows'
        ? 'Windows'
        : 'Linux'
    : 'Detecting...';

  const wslStatusText = envInfo
    ? envInfo.wslAvailable
      ? `WSL detected: ${envInfo.wslDistro}`
      : 'WSL not found'
    : 'Checking...';

  return (
    <SectionCard title="Project Location">
      <div className="flex items-center gap-2 text-sm">
        <StatusDot ok={envInfo?.wslAvailable ?? false} />
        <span className="text-text-secondary">{wslStatusText}</span>
        <span className="text-text-muted">({platformLabel})</span>
      </div>

      <div>
        <FieldLabel>Default project directory</FieldLabel>
        <p className="text-sm text-text-primary bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 font-mono break-all">
          {prefs.defaultProjectDir}
        </p>
      </div>

      {envInfo?.wslAvailable && (
        <div>
          <FieldLabel>Default location for new projects</FieldLabel>
          <SegmentedControl
            value={prefs.projectLocationMode}
            options={[
              { value: 'wsl' as ProjectLocationMode, label: 'WSL (recommended)' },
              { value: 'windows' as ProjectLocationMode, label: 'Windows' },
            ]}
            onChange={(v) => {
              const newDir = v === 'wsl'
                ? envInfo.wslProjectDir
                : envInfo.windowsProjectDir;
              updatePref(api, refetch, {
                projectLocationMode: v,
                defaultProjectDir: newDir || prefs.defaultProjectDir,
              });
            }}
          />
          <FieldHint>
            WSL is recommended for AI coding agents. Projects on the Windows filesystem
            will be slower for file operations.
          </FieldHint>
        </div>
      )}

      {envInfo?.wslAvailable && (
        <div className="space-y-2 text-xs text-text-muted">
          {envInfo.wslProjectDir && (
            <div className="flex gap-2">
              <span className="shrink-0 font-medium">WSL path:</span>
              <span className="font-mono break-all">{envInfo.wslProjectDir}</span>
            </div>
          )}
          {envInfo.windowsProjectDir && (
            <div className="flex gap-2">
              <span className="shrink-0 font-medium">Windows path:</span>
              <span className="font-mono break-all">{envInfo.windowsProjectDir}</span>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// --- GitHub ---

function GitHubSection({
  prefs,
  api,
  refetch,
  ghAuth,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
  ghAuth: { authenticated: boolean; username: string } | null;
}) {
  const [username, setUsername] = useState(prefs.githubUsername);

  useEffect(() => {
    setUsername(prefs.githubUsername);
  }, [prefs]);

  useEffect(() => {
    if (ghAuth?.authenticated && ghAuth.username && !prefs.githubUsername) {
      setUsername(ghAuth.username);
      updatePref(api, refetch, { githubUsername: ghAuth.username });
    }
  }, [ghAuth, prefs.githubUsername, api, refetch]);

  return (
    <SectionCard title="GitHub">
      <div className="flex items-center gap-2 text-sm">
        <StatusDot ok={ghAuth?.authenticated ?? false} />
        {ghAuth?.authenticated ? (
          <span className="text-text-secondary">
            Connected as{' '}
            <span className="text-text-primary font-medium">
              @{ghAuth.username}
            </span>
          </span>
        ) : (
          <span className="text-text-muted">
            Not connected.{' '}
            <span className="text-text-secondary">
              Run{' '}
              <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">
                gh auth login
              </code>{' '}
              to authenticate.
            </span>
          </span>
        )}
      </div>

      <div>
        <FieldLabel>Default visibility for new repos</FieldLabel>
        <SegmentedControl
          value={prefs.defaultRepoVisibility}
          options={[
            { value: 'private', label: 'Private' },
            { value: 'public', label: 'Public' },
          ]}
          onChange={(v) =>
            updatePref(api, refetch, { defaultRepoVisibility: v })
          }
        />
      </div>

      <div>
        <FieldLabel>GitHub username</FieldLabel>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onBlur={() =>
            updatePref(api, refetch, { githubUsername: username })
          }
          placeholder="username"
          className={inputClass + ' max-w-xs'}
        />
      </div>
    </SectionCard>
  );
}

// --- AI Agents ---

function AgentsSection({
  prefs,
  api,
  refetch,
  agentStatuses,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
  agentStatuses: Record<AgentType, AgentStatus> | null;
}) {
  const [prompt, setPrompt] = useState(prefs.customSystemPrompt);

  useEffect(() => {
    setPrompt(prefs.customSystemPrompt);
  }, [prefs]);

  return (
    <SectionCard title="AI Agents">
      {/* Agent status overview */}
      <div className="space-y-2">
        {(['claude', 'gemini', 'codex'] as AgentType[]).map((agentType) => {
          const config = AGENTS[agentType];
          const status = agentStatuses?.[agentType];
          return (
            <div key={agentType} className="flex items-center gap-3 text-sm">
              <span style={{ color: config.color }}>
                <AgentIcon agentType={agentType} className="w-4 h-4" />
              </span>
              <span className="text-text-primary font-medium w-28">{config.displayName}</span>
              <StatusDot ok={status?.installed ?? false} />
              {status?.installed ? (
                <span className="text-text-secondary">
                  Installed{' '}
                  {status.version && (
                    <span className="text-text-muted text-xs">({status.version.match(/(\d+\.\d+\.\d+)/)?.[1] ?? status.version})</span>
                  )}
                </span>
              ) : (
                <span className="text-text-muted">
                  Not found — install via{' '}
                  <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">
                    npm i -g {config.npmPackage}
                  </code>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Default agent */}
      <div>
        <FieldLabel>Default AI agent for new projects</FieldLabel>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] w-fit">
          {(['claude', 'gemini', 'codex'] as AgentType[]).map((agentType) => {
            const config = AGENTS[agentType];
            return (
              <button
                key={agentType}
                onClick={() => updatePref(api, refetch, { defaultAgent: agentType })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  prefs.defaultAgent === agentType
                    ? 'bg-white/8 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <span style={{ color: prefs.defaultAgent === agentType ? config.color : undefined }}>
                  <AgentIcon agentType={agentType} className="w-3 h-3" />
                </span>
                {config.displayName}
              </button>
            );
          })}
        </div>
        <FieldHint>
          This agent will be pre-selected when creating new projects.
        </FieldHint>
      </div>

      {/* Auto-generate all context files */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.autoGenerateAllContextFiles}
            onChange={(e) =>
              updatePref(api, refetch, { autoGenerateAllContextFiles: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">
            Auto-generate context files for all installed agents
          </span>
        </label>
        <FieldHint>
          When enabled, new projects will get context files (CLAUDE.md, GEMINI.md, codex.md) for every installed agent.
        </FieldHint>
      </div>

      {/* Launch mode */}
      <div>
        <FieldLabel>Default launch mode</FieldLabel>
        <SegmentedControl
          value={prefs.claudeLaunchMode}
          options={[
            { value: 'interactive', label: 'Interactive' },
            { value: 'auto', label: 'Auto' },
          ]}
          onChange={(v) =>
            updatePref(api, refetch, { claudeLaunchMode: v })
          }
        />
        {prefs.claudeLaunchMode === 'auto' && (
          <FieldHint>
            Auto mode uses --dangerously-skip-permissions. Agents will execute
            without asking for confirmation.
          </FieldHint>
        )}
      </div>

      {/* Custom system prompt */}
      <div>
        <FieldLabel>Custom system prompt</FieldLabel>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onBlur={() =>
            updatePref(api, refetch, { customSystemPrompt: prompt })
          }
          rows={4}
          placeholder="Instructions prepended to all new context files..."
          className={inputClass + ' resize-none'}
        />
        <FieldHint>
          This text is prepended to the context files generated for every new project.
        </FieldHint>
      </div>
    </SectionCard>
  );
}

// --- File Explorer ---

function FileExplorerSection({
  prefs,
  api,
  refetch,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
}) {
  const [fontSize, setFontSize] = useState(prefs.fileExplorerFontSize ?? 13);

  useEffect(() => {
    setFontSize(prefs.fileExplorerFontSize ?? 13);
  }, [prefs.fileExplorerFontSize]);

  return (
    <SectionCard title="File Explorer">
      <div>
        <FieldLabel>Default editor</FieldLabel>
        <SegmentedControl
          value={prefs.defaultEditor}
          options={[
            { value: 'code', label: 'VS Code' },
            { value: 'cursor', label: 'Cursor' },
            { value: 'windsurf', label: 'Windsurf' },
            { value: 'subl', label: 'Sublime' },
          ]}
          onChange={(v) => updatePref(api, refetch, { defaultEditor: v })}
        />
        <FieldHint>
          Editor used when clicking "Open in Editor" in the file explorer.
        </FieldHint>
      </div>

      <div>
        <FieldLabel>Code preview font size: {fontSize}px</FieldLabel>
        <input
          type="range"
          min={10}
          max={20}
          value={fontSize}
          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
          onMouseUp={() => updatePref(api, refetch, { fileExplorerFontSize: fontSize })}
          className="w-48 accent-accent"
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.fileExplorerShowHidden}
            onChange={(e) =>
              updatePref(api, refetch, { fileExplorerShowHidden: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">Show hidden files</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.fileExplorerWordWrap}
            onChange={(e) =>
              updatePref(api, refetch, { fileExplorerWordWrap: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">Word wrap in preview</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={prefs.fileExplorerMinimap ?? true}
            onChange={(e) =>
              updatePref(api, refetch, { fileExplorerMinimap: e.target.checked })
            }
            className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
          />
          <span className="text-sm text-text-secondary">Show minimap</span>
        </label>
      </div>
    </SectionCard>
  );
}

// --- Setup ---

// --- Updates ---

function UpdatesSection({ prefs }: { prefs: UserPreferences }) {
  const { status, lastChecked, checkNow, install } = useUpdateStatus();
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await checkNow();
    // Give it a moment to settle
    setTimeout(() => setChecking(false), 2000);
  };

  const isDeveloper = prefs.mode === 'developer';
  const currentVersion = status?.currentVersion || status?.version;

  return (
    <SectionCard title="Updates">
      {/* Version display */}
      {currentVersion && (
        <div>
          <FieldLabel>Current Version</FieldLabel>
          <p className="text-sm text-text-primary">v{currentVersion}</p>
        </div>
      )}

      {/* Status */}
      <div>
        <FieldLabel>Update Status</FieldLabel>
        {(!status || status.status === 'up-to-date') && (
          <p className="text-sm text-status-ready">
            {isDeveloper ? 'Up to date' : 'You have the latest version'}
          </p>
        )}
        {status?.status === 'checking' && (
          <p className="text-sm text-text-muted">Checking for updates...</p>
        )}
        {status?.status === 'available' && (
          <p className="text-sm text-accent-primary">
            {isDeveloper
              ? `Update available: v${status.version}`
              : `A new version (v${status.version}) is available!`}
          </p>
        )}
        {status?.status === 'downloading' && (
          <div className="space-y-1.5">
            <p className="text-sm text-text-secondary">
              Downloading... {status.percent}%
            </p>
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-accent-primary/60 transition-all duration-300"
                style={{ width: `${status.percent ?? 0}%` }}
              />
            </div>
          </div>
        )}
        {status?.status === 'ready' && (
          <div className="space-y-2">
            <p className="text-sm text-status-ready">
              {isDeveloper
                ? `v${status.version} downloaded — restart to install`
                : 'Update downloaded! Restart to apply.'}
            </p>
            <button
              onClick={install}
              className="px-4 py-2 rounded-lg bg-status-ready/20 text-status-ready text-sm font-medium hover:bg-status-ready/30 transition-colors"
            >
              Restart Now to Install
            </button>
          </div>
        )}
        {status?.status === 'error' && (
          <p className="text-sm text-status-error">
            Update check failed{isDeveloper && status.message ? `: ${status.message}` : ''}
          </p>
        )}
      </div>

      {/* Check button and last checked */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleCheck}
          disabled={checking || status?.status === 'downloading'}
          className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors disabled:opacity-50"
        >
          {checking ? 'Checking...' : 'Check for Updates'}
        </button>
        {lastChecked && (
          <span className="text-xs text-text-muted">
            Last checked: {formatTimeAgo(lastChecked)}
          </span>
        )}
      </div>

      {/* Note about Linux .deb */}
      <FieldHint>
        Auto-updates work with Windows (.exe) and Linux AppImage builds.
        If using the .deb package, download new versions manually.
      </FieldHint>
    </SectionCard>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// --- Setup ---

function SetupSection() {
  return (
    <SectionCard title="Setup">
      <div>
        <p className="text-xs text-text-muted mb-3">
          Re-run the setup wizard to check dependencies and reconfigure your environment, or replay the interactive tutorial.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-setup-assistant'))}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
          >
            Run Setup Wizard
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-tutorial'))}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
          >
            Replay Tutorial
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// --- Data ---

function DataSection({
  api,
  refetch,
}: {
  api: API;
  refetch: () => void;
}) {
  const { toast } = useToast();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const doExport = useMutation(async () => {
    const filePath = await api.data.exportProjects();
    if (filePath) {
      setExportResult(`Exported to ${filePath}`);
      toast('Projects exported');
    }
  });

  const doImport = useMutation(async () => {
    const count = await api.data.importProjects();
    const msg = count > 0 ? `Imported ${count} project${count > 1 ? 's' : ''}` : 'No new projects to import';
    setImportResult(msg);
    if (count > 0) toast(msg);
    refetch();
  });

  const doReset = useMutation(async () => {
    await api.data.resetAll();
    setShowResetConfirm(false);
    toast('All data has been reset', 'info');
    refetch();
  });

  return (
    <SectionCard title="Data">
      <div className="flex items-start gap-3">
        <div>
          <button
            onClick={() => doExport.mutate()}
            disabled={doExport.loading}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
          >
            {doExport.loading ? 'Exporting\u2026' : 'Export as JSON'}
          </button>
          {exportResult && (
            <p className="text-xs text-status-ready mt-1.5">{exportResult}</p>
          )}
          {doExport.error && (
            <p className="text-xs text-status-error mt-1.5">
              {doExport.error}
            </p>
          )}
        </div>
        <div>
          <button
            onClick={() => doImport.mutate()}
            disabled={doImport.loading}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm font-medium text-text-secondary transition-colors"
          >
            {doImport.loading ? 'Importing\u2026' : 'Import from JSON'}
          </button>
          {importResult && (
            <p className="text-xs text-status-ready mt-1.5">{importResult}</p>
          )}
          {doImport.error && (
            <p className="text-xs text-status-error mt-1.5">
              {doImport.error}
            </p>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-white/[0.06]">
        <h3 className="text-sm font-semibold text-status-error mb-1">
          Danger Zone
        </h3>
        <p className="text-xs text-text-muted mb-3">
          Reset all settings and remove all projects from the app. Files on disk
          are not deleted.
        </p>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 rounded-lg border border-status-error/30 text-status-error text-sm font-medium hover:bg-status-error/10 transition-colors"
          >
            Reset All Data
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => doReset.mutate()}
              disabled={doReset.loading}
              className="px-4 py-2 rounded-lg bg-status-error text-white text-sm font-medium hover:bg-status-error/90 transition-colors"
            >
              {doReset.loading ? 'Resetting\u2026' : 'Confirm Reset'}
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
