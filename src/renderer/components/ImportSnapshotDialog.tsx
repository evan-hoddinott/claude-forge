import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { Project, SnapshotImportPreview } from '../../shared/types';

interface Props {
  onClose: () => void;
  onImported: (project: Project) => void;
}

type Step = 'pick' | 'preview' | 'configure' | 'importing' | 'done';

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch { return iso; }
}

export default function ImportSnapshotDialog({ onClose, onImported }: Props) {
  const api = useAPI();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('pick');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [preview, setPreview] = useState<SnapshotImportPreview | null>(null);
  const [projectPath, setProjectPath] = useState('');
  const [projectName, setProjectName] = useState('');
  const [importedProject, setImportedProject] = useState<Project | null>(null);

  async function handlePick() {
    try {
      const result = await api.snapshot.pickAndPreview();
      if (!result) return;
      setFilePath(result.filePath);
      setPreview(result.preview);
      setProjectName(result.preview.manifest.name);
      setStep('preview');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not open snapshot', 'error');
    }
  }

  async function handleSelectDestination() {
    try {
      const dir = await api.system.selectDirectory();
      if (dir) setProjectPath(dir);
    } catch { /* user cancelled */ }
  }

  async function handleImport() {
    if (!filePath || !projectPath) return;
    setStep('importing');
    try {
      const project = await api.snapshot.import(filePath, projectPath, projectName || undefined);
      if (project) {
        setImportedProject(project);
        setStep('done');
        toast('Snapshot imported successfully');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Import failed', 'error');
      setStep('configure');
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={step === 'importing' ? undefined : onClose}
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
              <h2 className="text-base font-semibold text-text-primary">Import Project Snapshot</h2>
            </div>
            {step !== 'importing' && (
              <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
                <CloseIcon />
              </button>
            )}
          </div>

          <div className="px-5 py-5 max-h-[75vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              {step === 'pick' && (
                <motion.div
                  key="pick"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-center py-8"
                >
                  <div className="text-4xl mb-4">📸</div>
                  <p className="text-sm font-medium text-text-primary mb-2">Open a .cfsnap file</p>
                  <p className="text-xs text-text-muted mb-6 max-w-xs mx-auto leading-relaxed">
                    A snapshot contains the full project — code, git history, AI context, and chat.
                    Pick up exactly where someone else left off.
                  </p>
                  <button
                    onClick={handlePick}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
                  >
                    <ImportIcon small />
                    Choose Snapshot File
                  </button>
                </motion.div>
              )}

              {step === 'preview' && preview && (
                <motion.div
                  key="preview"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  {/* Snapshot info */}
                  <div className="p-4 rounded-lg bg-bg border border-white/[0.08]">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{preview.manifest.name}</p>
                        {preview.manifest.description && (
                          <p className="text-xs text-text-muted mt-0.5">{preview.manifest.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-text-muted shrink-0 font-mono">
                        {formatBytes(preview.fileSizeBytes)}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted">
                      Created {formatDate(preview.manifest.created)}
                    </p>
                  </div>

                  {/* Contents */}
                  <div>
                    <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2.5">Contents</p>
                    <div className="space-y-1.5">
                      <ContentRow
                        icon="📁"
                        label="Source code"
                        present={preview.hasSource}
                        detail={preview.hasSource ? `${preview.sourceFileCount} files` : undefined}
                      />
                      <ContentRow icon="🌿" label="Git history" present={preview.hasGit} />
                      <ContentRow icon="🧠" label="AI context (.vibe)" present={preview.hasVibe} />
                      <ContentRow icon="💬" label="Chat history" present={preview.hasChatHistory} />
                    </div>
                  </div>

                  {/* Warnings */}
                  {preview.manifest.warnings && preview.manifest.warnings.length > 0 && (
                    <div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
                      <p className="text-xs font-medium text-amber-400 mb-1.5">Notes from creator</p>
                      {preview.manifest.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-400/80 leading-relaxed">{w}</p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setStep('configure')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
                  >
                    Continue
                    <ChevronRightIcon />
                  </button>
                </motion.div>
              )}

              {step === 'configure' && preview && (
                <motion.div
                  key="configure"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Project name</label>
                    <input
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                      placeholder={preview.manifest.name}
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-text-muted mb-1.5">Destination folder</label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm font-mono text-text-secondary truncate">
                        {projectPath || <span className="text-text-muted">No folder selected</span>}
                      </div>
                      <button
                        onClick={handleSelectDestination}
                        className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-secondary text-sm transition-colors shrink-0"
                      >
                        Browse
                      </button>
                    </div>
                    <p className="text-xs text-text-muted mt-1.5">
                      Files will be extracted here.
                      {preview.hasGit && ' Git history will be cloned into this folder.'}
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setStep('preview')}
                      className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
                    >
                      Back
                    </button>
                    <button
                      onClick={handleImport}
                      disabled={!projectPath}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ImportIcon small />
                      Import Snapshot
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'importing' && (
                <motion.div
                  key="importing"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-10 text-center"
                >
                  <div className="w-8 h-8 rounded-full border-2 border-accent/30 border-t-accent animate-spin mx-auto mb-4" />
                  <p className="text-sm font-medium text-text-primary mb-1">Importing snapshot…</p>
                  <p className="text-xs text-text-muted">
                    Extracting source, restoring git history, and importing context.
                  </p>
                </motion.div>
              )}

              {step === 'done' && importedProject && (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-8 text-center"
                >
                  <div className="text-3xl mb-3">✓</div>
                  <p className="text-base font-semibold text-text-primary mb-1">Snapshot Imported!</p>
                  <p className="text-xs text-text-muted mb-6">
                    <span className="text-text-secondary font-medium">{importedProject.name}</span> is ready.
                    Code, history, and AI context restored.
                  </p>
                  <button
                    onClick={() => onImported(importedProject)}
                    className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
                  >
                    Open Project
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ContentRow({
  icon, label, present, detail,
}: { icon: string; label: string; present: boolean; detail?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-xs py-1 ${present ? 'text-text-secondary' : 'text-text-muted'}`}>
      <span className={present ? 'opacity-100' : 'opacity-30'}>{icon}</span>
      <span className={present ? '' : 'line-through opacity-40'}>{label}</span>
      {detail && present && (
        <span className="text-text-muted ml-auto">{detail}</span>
      )}
      {!present && (
        <span className="ml-auto text-text-muted opacity-60">not included</span>
      )}
    </div>
  );
}

function ImportIcon({ small }: { small?: boolean }) {
  const cls = small ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1v9M5 7l3 3 3-3" />
      <path d="M1 11v2a2 2 0 002 2h10a2 2 0 002-2v-2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3l5 5-5 5" />
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
