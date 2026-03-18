import { useState, useEffect } from 'react';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useToast } from '../components/Toast';
import type { UserPreferences, EnvironmentInfo, ProjectLocationMode, AgentType, AgentStatus } from '../../shared/types';
import { AGENTS } from '../../shared/types';

export default function Settings() {
  const api = useAPI();
  const {
    data: prefs,
    loading,
    refetch,
  } = useQuery(() => api.preferences.get());
  const { data: ghAuth } = useQuery(() => api.system.checkGhAuth());
  const { data: agentStatuses } = useQuery(() => api.agent.checkAllStatuses());
  const { data: envInfo } = useQuery(() => api.system.getEnvironment());

  if (loading || !prefs) {
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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto px-8 py-8 space-y-8">
        <h1 className="text-xl font-bold text-text-primary">Settings</h1>

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

      <div>
        <FieldLabel>Theme</FieldLabel>
        <SegmentedControl
          value={prefs.theme}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          onChange={(v) => updatePref(api, refetch, { theme: v })}
        />
      </div>

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
