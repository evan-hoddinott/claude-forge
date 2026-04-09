import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { Project, VibeImportPreview } from '../../shared/types';

interface Props {
  onClose: () => void;
  onImported: (project: Project | null) => void;
}

type ImportMode = 'new' | 'merge';

export default function ImportVibeDialog({ onClose, onImported }: Props) {
  const api = useAPI();
  const { toast } = useToast();

  const [filePath, setFilePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<VibeImportPreview | null>(null);

  const [mode, setMode] = useState<ImportMode>('new');
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [importing, setImporting] = useState(false);
  const [picking, setPicking] = useState(false);

  async function handlePickFile() {
    setPicking(true);
    try {
      const result = await api.vibe.pickAndPreview();
      if (result) {
        setFilePath(result.filePath);
        setPreview(result.preview);
        setProjectName(result.preview.manifest.name);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to read bundle', 'error');
    } finally {
      setPicking(false);
    }
  }

  async function handleSelectFolder() {
    const dir = await api.system.selectDirectory();
    if (dir) setProjectPath(dir);
  }

  async function handleImport() {
    if (!filePath || !projectPath) return;
    setImporting(true);
    try {
      const result = await api.vibe.import(filePath, mode, projectPath, undefined, projectName || undefined);
      toast(mode === 'new' ? `"${result?.name}" imported from bundle` : 'Bundle applied to project');
      onImported(result);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  const canImport = !!filePath && !!projectPath && !importing;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-lg mx-4 rounded-xl bg-surface border border-white/[0.1] shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2.5">
              <ImportIcon />
              <h2 className="text-base font-semibold text-text-primary">Import .vibe Bundle</h2>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Phase 1: pick file */}
            {!preview ? (
              <PickPhase onPick={handlePickFile} picking={picking} />
            ) : (
              <>
                {/* Preview */}
                <PreviewSection preview={preview} />

                <div className="border-t border-white/[0.06]" />

                {/* Import mode */}
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Import as</p>
                  <div className="space-y-2">
                    <RadioOption
                      checked={mode === 'new'}
                      onChange={() => setMode('new')}
                      label="New project"
                      description="Creates a folder and adds to dashboard"
                    />
                    <RadioOption
                      checked={mode === 'merge'}
                      onChange={() => setMode('merge')}
                      label="Apply to existing project"
                      description="Merges context files into an existing project"
                    />
                  </div>
                </div>

                {/* Path input */}
                {mode === 'new' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">
                      {mode === 'new' ? 'Project folder' : 'Existing project folder'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder="~/Projects/my-project"
                        className="flex-1 bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                      />
                      <button
                        onClick={handleSelectFolder}
                        className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-secondary text-sm transition-colors"
                        title="Browse"
                      >
                        <FolderIcon />
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'merge' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Existing project folder</label>
                    <div className="flex gap-2">
                      <input
                        value={projectPath}
                        onChange={(e) => setProjectPath(e.target.value)}
                        placeholder="~/Projects/existing-project"
                        className="flex-1 bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                      />
                      <button
                        onClick={handleSelectFolder}
                        className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-secondary text-sm transition-colors"
                        title="Browse"
                      >
                        <FolderIcon />
                      </button>
                    </div>
                  </div>
                )}

                {mode === 'new' && (
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Project name</label>
                    <input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                      placeholder={preview.manifest.name}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            {preview && (
              <button
                onClick={handleImport}
                disabled={!canImport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-bg/40 border-t-bg animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <ImportIcon small />
                    Import Bundle
                  </>
                )}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PickPhase({ onPick, picking }: { onPick: () => void; picking: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-8 text-center"
    >
      <div className="text-3xl mb-3">📦</div>
      <p className="text-sm text-text-secondary mb-6">
        Select a <span className="font-mono text-accent">.vibe</span> bundle file to import
      </p>
      <button
        onClick={onPick}
        disabled={picking}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors disabled:opacity-50 mx-auto"
      >
        {picking ? (
          <>
            <span className="w-3 h-3 rounded-full border-2 border-bg/40 border-t-bg animate-spin" />
            Opening...
          </>
        ) : (
          'Choose .vibe file'
        )}
      </button>
    </motion.div>
  );
}

function PreviewSection({ preview }: { preview: VibeImportPreview }) {
  const { manifest } = preview;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
      <div className="rounded-lg bg-bg border border-white/[0.08] p-4">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xl">📦</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text-primary">
              {manifest.name}
              <span className="ml-2 text-xs text-text-muted font-normal">v{manifest.version}</span>
            </p>
            {manifest.author && (
              <p className="text-xs text-text-muted">By: {manifest.author}</p>
            )}
            {manifest.description && (
              <p className="text-xs text-text-secondary mt-1">{manifest.description}</p>
            )}
          </div>
        </div>
        {manifest.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {manifest.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <ContainsBadge present={preview.hasContextFiles} label={`AI context files (${preview.contextFileCount})`} />
          <ContainsBadge present={preview.hasProjectConfig} label="Project configuration" />
          <ContainsBadge present={preview.hasDecisions} label="Decisions & patterns" />
          <ContainsBadge present={preview.hasConstraints} label="Hardware constraints" />
          <ContainsBadge present={preview.hasChatHistory} label="Chat history" />
        </div>
      </div>
    </motion.div>
  );
}

function ContainsBadge({ present, label }: { present: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 ${present ? 'text-status-ready' : 'text-text-muted'}`}>
      <span>{present ? '✅' : '⚪'}</span>
      <span>{label}</span>
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  description: string;
}) {
  return (
    <label
      onClick={onChange}
      className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:border-accent/30"
      style={{ borderColor: checked ? 'rgba(var(--accent-rgb), 0.4)' : 'rgba(255,255,255,0.08)', backgroundColor: checked ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent' }}
    >
      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${checked ? 'border-accent' : 'border-white/[0.2]'}`}>
        {checked && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
      </div>
      <div>
        <p className="text-sm text-text-primary font-medium">{label}</p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </label>
  );
}

function ImportIcon({ small }: { small?: boolean }) {
  const cls = small ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3v8M5 8l3 3 3-3" />
      <path d="M2 13h12" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 4.5A1.5 1.5 0 012.5 3H6l2 2h5.5A1.5 1.5 0 0115 6.5v6A1.5 1.5 0 0113.5 14h-11A1.5 1.5 0 011 12.5v-8z" />
    </svg>
  );
}
