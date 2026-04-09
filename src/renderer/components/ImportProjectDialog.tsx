import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import type { DetectedProject, Project, AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';

// ── Types ────────────────────────────────────────────────────────────────────

type Mode = 'local' | 'clone';
type Phase =
  | 'scanning'        // local: auto folder-picker → scan
  | 'url-entry'       // clone: enter URL / pick repo
  | 'pick-destination' // clone: pick local destination
  | 'cloning'         // clone: git clone in progress
  | 'confirm'         // both: show detected info + editable form
  | 'importing';      // both: submitting to IPC

interface ImportProjectDialogProps {
  mode: Mode;
  onClose: () => void;
  onImported: (project: Project) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function detectSummary(d: DetectedProject): string {
  const parts: string[] = [];
  if (d.languages.length > 0) parts.push(d.languages.join(' + '));
  if (d.framework) parts.push(d.framework);
  if (d.packageManager) parts.push(d.packageManager);
  return parts.join(' · ') || 'Unknown';
}

function getGithubDisplay(remote: string | null): string | null {
  if (!remote) return null;
  const m = remote.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
  return m ? m[1] : remote;
}

// ── Detected info banner ─────────────────────────────────────────────────────

function DetectedBanner({ detected }: { detected: DetectedProject }) {
  const githubDisplay = getGithubDisplay(detected.gitRemote);
  return (
    <div className="rounded-lg bg-white/5 border border-white/8 p-3 space-y-1.5 text-xs">
      <div className="flex items-center gap-2 text-text-muted">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2h12v12H2z" fillOpacity="0" stroke="currentColor" strokeWidth="1.5" />
          <path d="M2 2l4 4M6 2H2v4" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span className="font-mono text-text-secondary truncate">{detected.path}</span>
      </div>
      <div className="flex items-center gap-2 text-text-muted">
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="4" r="1.5" />
          <circle cx="11" cy="4" r="1.5" />
          <circle cx="8" cy="12" r="1.5" />
          <path d="M5 5.5v2a3 3 0 003 3m3-5v2a3 3 0 01-3 3" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
        <span>Detected: <span className="text-text-primary">{detectSummary(detected)}</span></span>
      </div>
      {detected.hasGit && (
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {githubDisplay ? (
            <span>Git: <span className="text-green-400">✓</span> <span className="text-text-primary">{githubDisplay}</span></span>
          ) : (
            <span>Git: <span className="text-green-400">✓</span> <span className="text-text-secondary">local repo</span></span>
          )}
        </div>
      )}
      {detected.existingContextFiles.length > 0 && (
        <div className="flex items-center gap-2 text-text-muted">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 2h6l3 3v9H4V2z" strokeLinecap="round" />
            <path d="M10 2v3h3" />
          </svg>
          <span>Context: <span className="text-text-primary">{detected.existingContextFiles.join(', ')}</span></span>
        </div>
      )}
    </div>
  );
}

// ── Agent selector ───────────────────────────────────────────────────────────

const AGENT_ORDER: AgentType[] = ['claude', 'gemini', 'codex', 'copilot'];

function AgentSelector({
  value,
  onChange,
}: {
  value: AgentType;
  onChange: (a: AgentType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {AGENT_ORDER.map((agentType) => {
        const config = AGENTS[agentType];
        const selected = value === agentType;
        return (
          <button
            key={agentType}
            onClick={() => onChange(agentType)}
            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
              selected
                ? 'border-[var(--agent-color)] bg-[var(--agent-color)]/10 text-text-primary'
                : 'border-white/8 bg-white/3 text-text-secondary hover:border-white/15 hover:text-text-primary'
            }`}
            style={{ '--agent-color': config.color } as React.CSSProperties}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: config.color }}
            />
            {config.displayName}
          </button>
        );
      })}
    </div>
  );
}

// ── Clone phase ───────────────────────────────────────────────────────────────

function ClonePhase({
  url,
  onUrlChange,
  ghRepos,
  destination,
  onPickDestination,
  onClone,
  onCancel,
}: {
  url: string;
  onUrlChange: (u: string) => void;
  ghRepos: { name: string; url: string; fullName: string }[] | null;
  destination: string;
  onPickDestination: () => void;
  onClone: () => void;
  onCancel: () => void;
}) {
  const canClone = url.trim().length > 0 && destination.trim().length > 0;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Repository URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder="https://github.com/user/repo"
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          autoFocus
        />
        {ghRepos && ghRepos.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-lg border border-white/8 bg-surface divide-y divide-white/5">
            {ghRepos.map((repo) => (
              <button
                key={repo.fullName}
                onClick={() => onUrlChange(repo.url)}
                className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors"
              >
                {repo.fullName}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Clone destination</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={destination}
            readOnly
            placeholder="Pick a folder..."
            className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-text-primary placeholder:text-text-muted cursor-default"
          />
          <button
            onClick={onPickDestination}
            className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-text-secondary hover:text-text-primary hover:bg-white/8 transition-colors"
          >
            Browse
          </button>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onClone}
          disabled={!canClone}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clone &amp; Import →
        </button>
      </div>
    </div>
  );
}

// ── Cloning progress ──────────────────────────────────────────────────────────

function CloningPhase({ log }: { log: string[] }) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <svg className="w-4 h-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Cloning repository...
      </div>
      <div
        ref={logRef}
        className="h-40 overflow-y-auto rounded-lg bg-black/40 border border-white/8 p-3 font-mono text-[11px] text-text-secondary leading-relaxed"
      >
        {log.map((line, i) => (
          <span key={i}>{line}</span>
        ))}
      </div>
    </div>
  );
}

// ── Confirm phase ─────────────────────────────────────────────────────────────

function ConfirmPhase({
  detected,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  preferredAgent,
  onAgentChange,
  generateMissing,
  onGenerateMissingChange,
  overwrite,
  onOverwriteChange,
  error,
  onCancel,
  onImport,
}: {
  detected: DetectedProject;
  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  preferredAgent: AgentType;
  onAgentChange: (a: AgentType) => void;
  generateMissing: boolean;
  onGenerateMissingChange: (v: boolean) => void;
  overwrite: boolean;
  onOverwriteChange: (v: boolean) => void;
  error: string | null;
  onCancel: () => void;
  onImport: () => void;
}) {
  return (
    <div className="space-y-4">
      <DetectedBanner detected={detected} />

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Project Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Description</label>
        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 transition-colors resize-none"
          placeholder="Optional description..."
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-text-secondary">Preferred Agent</label>
        <AgentSelector value={preferredAgent} onChange={onAgentChange} />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={generateMissing}
            onChange={(e) => onGenerateMissingChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-accent"
          />
          <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
            Generate missing context files
          </span>
        </label>
        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => onOverwriteChange(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-accent"
          />
          <span className="text-xs text-text-secondary group-hover:text-text-primary transition-colors">
            Overwrite existing context files
          </span>
        </label>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onImport}
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Import Project →
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ImportProjectDialog({ mode, onClose, onImported }: ImportProjectDialogProps) {
  const api = useAPI();

  const [phase, setPhase] = useState<Phase>(mode === 'local' ? 'scanning' : 'url-entry');
  const [detected, setDetected] = useState<DetectedProject | null>(null);

  // Clone-specific state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneDestination, setCloneDestination] = useState('');
  const [cloneLog, setCloneLog] = useState<string[]>([]);
  const cloneDestRef = useRef(cloneDestination);
  cloneDestRef.current = cloneDestination;

  // Confirm-phase form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [preferredAgent, setPreferredAgent] = useState<AgentType>('claude');
  const [generateMissing, setGenerateMissing] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GitHub repo list (for clone mode, if connected)
  const { data: ghRepos } = useQuery(
    () => api.github.listRepos().catch(() => [] as { name: string; url: string; fullName: string }[]),
    [],
  );

  // ── Local mode: auto-trigger folder picker then scan ──────────────────────
  useEffect(() => {
    if (mode !== 'local') return;
    let cancelled = false;
    api.system.selectDirectory().then(async (folder) => {
      if (cancelled) return;
      if (!folder) { onClose(); return; }
      try {
        const result = await api.projects.scanFolder(folder);
        if (!cancelled) {
          setDetected(result);
          setName(result.name);
          setDescription(result.description);
          setPreferredAgent('claude');
          setPhase('confirm');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Scan failed');
          onClose();
        }
      }
    }).catch(() => {
      if (!cancelled) onClose();
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Clone progress subscription ───────────────────────────────────────────
  useEffect(() => {
    api.github.onCloneProgress((data) => {
      if (data.message) {
        setCloneLog(prev => {
          const combined = [...prev];
          combined.push(data.message);
          return combined.slice(-200);
        });
      }
      if (data.done && !data.error) {
        // Clone complete — scan the destination
        const dest = cloneDestRef.current;
        api.projects.scanFolder(dest).then((result) => {
          setDetected(result);
          setName(result.name);
          setDescription(result.description);
          setPreferredAgent('claude');
          setPhase('confirm');
        }).catch(() => {
          // Scanning failed but clone succeeded — still go to confirm with minimal info
          const fallbackDetected: DetectedProject = {
            name: dest.split('/').pop() || 'project',
            path: dest,
            description: '',
            languages: [],
            framework: null,
            packageManager: null,
            hasGit: true,
            gitRemote: cloneUrl,
            existingContextFiles: [],
            detectedInputs: [],
          };
          setDetected(fallbackDetected);
          setName(fallbackDetected.name);
          setPhase('confirm');
        });
      }
      if (data.error) {
        setError(data.error);
        setPhase('url-entry');
      }
    });
    return () => api.github.offCloneProgress();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePickDestination() {
    const folder = await api.system.selectDirectory();
    if (folder) setCloneDestination(folder);
  }

  async function handleClone() {
    if (!cloneUrl.trim() || !cloneDestination.trim()) return;
    setCloneLog([]);
    setError(null);
    setPhase('cloning');
    try {
      await api.github.cloneRepo(cloneUrl.trim(), cloneDestination.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clone failed');
      setPhase('url-entry');
    }
  }

  async function handleImport() {
    if (!detected || !name.trim()) return;
    setError(null);
    setPhase('importing');
    try {
      const project = await api.projects.import({
        name: name.trim(),
        description: description.trim(),
        path: detected.path,
        inputs: detected.detectedInputs,
        preferredAgent,
        generateMissingContextFiles: generateMissing,
        overwriteExistingContextFiles: overwrite,
      });
      onImported(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setPhase('confirm');
    }
  }

  const title = mode === 'local' ? 'Import Existing Project' : 'Clone from GitHub';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-lg bg-surface rounded-xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-white/8 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <AnimatePresence mode="wait">
            {phase === 'scanning' && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-3"
              >
                <svg className="w-6 h-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm text-text-muted">Scanning folder...</span>
              </motion.div>
            )}

            {phase === 'url-entry' && (
              <motion.div key="url-entry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ClonePhase
                  url={cloneUrl}
                  onUrlChange={setCloneUrl}
                  ghRepos={ghRepos}
                  destination={cloneDestination}
                  onPickDestination={handlePickDestination}
                  onClone={handleClone}
                  onCancel={onClose}
                />
                {error && (
                  <p className="mt-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                    {error}
                  </p>
                )}
              </motion.div>
            )}

            {phase === 'cloning' && (
              <motion.div key="cloning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CloningPhase log={cloneLog} />
              </motion.div>
            )}

            {phase === 'confirm' && detected && (
              <motion.div key="confirm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ConfirmPhase
                  detected={detected}
                  name={name}
                  onNameChange={setName}
                  description={description}
                  onDescriptionChange={setDescription}
                  preferredAgent={preferredAgent}
                  onAgentChange={setPreferredAgent}
                  generateMissing={generateMissing}
                  onGenerateMissingChange={setGenerateMissing}
                  overwrite={overwrite}
                  onOverwriteChange={setOverwrite}
                  error={error}
                  onCancel={onClose}
                  onImport={handleImport}
                />
              </motion.div>
            )}

            {phase === 'importing' && (
              <motion.div
                key="importing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-10 gap-3"
              >
                <svg className="w-6 h-6 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span className="text-sm text-text-muted">Importing project...</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
