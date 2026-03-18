import { useState, useEffect } from 'react';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useToast } from '../components/Toast';
import type { UserPreferences } from '../../shared/types';

export default function Settings() {
  const api = useAPI();
  const {
    data: prefs,
    loading,
    refetch,
  } = useQuery(() => api.preferences.get());
  const { data: ghAuth } = useQuery(() => api.system.checkGhAuth());
  const { data: claudeCheck } = useQuery(() => api.system.checkClaude());

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
        <GitHubSection
          prefs={prefs}
          api={api}
          refetch={refetch}
          ghAuth={ghAuth}
        />
        <ClaudeSection
          prefs={prefs}
          api={api}
          refetch={refetch}
          claudeCheck={claudeCheck}
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
      {/* Project directory */}
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

      {/* Theme */}
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

      {/* Editor */}
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

  // Auto-fill username from gh auth if blank
  useEffect(() => {
    if (ghAuth?.authenticated && ghAuth.username && !prefs.githubUsername) {
      setUsername(ghAuth.username);
      updatePref(api, refetch, { githubUsername: ghAuth.username });
    }
  }, [ghAuth, prefs.githubUsername, api, refetch]);

  return (
    <SectionCard title="GitHub">
      {/* Connection status */}
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

      {/* Default visibility */}
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

      {/* Username */}
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

// --- Claude Code ---

function ClaudeSection({
  prefs,
  api,
  refetch,
  claudeCheck,
}: {
  prefs: UserPreferences;
  api: API;
  refetch: () => void;
  claudeCheck: { installed: boolean; version: string } | null;
}) {
  const [prompt, setPrompt] = useState(prefs.customSystemPrompt);

  useEffect(() => {
    setPrompt(prefs.customSystemPrompt);
  }, [prefs]);

  return (
    <SectionCard title="Claude Code">
      {/* Installation status */}
      <div className="flex items-center gap-2 text-sm">
        <StatusDot ok={claudeCheck?.installed ?? false} />
        {claudeCheck?.installed ? (
          <span className="text-text-secondary">
            Installed{' '}
            {claudeCheck.version && (
              <span className="text-text-muted">({claudeCheck.version})</span>
            )}
          </span>
        ) : (
          <span className="text-text-muted">
            Not found.{' '}
            <span className="text-text-secondary">
              Install via{' '}
              <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">
                npm i -g @anthropic-ai/claude-code
              </code>
            </span>
          </span>
        )}
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
            Auto mode uses --dangerously-skip-permissions. Claude will execute
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
          placeholder="Instructions prepended to all new CLAUDE.md files..."
          className={inputClass + ' resize-none'}
        />
        <FieldHint>
          This text is prepended to the CLAUDE.md generated for every new
          project.
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
      {/* Export / Import */}
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

      {/* Reset */}
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
