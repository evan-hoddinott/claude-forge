import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from '../components/Toast';
import type { HubItem, HubCatalog, HubItemType, HubPublishInput, Project } from '../../shared/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | HubItemType;
type HubView = 'list' | 'detail' | 'publish';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const TYPE_COLORS: Record<HubItemType, string> = {
  skill: 'text-[var(--forge-accent-green)] border-[var(--forge-accent-green)]/40 bg-[var(--forge-accent-green)]/10',
  template: 'text-[var(--forge-accent-amber)] border-[var(--forge-accent-amber)]/40 bg-[var(--forge-accent-amber)]/10',
  constraint: 'text-orange-400 border-orange-400/40 bg-orange-400/10',
  playbook: 'text-sky-400 border-sky-400/40 bg-sky-400/10',
};

const ICON_MAP: Record<string, string> = {
  shield: '🛡',
  brush: '🎨',
  flask: '🧪',
  book: '📖',
  zap: '⚡',
  eye: '👁',
  'eye-off': '♿',
  'git-branch': '🌿',
  layout: '🏗',
  user: '🧑',
  'message-circle': '💬',
  server: '🖥',
  puzzle: '🧩',
  terminal: '⌨',
  cpu: '🔧',
  radio: '📡',
  'wifi-off': '📴',
  clock: '⏳',
  lock: '🔐',
  'git-merge': '🔀',
  database: '🗄',
  smartphone: '📱',
};

function ItemIcon({ icon, size = 'md' }: { icon: string; size?: 'sm' | 'md' | 'lg' }) {
  const emoji = ICON_MAP[icon] ?? '📦';
  const cls = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-base' : 'text-xl';
  return <span className={cls}>{emoji}</span>;
}

// ── StarRating ─────────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className="flex items-center gap-1">
      <span className="flex gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={`text-[10px] ${i < full ? 'text-amber-400' : i === full && half ? 'text-amber-400/60' : 'text-white/20'}`}
          >
            ■
          </span>
        ))}
      </span>
      <span className="text-[10px] text-text-muted font-mono">{rating.toFixed(1)}</span>
      {count > 0 && <span className="text-[10px] text-text-muted">({count})</span>}
    </span>
  );
}

// ── TypeBadge ─────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: HubItemType }) {
  return (
    <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${TYPE_COLORS[type]}`}>
      {type}
    </span>
  );
}

// ── HubItemCard ───────────────────────────────────────────────────────────────

function HubItemCard({
  item,
  onSelect,
  installed,
}: {
  item: HubItem;
  onSelect: (item: HubItem) => void;
  installed: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(item)}
      className="text-left w-full bg-surface border border-white/8 rounded-xl p-4 hover:border-white/16 hover:bg-surface-hover transition-all duration-150 group"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
          <ItemIcon icon={item.icon} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-text-primary truncate">{item.name}</span>
            {item.official && (
              <span className="text-[9px] font-mono text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-1 py-px rounded shrink-0">
                OFFICIAL
              </span>
            )}
            {installed && (
              <span className="text-[9px] font-mono text-green-400/80 bg-green-400/10 border border-green-400/20 px-1 py-px rounded shrink-0">
                INSTALLED
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted line-clamp-2 mb-2">{item.description}</p>
          <div className="flex items-center gap-3">
            <TypeBadge type={item.type} />
            <StarRating rating={item.rating} count={item.ratingCount} />
            <span className="text-[10px] text-text-muted font-mono ml-auto">⬇ {formatDownloads(item.downloads)}</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ── FeaturedRow ───────────────────────────────────────────────────────────────

function FeaturedRow({ items, onSelect, installedIds }: { items: HubItem[]; onSelect: (item: HubItem) => void; installedIds: Set<string> }) {
  const featured = items.filter((i) => i.featured);
  if (featured.length === 0) return null;
  return (
    <div>
      <h2 className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
        ⭐ Featured
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
        {featured.map((item) => (
          <motion.button
            key={item.id}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(item)}
            className="shrink-0 w-44 bg-surface border border-white/8 rounded-xl p-3 hover:border-white/16 hover:bg-surface-hover transition-all text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center mb-2">
              <ItemIcon icon={item.icon} size="sm" />
            </div>
            <div className="text-xs font-semibold text-text-primary mb-1 truncate">{item.name}</div>
            <StarRating rating={item.rating} count={0} />
            <div className="text-[10px] text-text-muted font-mono mt-1">⬇ {formatDownloads(item.downloads)}</div>
            {installedIds.has(item.id) && (
              <div className="text-[9px] text-green-400 mt-1">✓ Installed</div>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ── FilterTabs ────────────────────────────────────────────────────────────────

function FilterTabs({ active, onChange, counts }: {
  active: FilterTab;
  onChange: (t: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'skill', label: 'Skills' },
    { id: 'template', label: 'Templates' },
    { id: 'constraint', label: 'Constraints' },
    { id: 'playbook', label: 'Playbooks' },
  ];
  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1.5 text-[11px] font-mono rounded-lg transition-all ${
            active === tab.id
              ? 'bg-[var(--forge-accent-amber)] text-black font-bold'
              : 'text-text-muted hover:text-text-primary hover:bg-white/5'
          }`}
        >
          {tab.label}
          <span className="ml-1.5 opacity-60">({counts[tab.id]})</span>
        </button>
      ))}
    </div>
  );
}

