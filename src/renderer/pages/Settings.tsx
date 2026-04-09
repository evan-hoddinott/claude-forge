import { useState, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useCachedQuery } from '../hooks/usePerformance';
import { useToast } from '../components/Toast';
import type { UserPreferences, EnvironmentInfo, ProjectLocationMode, AgentType, AgentStatus, AppMode, VaultEntryMasked } from '../../shared/types';
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
        <VaultSection ghAuth={ghAuth} agentStatuses={agentStatuses} />
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

// ─── Vault Section ────────────────────────────────────────────────────────────

function VaultSection({
  ghAuth,
  agentStatuses,
}: {
  ghAuth?: { authenticated: boolean; username: string } | null;
  agentStatuses?: Record<AgentType, AgentStatus> | null;
}) {
  const api = useAPI();
  const { toast } = useToast();
  const [entries, setEntries] = useState<VaultEntryMasked[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [savingCustom, setSavingCustom] = useState(false);

  const claudeConnected = agentStatuses?.claude?.authenticated ?? false;
  const githubConnected = ghAuth?.authenticated ?? false;
  const githubUsername = ghAuth?.username ?? '';

  const loadEntries = async () => {
    try {
      const list = await api.vault.list();
      setEntries(list);
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadEntries(); }, []);

  const entryFor = (provider: string) => entries.find((e) => e.provider === provider);

  async function handleSave(provider: string, displayName: string, baseUrl?: string) {
    const key = keyInput[provider] ?? '';
    if (!key.trim()) { toast('Please enter an API key', 'info'); return; }
    try {
      await api.vault.save({ id: entryFor(provider)?.id, provider, displayName, apiKey: key, baseUrl });
      toast(`${displayName} key saved`);
      setKeyInput(k => ({ ...k, [provider]: '' }));
      setEditingId(null);
      await loadEntries();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.vault.delete(id);
      setDeleteConfirm(null);
      await loadEntries();
      toast('Key removed');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  }

  async function handleTest(provider: string, apiKey?: string, baseUrl?: string) {
    setTesting(t => ({ ...t, [provider]: true }));
    setTestResult(r => ({ ...r, [provider]: { ok: false, msg: '' } }));
    try {
      const result = await api.vault.test(provider, apiKey, baseUrl);
      const modelList = result.models?.slice(0, 3).join(', ');
      setTestResult(r => ({
        ...r,
        [provider]: {
          ok: result.success,
          msg: result.success
            ? `Connected${modelList ? ` — ${modelList}` : ''}`
            : (result.error ?? 'Failed'),
        },
      }));
      if (result.success) await loadEntries();
    } catch {
      setTestResult(r => ({ ...r, [provider]: { ok: false, msg: 'Error' } }));
    } finally {
      setTesting(t => ({ ...t, [provider]: false }));
    }
  }

  async function handleSaveCustom() {
    if (!customName.trim() || !customKey.trim()) {
      toast('Name and API key are required', 'info'); return;
    }
    setSavingCustom(true);
    try {
      await api.vault.save({
        provider: 'custom',
        displayName: customName.trim(),
        apiKey: customKey.trim(),
        baseUrl: customUrl.trim() || undefined,
      });
      toast(`${customName} added to vault`);
      setCustomName(''); setCustomKey(''); setCustomUrl('');
      setShowCustomForm(false);
      await loadEntries();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSavingCustom(false);
    }
  }

  const customEntries = entries.filter((e) => e.provider === 'custom');

  return (
    <SectionCard title="API Key Vault">
      <p className="text-xs text-text-muted -mt-2 mb-1">
        Your keys are encrypted and stored locally. They never leave your machine.
      </p>

      <div className="space-y-3">

        {/* Anthropic — free via Claude Code login */}
        <VaultCard
          icon="🤖"
          name="Anthropic (Claude)"
          badge="FREE"
          connected={claudeConnected}
          connectedLabel="Connected via Claude Code login"
          notConnectedLabel="Login via the Agents sidebar"
          usedBy="Claude Code CLI, Chat Panel"
        />

        {/* OpenAI */}
        <VaultKeyCard
          icon="🟢"
          provider="openai"
          name="OpenAI"
          entry={entryFor('openai')}
          keyInput={keyInput['openai'] ?? ''}
          onKeyInput={(v) => setKeyInput(k => ({ ...k, openai: v }))}
          showKey={showKey['openai'] ?? false}
          onToggleShow={() => setShowKey(s => ({ ...s, openai: !s['openai'] }))}
          editing={editingId === 'openai'}
          onEdit={() => { setEditingId('openai'); setKeyInput(k => ({ ...k, openai: '' })); }}
          onSave={() => handleSave('openai', 'OpenAI')}
          onCancelEdit={() => setEditingId(null)}
          testing={testing['openai'] ?? false}
          testResult={testResult['openai']}
          onTest={() => handleTest('openai')}
          onDelete={() => setDeleteConfirm(entryFor('openai')?.id ?? '')}
          deleteConfirm={deleteConfirm === (entryFor('openai')?.id ?? '__none')}
          onConfirmDelete={() => handleDelete(entryFor('openai')!.id)}
          onCancelDelete={() => setDeleteConfirm(null)}
          usedBy="Codex CLI, Chat Panel"
          docsUrl="platform.openai.com/api-keys"
          placeholder="sk-..."
        />

        {/* Google AI */}
        <VaultKeyCard
          icon="🔵"
          provider="google"
          name="Google AI"
          entry={entryFor('google')}
          keyInput={keyInput['google'] ?? ''}
          onKeyInput={(v) => setKeyInput(k => ({ ...k, google: v }))}
          showKey={showKey['google'] ?? false}
          onToggleShow={() => setShowKey(s => ({ ...s, google: !s['google'] }))}
          editing={editingId === 'google'}
          onEdit={() => { setEditingId('google'); setKeyInput(k => ({ ...k, google: '' })); }}
          onSave={() => handleSave('google', 'Google AI')}
          onCancelEdit={() => setEditingId(null)}
          testing={testing['google'] ?? false}
          testResult={testResult['google']}
          onTest={() => handleTest('google')}
          onDelete={() => setDeleteConfirm(entryFor('google')?.id ?? '')}
          deleteConfirm={deleteConfirm === (entryFor('google')?.id ?? '__none')}
          onConfirmDelete={() => handleDelete(entryFor('google')!.id)}
          onCancelDelete={() => setDeleteConfirm(null)}
          usedBy="Gemini CLI, Chat Panel"
          docsUrl="aistudio.google.com/apikey"
          placeholder="AIza..."
        />

        {/* GitHub — free via gh auth */}
        <VaultCard
          icon="🐙"
          name="GitHub"
          badge="FREE"
          connected={githubConnected}
          connectedLabel={githubUsername ? `Connected as @${githubUsername}` : 'Connected via GitHub CLI'}
          notConnectedLabel="Connect via the Agents sidebar"
          usedBy="Copilot CLI, GitHub Models (Chat)"
        />

        {/* Custom providers */}
        {customEntries.map((entry) => (
          <VaultKeyCard
            key={entry.id}
            icon="⚡"
            provider="custom"
            name={entry.displayName}
            entry={entry}
            keyInput={keyInput[entry.id] ?? ''}
            onKeyInput={(v) => setKeyInput(k => ({ ...k, [entry.id]: v }))}
            showKey={showKey[entry.id] ?? false}
            onToggleShow={() => setShowKey(s => ({ ...s, [entry.id]: !s[entry.id] }))}
            editing={editingId === entry.id}
            onEdit={() => { setEditingId(entry.id); setKeyInput(k => ({ ...k, [entry.id]: '' })); }}
            onSave={async () => {
              const key = keyInput[entry.id] ?? '';
              if (!key.trim()) return;
              await api.vault.save({ id: entry.id, provider: 'custom', displayName: entry.displayName, apiKey: key, baseUrl: entry.baseUrl });
              toast(`${entry.displayName} key updated`);
              setEditingId(null);
              await loadEntries();
            }}
            onCancelEdit={() => setEditingId(null)}
            testing={testing[entry.id] ?? false}
            testResult={testResult[entry.id]}
            onTest={() => handleTest('custom', undefined, entry.baseUrl)}
            onDelete={() => setDeleteConfirm(entry.id)}
            deleteConfirm={deleteConfirm === entry.id}
            onConfirmDelete={() => handleDelete(entry.id)}
            onCancelDelete={() => setDeleteConfirm(null)}
            usedBy={entry.baseUrl ? entry.baseUrl : 'Custom provider'}
            docsUrl=""
            placeholder="API key..."
          />
        ))}

        {/* Add Custom Provider */}
        {!showCustomForm ? (
          <button
            onClick={() => setShowCustomForm(true)}
            className="w-full flex items-center gap-2 rounded-xl border border-dashed border-white/[0.08] px-4 py-3 text-sm text-text-muted hover:text-text-secondary hover:border-white/20 transition-all"
          >
            <span className="text-base">➕</span>
            Add Custom Provider
            <span className="text-xs text-text-muted ml-auto">OpenAI-compatible APIs, Ollama, Groq…</span>
          </button>
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-3">
            <h3 className="text-xs font-semibold text-text-primary">Add Custom Provider</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Name</FieldLabel>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Groq, Ollama, Fireworks…"
                  className={inputClass}
                />
              </div>
              <div>
                <FieldLabel>Base URL</FieldLabel>
                <input
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="http://localhost:11434/v1"
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <FieldLabel>API Key</FieldLabel>
              <input
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value)}
                placeholder="API key (leave blank for Ollama)"
                className={inputClass}
              />
            </div>
            <p className="text-[10px] text-text-muted">
              Works with any OpenAI-compatible API — Ollama, Together AI, Groq, Fireworks, etc.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveCustom}
                disabled={savingCustom}
                className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg text-xs font-semibold transition-all"
              >
                {savingCustom ? 'Saving…' : 'Add Provider'}
              </button>
              <button
                onClick={() => { setShowCustomForm(false); setCustomName(''); setCustomKey(''); setCustomUrl(''); }}
                className="px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function VaultCard({
  icon,
  name,
  badge,
  connected,
  connectedLabel,
  notConnectedLabel,
  usedBy,
}: {
  icon: string;
  name: string;
  badge?: string;
  connected: boolean;
  connectedLabel: string;
  notConnectedLabel: string;
  usedBy: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-text-primary">{name}</span>
          {badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-status-ready/15 text-status-ready tracking-wider">
              {badge}
            </span>
          )}
        </div>
        <span className={`text-[10px] font-mono ${connected ? 'text-status-ready' : 'text-text-muted'}`}>
          {connected ? '✓ CONNECTED' : '○ NOT CONNECTED'}
        </span>
      </div>
      <p className="text-xs text-text-secondary mb-1">
        {connected ? connectedLabel : notConnectedLabel}
      </p>
      <p className="text-[10px] text-text-muted">Used by: {usedBy}</p>
    </div>
  );
}

