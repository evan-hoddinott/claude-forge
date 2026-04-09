import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { Project } from '../../shared/types';

interface Props {
  project: Project;
  onClose: () => void;
}

export default function ExportVibeDialog({ project, onClose }: Props) {
  const api = useAPI();
  const { toast } = useToast();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [author, setAuthor] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(project.tags ?? []);

  const [includeContextFiles, setIncludeContextFiles] = useState(true);
  const [includeProjectConfig, setIncludeProjectConfig] = useState(true);
  const [includeDecisionFiles, setIncludeDecisionFiles] = useState(true);
  const [includeChatHistory, setIncludeChatHistory] = useState(false);
  const [includeConstraints, setIncludeConstraints] = useState(false);

  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleExport() {
    setExporting(true);
    try {
      const result = await api.vibe.export({
        projectId: project.id,
        name,
        description,
        author,
        tags,
        includeContextFiles,
        includeProjectConfig,
        includeDecisionFiles,
        includeChatHistory,
        includeConstraints,
      });
      if (result) {
        setExported(result);
        toast('Bundle exported successfully');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
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
              <BundleIcon />
              <h2 className="text-base font-semibold text-text-primary">Export .vibe Bundle</h2>
            </div>
            <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
              <CloseIcon />
            </button>
          </div>

          <div className="px-5 py-4 space-y-5 max-h-[70vh] overflow-y-auto">
            {exported ? (
              <SuccessState filePath={exported} onClose={onClose} />
            ) : (
              <>
                {/* Inclusions */}
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">What to include</p>
                  <div className="space-y-2">
                    <Checkbox
                      checked={includeContextFiles}
                      onChange={setIncludeContextFiles}
                      label="AI context files (CLAUDE.md, GEMINI.md, etc.)"
                    />
                    <Checkbox
                      checked={includeProjectConfig}
                      onChange={setIncludeProjectConfig}
                      label="Project configuration and inputs"
                    />
                    <Checkbox
                      checked={includeDecisionFiles}
                      onChange={setIncludeDecisionFiles}
                      label="Coding decisions and patterns (auto-generated)"
                    />
                    <Checkbox
                      checked={includeChatHistory}
                      onChange={setIncludeChatHistory}
                      label="Chat history excerpts"
                    />
                    <Checkbox
                      checked={includeConstraints}
                      onChange={setIncludeConstraints}
                      label="Hardware / environment constraints"
                    />
                  </div>
                </div>

                <div className="border-t border-white/[0.06]" />

                {/* Bundle info */}
                <div>
                  <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Bundle info</p>
                  <div className="space-y-3">
                    <FormField label="Name">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                        placeholder="my-project-bundle"
                      />
                    </FormField>

                    <FormField label="Description">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors resize-none"
                        rows={2}
                        placeholder="A starter for..."
                      />
                    </FormField>

                    <FormField label="Author">
                      <input
                        value={author}
                        onChange={(e) => setAuthor(e.target.value)}
                        className="w-full bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                        placeholder="Your name"
                      />
                    </FormField>

                    <FormField label="Tags">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent/10 border border-accent/20 text-accent text-xs"
                          >
                            {tag}
                            <button
                              onClick={() => removeTag(tag)}
                              className="hover:text-accent-hover ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                          className="flex-1 bg-bg border border-white/[0.1] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                          placeholder="nextjs, typescript... (Enter to add)"
                        />
                        <button
                          onClick={addTag}
                          className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-text-secondary text-sm transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </FormField>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          {!exported && (
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExport}
                disabled={exporting || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-bg/40 border-t-bg animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <BundleIcon small />
                    Export Bundle
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div
        onClick={() => onChange(!checked)}
        className={`w-4 h-4 rounded border transition-colors flex-shrink-0 flex items-center justify-center ${
          checked
            ? 'bg-accent border-accent'
            : 'border-white/[0.2] bg-transparent group-hover:border-white/[0.35]'
        }`}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-bg" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1.5 5 4 7.5 8.5 2.5" />
          </svg>
        )}
      </div>
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">{label}</span>
    </label>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-text-muted mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function SuccessState({ filePath, onClose }: { filePath: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-6 text-center"
    >
      <div className="text-3xl mb-3">📦</div>
      <p className="text-base font-semibold text-text-primary mb-1">Bundle Exported!</p>
      <p className="text-xs text-text-muted mb-4">Share it with anyone to reproduce this project context.</p>
      <p className="text-xs text-text-secondary font-mono bg-bg rounded-lg px-3 py-2 mb-5 break-all">{filePath}</p>
      <button
        onClick={onClose}
        className="px-5 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
      >
        Done
      </button>
    </motion.div>
  );
}

function BundleIcon({ small }: { small?: boolean }) {
  const cls = small ? 'w-3 h-3' : 'w-4 h-4';
  return (
    <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="5" width="14" height="10" rx="1.5" />
      <path d="M5 5V3.5A1.5 1.5 0 016.5 2h3A1.5 1.5 0 0111 3.5V5" />
      <path d="M1 9h14" />
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