// ── ItemDetailView ────────────────────────────────────────────────────────────

function ItemDetailView({
  item,
  projects,
  installedIds,
  onBack,
  onInstall,
}: {
  item: HubItem;
  projects: Project[];
  installedIds: Set<string>;
  onBack: () => void;
  onInstall: (itemId: string, projectPath: string) => Promise<void>;
}) {
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(installedIds.has(item.id));
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  async function handleInstall(project: Project) {
    setShowProjectPicker(false);
    setInstalling(true);
    try {
      await onInstall(item.id, project.path);
      setInstalled(true);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Back */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[11px] text-text-muted hover:text-text-primary transition-colors font-mono"
        >
          ← Back to Hub
        </button>

        {/* Header */}
        <div className="bg-surface border border-white/8 rounded-xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
              <ItemIcon icon={item.icon} size="lg" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h1 className="text-xl font-bold text-text-primary">{item.name}</h1>
                <span className="text-xs font-mono text-text-muted">v{item.version}</span>
                {item.official && (
                  <span className="text-[9px] font-mono text-amber-400/80 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    OFFICIAL
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-muted mb-2">
                By{' '}
                <span className="text-text-primary">{item.author.name}</span>
                {item.author.verified && <span className="text-amber-400 ml-1">✓</span>}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <StarRating rating={item.rating} count={item.ratingCount} />
                <span className="text-[11px] text-text-muted font-mono">⬇ {item.downloads.toLocaleString()} downloads</span>
                <TypeBadge type={item.type} />
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-white/8 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] text-text-muted font-mono uppercase mb-1">Size</div>
              <div className="text-xs font-mono text-text-primary">{formatSize(item.size)}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted font-mono uppercase mb-1">Updated</div>
              <div className="text-xs font-mono text-text-primary">{formatRelativeDate(item.updatedAt)}</div>
            </div>
            <div>
              <div className="text-[10px] text-text-muted font-mono uppercase mb-1">Category</div>
              <div className="text-xs font-mono text-text-primary capitalize">{item.category}</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-surface border border-white/8 rounded-xl p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-3">Description</h2>
          <p className="text-sm text-text-secondary leading-relaxed">{item.longDescription}</p>
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] font-mono text-text-muted bg-white/5 border border-white/8 px-2 py-0.5 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Compatible agents */}
        <div className="bg-surface border border-white/8 rounded-xl p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-3">Works with</h2>
          <div className="flex flex-wrap gap-2">
            {item.agents.map((agent) => (
              <span
                key={agent}
                className="text-[11px] font-mono text-text-primary bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg capitalize"
              >
                {agent === 'claude' ? 'Claude Code' :
                 agent === 'gemini' ? 'Gemini CLI' :
                 agent === 'codex' ? 'OpenAI Codex' :
                 agent === 'copilot' ? 'GitHub Copilot' :
                 agent === 'ollama' ? 'Local AI' : agent}
              </span>
            ))}
          </div>
        </div>

        {/* Install */}
        <div className="bg-surface border border-white/8 rounded-xl p-5">
          <h2 className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-3">Install</h2>
          {installed ? (
            <div className="flex items-center gap-2 text-green-400 text-sm font-mono">
              <span>✓</span>
              <span>Installed to this project</span>
            </div>
          ) : projects.length === 0 ? (
            <p className="text-sm text-text-muted">No projects yet. Create a project first.</p>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowProjectPicker((v) => !v)}
                disabled={installing}
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--forge-accent-amber)] text-black text-sm font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-50"
              >
                {installing ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Installing…
                  </>
                ) : (
                  <>
                    Install to Project ▾
                  </>
                )}
              </button>

              <AnimatePresence>
                {showProjectPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full left-0 mt-1 w-64 bg-surface border border-white/12 rounded-xl shadow-xl z-10 overflow-hidden"
                  >
                    {projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleInstall(p)}
                        className="w-full text-left px-4 py-3 text-sm text-text-primary hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-[10px] text-text-muted font-mono truncate">{p.path}</div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PublisherWizard ────────────────────────────────────────────────────────────

const PUBLISH_STEPS = ['Type', 'Details', 'Tags', 'Preview', 'Submit'];

function PublisherWizard({ onClose }: { onClose: () => void }) {
  const api = useAPI();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<HubPublishInput>({
    name: '',
    type: 'skill',
    description: '',
    longDescription: '',
    category: '',
    tags: [],
    icon: 'zap',
  });
  const [tagInput, setTagInput] = useState('');

  function setField<K extends keyof HubPublishInput>(key: K, value: HubPublishInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '-');
    if (t && !form.tags.includes(t)) {
      setField('tags', [...form.tags, t]);
    }
    setTagInput('');
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const result = await api.hub.publish(form);
      toast('Submission opened in browser!', 'success');
      window.electronAPI.system.openExternal(result.url).catch(() => { /* ignore */ });
      onClose();
    } catch (err) {
      toast('Failed to open submission', 'error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  const canAdvance =
    step === 0 ? true :
    step === 1 ? form.name.length > 2 && form.description.length > 10 && form.category.length > 1 :
    step === 2 ? form.tags.length > 0 :
    step === 3 ? true : true;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-bg border border-white/12 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-text-primary">Publish to Forge Hub</h2>
            <p className="text-[11px] text-text-muted">Step {step + 1} of {PUBLISH_STEPS.length}: {PUBLISH_STEPS[step]}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-lg">×</button>
        </div>

        {/* Progress */}
        <div className="flex gap-1 px-6 pt-4">
          {PUBLISH_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all ${i <= step ? 'bg-[var(--forge-accent-amber)]' : 'bg-white/10'}`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-5 space-y-4 min-h-[240px]">
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">What are you publishing?</p>
              <div className="grid grid-cols-2 gap-2">
                {(['skill', 'template', 'constraint', 'playbook'] as HubItemType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setField('type', t)}
                    className={`p-3 rounded-xl border text-sm font-mono capitalize transition-all ${
                      form.type === t
                        ? 'border-[var(--forge-accent-amber)] bg-[var(--forge-accent-amber)]/10 text-[var(--forge-accent-amber)]'
                        : 'border-white/8 text-text-muted hover:border-white/16'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-mono text-text-muted uppercase mb-1 block">Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder="My Awesome Skill"
                  className="w-full bg-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--forge-accent-amber)]/60"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted uppercase mb-1 block">Short description *</label>
                <input
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="One-line summary of what it does"
                  className="w-full bg-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--forge-accent-amber)]/60"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted uppercase mb-1 block">Category *</label>
                <input
                  value={form.category}
                  onChange={(e) => setField('category', e.target.value)}
                  placeholder="e.g. security, design, testing"
                  className="w-full bg-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--forge-accent-amber)]/60"
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-text-muted uppercase mb-1 block">Long description</label>
                <textarea
                  value={form.longDescription}
                  onChange={(e) => setField('longDescription', e.target.value)}
                  placeholder="Detailed description of features, use cases, and how it works"
                  rows={3}
                  className="w-full bg-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--forge-accent-amber)]/60 resize-none"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">Add tags to help people find your {form.type}.</p>
              <div className="flex gap-2">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
                  placeholder="Type a tag and press Enter"
                  className="flex-1 bg-surface border border-white/8 rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-[var(--forge-accent-amber)]/60"
                />
                <button
                  onClick={addTag}
                  className="px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-sm text-text-muted hover:text-text-primary hover:border-white/16 transition-all"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {form.tags.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 text-[11px] font-mono text-text-muted bg-white/5 border border-white/8 px-2 py-0.5 rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => setField('tags', form.tags.filter((t) => t !== tag))}
                      className="text-text-muted hover:text-red-400 transition-colors leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              {form.tags.length === 0 && (
                <p className="text-[11px] text-text-muted italic">At least one tag required</p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <p className="text-[11px] text-text-muted">Preview how your {form.type} will appear in the Hub:</p>
              <div className="bg-surface border border-white/8 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-xl">
                    {ICON_MAP[form.icon] ?? '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-text-primary">{form.name || 'Untitled'}</span>
                    </div>
                    <p className="text-[11px] text-text-muted mb-2">{form.description || 'No description'}</p>
                    <div className="flex items-center gap-2">
                      <TypeBadge type={form.type} />
                      {form.tags.slice(0, 3).map((t) => (
                        <span key={t} className="text-[9px] font-mono text-text-muted bg-white/5 px-1.5 py-0.5 rounded-full">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-text-muted">
                Clicking Submit will open a GitHub issue in your browser pre-filled with your submission details.
                The Forge Hub maintainers will review and add it to the catalog.
              </p>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3 text-center py-4">
              <div className="text-4xl">🚀</div>
              <p className="text-sm font-semibold text-text-primary">Ready to submit!</p>
              <p className="text-[11px] text-text-muted leading-relaxed">
                We'll open a GitHub issue pre-filled with your submission.
                After review, your {form.type} will appear in Forge Hub for the community.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : onClose()}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            {step === 0 ? 'Cancel' : '← Back'}
          </button>
          <button
            disabled={!canAdvance || submitting}
            onClick={() => step < PUBLISH_STEPS.length - 1 ? setStep(s => s + 1) : handleSubmit()}
            className="px-5 py-2 bg-[var(--forge-accent-amber)] text-black text-sm font-bold rounded-lg hover:brightness-110 transition-all disabled:opacity-40"
          >
            {submitting ? 'Opening…' : step < PUBLISH_STEPS.length - 1 ? 'Next →' : 'Submit to Hub'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main Hub Page ─────────────────────────────────────────────────────────────

interface HubProps {
  projects: Project[];
}

export default function Hub({ projects }: HubProps) {
  const api = useAPI();
  const { toast } = useToast();

  const [catalog, setCatalog] = useState<HubCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [view, setView] = useState<HubView>('list');
  const [selectedItem, setSelectedItem] = useState<HubItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPublisher, setShowPublisher] = useState(false);

  // Track installed items per project path
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());

  // Load installed items for all projects
  useEffect(() => {
    const ids = new Set<string>();
    Promise.all(
      projects.map((p) =>
        api.hub.getInstalled(p.path).then((list: string[]) => {
          list.forEach((id) => ids.add(id));
        }).catch(() => { /* ignore */ }),
      ),
    ).then(() => setInstalledIds(new Set(ids)));
  }, [projects, api]);

  // Fetch catalog on mount
  useEffect(() => {
    setLoading(true);
    api.hub.fetchCatalog(false).then((cat: HubCatalog) => {
      setCatalog(cat);
      setLastSynced(new Date());
    }).catch(() => {
      toast('Could not reach Forge Hub — showing built-in items', 'info');
    }).finally(() => setLoading(false));
  }, [api, toast]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      const cat = await api.hub.fetchCatalog(true);
      setCatalog(cat);
      setLastSynced(new Date());
      toast('Hub synced', 'success');
    } catch {
      toast('Sync failed — offline?', 'error');
    } finally {
      setSyncing(false);
    }
  }, [api, toast]);

  const handleSelectItem = useCallback((item: HubItem) => {
    setSelectedItem(item);
    setView('detail');
  }, []);

  const handleBack = useCallback(() => {
    setView('list');
    setSelectedItem(null);
  }, []);

  const handleInstall = useCallback(async (itemId: string, projectPath: string) => {
    await api.hub.installItem(itemId, projectPath);
    setInstalledIds((prev) => new Set([...prev, itemId]));
    toast(`Installed to project!`, 'success');
  }, [api, toast]);

  // Filtered + searched items
  const allItems = catalog?.items ?? [];
  const filtered = allItems.filter((item) => {
    if (activeFilter !== 'all' && item.type !== activeFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.tags.some((t) => t.includes(q)) ||
        item.category.includes(q)
      );
    }
    return true;
  });

  const counts: Record<FilterTab, number> = {
    all: allItems.length,
    skill: allItems.filter((i) => i.type === 'skill').length,
    template: allItems.filter((i) => i.type === 'template').length,
    constraint: allItems.filter((i) => i.type === 'constraint').length,
    playbook: allItems.filter((i) => i.type === 'playbook').length,
  };

  // Trending = sorted by downloads, not official
  const trending = [...allItems].sort((a, b) => b.downloads - a.downloads).slice(0, 6);
  // Newest = sorted by createdAt
  const newest = [...allItems].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

  return (
    <div className="h-full flex flex-col bg-bg overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-white/6 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-text-primary forge-logo-text">⚒ FORGE HUB</h1>
            {lastSynced && !loading && (
              <span className="text-[10px] font-mono text-text-muted">
                Last synced {formatRelativeDate(lastSynced.toISOString())}
              </span>
            )}
          </div>
          <p className="text-[11px] text-text-muted mt-0.5">Community-crafted skills, templates, and playbooks</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {view === 'list' && (
            <input
              type="text"
              placeholder="Search hub…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-44 bg-surface border border-white/8 rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-[var(--forge-accent-amber)]/60"
            />
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Sync catalog"
            className="p-1.5 text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
          >
            <span className={`text-base ${syncing ? 'animate-spin inline-block' : ''}`}>⟳</span>
          </button>
          <button
            onClick={() => setShowPublisher(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--forge-accent-amber)] text-black text-[11px] font-bold rounded-lg hover:brightness-110 transition-all"
          >
            📦 Publish
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {view === 'detail' && selectedItem ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <ItemDetailView
                item={selectedItem}
                projects={projects}
                installedIds={installedIds}
                onBack={handleBack}
                onInstall={handleInstall}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full overflow-y-auto"
            >
              {loading ? (
                <div className="flex items-center justify-center h-40 text-text-muted">
                  <span className="animate-spin text-2xl mr-3">⟳</span>
                  <span className="text-sm font-mono">Loading hub…</span>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
                  {/* Featured */}
                  {!searchQuery && activeFilter === 'all' && (
                    <FeaturedRow
                      items={allItems}
                      onSelect={handleSelectItem}
                      installedIds={installedIds}
                    />
                  )}

                  {/* Filter tabs */}
                  <div className="space-y-4">
                    <FilterTabs
                      active={activeFilter}
                      onChange={(t) => { setActiveFilter(t); setSearchQuery(''); }}
                      counts={counts}
                    />

                    {searchQuery ? (
                      <div>
                        <h2 className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
                          Results for "{searchQuery}" ({filtered.length})
                        </h2>
                        {filtered.length === 0 ? (
                          <div className="text-center py-12 text-text-muted">
                            <div className="text-3xl mb-3">🔍</div>
                            <p className="text-sm">No results found</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {filtered.map((item) => (
                              <HubItemCard
                                key={item.id}
                                item={item}
                                onSelect={handleSelectItem}
                                installed={installedIds.has(item.id)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : activeFilter !== 'all' ? (
                      <div>
                        <h2 className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
                          {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}s ({filtered.length})
                        </h2>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {filtered.map((item) => (
                            <HubItemCard
                              key={item.id}
                              item={item}
                              onSelect={handleSelectItem}
                              installed={installedIds.has(item.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Trending */}
                        <div>
                          <h2 className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
                            🔥 Trending
                          </h2>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {trending.map((item) => (
                              <HubItemCard
                                key={item.id}
                                item={item}
                                onSelect={handleSelectItem}
                                installed={installedIds.has(item.id)}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Newest */}
                        <div>
                          <h2 className="text-[10px] font-mono uppercase tracking-widest text-text-muted mb-3">
                            ✨ Newest
                          </h2>
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            {newest.map((item) => (
                              <HubItemCard
                                key={item.id}
                                item={item}
                                onSelect={handleSelectItem}
                                installed={installedIds.has(item.id)}
                              />
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Publish banner */}
                  <motion.div
                    whileHover={{ scale: 1.005 }}
                    onClick={() => setShowPublisher(true)}
                    className="cursor-pointer bg-gradient-to-r from-[var(--forge-accent-amber)]/10 to-transparent border border-[var(--forge-accent-amber)]/20 rounded-xl p-5 flex items-center gap-4"
                  >
                    <div className="text-3xl">📦</div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-[var(--forge-accent-amber)]">Publish Your Own →</div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        Share your skills, templates, and playbooks with the community
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Publisher wizard modal */}
      <AnimatePresence>
        {showPublisher && (
          <PublisherWizard onClose={() => setShowPublisher(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