function VaultKeyCard({
  icon,
  name,
  entry,
  keyInput,
  onKeyInput,
  showKey,
  onToggleShow,
  editing,
  onEdit,
  onSave,
  onCancelEdit,
  testing,
  testResult,
  onTest,
  onDelete,
  deleteConfirm,
  onConfirmDelete,
  onCancelDelete,
  usedBy,
  docsUrl,
  placeholder,
}: {
  icon: string;
  provider: string;
  name: string;
  entry: VaultEntryMasked | undefined;
  keyInput: string;
  onKeyInput: (v: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  editing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancelEdit: () => void;
  testing: boolean;
  testResult?: { ok: boolean; msg: string };
  onTest: () => void;
  onDelete: () => void;
  deleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  usedBy: string;
  docsUrl: string;
  placeholder: string;
}) {
  const hasKey = entry?.hasKey ?? false;
  const isValid = entry?.isValid ?? null;
  const lastTested = entry?.lastTested ? new Date(entry.lastTested) : null;
  const relTime = lastTested ? relativeTime(lastTested.toISOString()) : null;

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-sm font-medium text-text-primary">{name}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isValid === true && (
            <span className="text-[10px] font-mono text-status-ready">✓ VALID</span>
          )}
          {isValid === false && (
            <span className="text-[10px] font-mono text-status-error">✗ INVALID</span>
          )}
          {isValid === null && hasKey && (
            <span className="text-[10px] font-mono text-text-muted">○ NOT TESTED</span>
          )}
          {!hasKey && (
            <span className="text-[10px] font-mono text-text-muted">○ NOT CONFIGURED</span>
          )}
        </div>
      </div>

      {hasKey && !editing ? (
        <div className="space-y-2">
          {/* Masked key row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <span className="font-mono text-xs text-text-secondary flex-1">
                {showKey ? entry!.maskedKey : '••••••••••••••••'}
              </span>
              <button onClick={onToggleShow} className="text-[10px] text-text-muted hover:text-text-secondary">
                {showKey ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            <button
              onClick={onEdit}
              className="p-2 rounded-lg text-text-muted hover:text-text-secondary hover:bg-white/5 transition-colors"
              title="Edit key"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" />
              </svg>
            </button>
            {!deleteConfirm ? (
              <button
                onClick={onDelete}
                className="p-2 rounded-lg text-text-muted hover:text-status-error hover:bg-status-error/10 transition-colors"
                title="Remove key"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 9h8l1-9" />
                </svg>
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button onClick={onConfirmDelete} className="text-[10px] px-2 py-1 rounded bg-status-error/20 text-status-error hover:bg-status-error/30">
                  Remove
                </button>
                <button onClick={onCancelDelete} className="text-[10px] px-2 py-1 text-text-muted hover:text-text-secondary">
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Test & status */}
          <div className="flex items-center gap-3">
            <button
              onClick={onTest}
              disabled={testing}
              className="text-xs text-text-muted hover:text-text-secondary disabled:opacity-50 transition-colors"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            {relTime && isValid !== null && (
              <span className="text-[10px] text-text-muted">Last tested: {relTime}</span>
            )}
          </div>
          {testResult?.msg && (
            <p className={`text-[10px] font-mono ${testResult.ok ? 'text-status-ready' : 'text-status-error'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.msg}
            </p>
          )}
          <p className="text-[10px] text-text-muted">Used by: {usedBy}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docsUrl && (
            <p className="text-[10px] text-text-muted">
              Get a key at <span className="font-mono text-text-secondary">{docsUrl}</span>
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => onKeyInput(e.target.value)}
              placeholder={placeholder}
              onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancelEdit(); }}
              className={`${inputClass} font-mono flex-1`}
              autoFocus={editing}
            />
            <button
              onClick={onSave}
              disabled={!keyInput.trim()}
              className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-40 text-bg text-xs font-semibold transition-all"
            >
              Save
            </button>
            {editing && (
              <button onClick={onCancelEdit} className="px-2 py-2 text-xs text-text-muted hover:text-text-secondary">
                Cancel
              </button>
            )}
          </div>
          <p className="text-[10px] text-text-muted">Used by: {usedBy}</p>
        </div>
      )}
    </div>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

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
