import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import type { Project, SkillEntry, InstalledSkillRecord, SkillCategory } from '../../shared/types';

interface StoreProps {
  projects: Project[];
}

const CATEGORY_LABELS: Record<SkillCategory | 'all', string> = {
  all: 'All',
  personality: 'Personalities',
  starter: 'Starters',
  constraint: 'Constraints',
};

// ---------------------------------------------------------------------------
// Star rating display
// ---------------------------------------------------------------------------

function StarRating({ rating, count }: { rating: number; count: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <svg key={i} className={`w-3 h-3 ${i <= full ? 'text-amber-400' : half && i === full + 1 ? 'text-amber-400' : 'text-white/20'}`} viewBox="0 0 16 16" fill="currentColor">
            {i <= full ? (
              <path d="M8 1l1.76 4.54L14.5 6.12l-3.62 3.53.85 4.97L8 12.27 4.27 14.62l.85-4.97L1.5 6.12l4.74-.58L8 1z" />
            ) : half && i === full + 1 ? (
              <>
                <clipPath id={`half-${i}`}><rect x="0" y="0" width="8" height="16" /></clipPath>
                <path d="M8 1l1.76 4.54L14.5 6.12l-3.62 3.53.85 4.97L8 12.27 4.27 14.62l.85-4.97L1.5 6.12l4.74-.58L8 1z" className="text-white/20" />
                <path clipPath={`url(#half-${i})`} d="M8 1l1.76 4.54L14.5 6.12l-3.62 3.53.85 4.97L8 12.27 4.27 14.62l.85-4.97L1.5 6.12l4.74-.58L8 1z" className="text-amber-400" />
              </>
            ) : (
              <path d="M8 1l1.76 4.54L14.5 6.12l-3.62 3.53.85 4.97L8 12.27 4.27 14.62l.85-4.97L1.5 6.12l4.74-.58L8 1z" />
            )}
          </svg>
        ))}
      </div>
      <span className="text-text-muted text-xs">({count})</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent chip
// ---------------------------------------------------------------------------

const AGENT_COLORS: Record<string, string> = {
  claude: '#D97706',
  gemini: '#4285F4',
  codex: '#10A37F',
  copilot: '#6e40c9',
};

const AGENT_LABELS: Record<string, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  codex: 'Codex',
  copilot: 'Copilot',
};

function AgentChip({ agent }: { agent: string }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: `${AGENT_COLORS[agent] ?? '#888'}22`, color: AGENT_COLORS[agent] ?? '#888' }}
    >
      {AGENT_LABELS[agent] ?? agent}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Skill card (list view)
// ---------------------------------------------------------------------------

function SkillCard({
  skill,
  installed,
  installing,
  onInstall,
  onUninstall,
  onClick,
}: {
  skill: SkillEntry;
  installed: boolean;
  installing: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onClick: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 flex flex-col gap-3 cursor-pointer hover:bg-white/[0.07] transition-colors group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl leading-none">{skill.icon}</span>
          <div>
            <div className="text-sm font-semibold text-text-primary">{skill.name}</div>
            <div className="text-xs text-text-muted capitalize">{skill.category}</div>
          </div>
        </div>
        {skill.builtIn && (
          <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-white/[0.06] text-text-muted">
            built-in
          </span>
        )}
      </div>

      <p className="text-xs text-text-secondary line-clamp-2 leading-relaxed">
        {skill.description}
      </p>

      <div className="flex items-center justify-between mt-auto">
        <StarRating rating={skill.rating} count={skill.ratingCount} />
        <button
          onClick={(e) => {
            e.stopPropagation();
            installed ? onUninstall() : onInstall();
          }}
          disabled={installing}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-all ${
            installed
              ? 'bg-green-500/15 text-green-400 hover:bg-red-500/15 hover:text-red-400'
              : installing
                ? 'bg-white/[0.06] text-text-muted cursor-not-allowed'
                : 'bg-accent/20 text-accent hover:bg-accent/30'
          }`}
        >
          {installing ? (
            <span className="flex items-center gap-1.5">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                <path d="M8 2a6 6 0 016 6" />
              </svg>
              Installing…
            </span>
          ) : installed ? (
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 8l4 4 8-8" />
              </svg>
              Installed
            </span>
          ) : (
            'Install'
          )}
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Skill detail view
// ---------------------------------------------------------------------------

function SkillDetail({
  skill,
  projects,
  installedMap,
  installing,
  onBack,
  onInstall,
  onUninstallFrom,
  onSaveAs,
}: {
  skill: SkillEntry;
  projects: Project[];
  installedMap: Record<string, InstalledSkillRecord[]>;
  installing: boolean;
  onBack: () => void;
  onInstall: (projectId: string) => void;
  onUninstallFrom: (projectId: string) => void;
  onSaveAs: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id ?? '');
  const api = useAPI();

  const isInstalledIn = (pid: string) =>
    (installedMap[pid] ?? []).some((r) => r.skillId === skill.id);

  const installedInSelected = isInstalledIn(selectedProjectId);

  async function handleInstallAll() {
    for (const p of projects) {
      if (!isInstalledIn(p.id)) {
        await onInstall(p.id);
      }
    }
  }

  function handleSubmitSkill() {
    api.system.openExternal(
      'https://github.com/evan-hoddinott/caboo-hub/issues/new?template=submit-skill.md',
    );
  }

  const modifiedFiles = (() => {
    const files: string[] = [];
    const agents = skill.agents ?? ['claude', 'gemini', 'codex', 'copilot'];
    const agentMap: Record<string, string> = {
      claude: 'CLAUDE.md',
      gemini: 'GEMINI.md',
      codex: 'codex.md',
      copilot: '.github/copilot-instructions.md',
    };
    for (const a of agents) {
      if (agentMap[a]) files.push(`${agentMap[a]} — adds ${skill.name} instructions`);
    }
    return files;
  })();

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      className="h-full overflow-y-auto px-6 py-6 max-w-2xl"
    >
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors mb-6"
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M10 3L5 8l5 5" />
        </svg>
        Back to Store
      </button>

      <div className="flex items-start gap-4 mb-6">
        <span className="text-4xl leading-none">{skill.icon}</span>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary mb-1">{skill.name}</h1>
          <div className="text-sm text-text-muted mb-2">
            By {skill.author} · v{skill.version}
          </div>
          <StarRating rating={skill.rating} count={skill.ratingCount} />
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-4 mb-6">
        <p className="text-sm text-text-secondary leading-relaxed">
          {skill.longDescription ?? skill.description}
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <div className="flex items-start gap-3">
          <span className="text-xs text-text-muted w-28 shrink-0 pt-0.5">Works with</span>
          <div className="flex flex-wrap gap-1.5">
            {skill.agents.map((a) => <AgentChip key={a} agent={a} />)}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span className="text-xs text-text-muted w-28 shrink-0 pt-0.5">Category</span>
          <span className="text-xs text-text-secondary capitalize">{skill.category}</span>
        </div>
        {skill.size > 0 && (
          <div className="flex items-start gap-3">
            <span className="text-xs text-text-muted w-28 shrink-0 pt-0.5">Size</span>
            <span className="text-xs text-text-secondary">{Math.round(skill.size / 1024)} KB</span>
          </div>
        )}
        <div className="flex items-start gap-3">
          <span className="text-xs text-text-muted w-28 shrink-0 pt-0.5">What it modifies</span>
          <ul className="space-y-1">
            {modifiedFiles.map((f) => (
              <li key={f} className="text-xs text-text-secondary flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-text-muted shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {projects.length > 0 ? (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-secondary shrink-0">Install to:</label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent/50"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {isInstalledIn(p.id) ? ' ✓' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            {installedInSelected ? (
              <button
                onClick={() => onUninstallFrom(selectedProjectId)}
                disabled={installing}
                className="w-full py-2 rounded-lg text-sm font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors disabled:opacity-50"
              >
                Uninstall from Selected Project
              </button>
            ) : (
              <button
                onClick={() => onInstall(selectedProjectId)}
                disabled={installing || !selectedProjectId}
                className="w-full py-2 rounded-lg text-sm font-medium bg-accent/20 text-accent hover:bg-accent/30 transition-colors disabled:opacity-50"
              >
                {installing ? 'Installing…' : 'Install to Selected Project'}
              </button>
            )}
            <button
              onClick={handleInstallAll}
              disabled={installing || projects.every((p) => isInstalledIn(p.id))}
              className="w-full py-2 rounded-lg text-sm font-medium bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] transition-colors disabled:opacity-50"
            >
              Install to All Projects
            </button>
            <button
              onClick={onSaveAs}
              className="w-full py-2 rounded-lg text-sm font-medium bg-white/[0.05] text-text-secondary hover:bg-white/[0.08] transition-colors"
            >
              Download .vibe file
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 text-sm text-text-muted text-center">
          Create a project first to install skills.
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-white/[0.06] text-center">
        <button
          onClick={handleSubmitSkill}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors underline underline-offset-2"
        >
          Submit your own skill to the community
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function SkillCardSkeleton() {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex flex-col gap-3 animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
        <div className="space-y-1.5">
          <div className="w-28 h-3 rounded bg-white/[0.06]" />
          <div className="w-16 h-2.5 rounded bg-white/[0.05]" />
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="w-full h-2.5 rounded bg-white/[0.05]" />
        <div className="w-4/5 h-2.5 rounded bg-white/[0.05]" />
      </div>
      <div className="flex justify-between items-center mt-1">
        <div className="w-20 h-3 rounded bg-white/[0.05]" />
        <div className="w-16 h-7 rounded-lg bg-white/[0.05]" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Store page
// ---------------------------------------------------------------------------

export default function Store({ projects }: StoreProps) {
  const api = useAPI();
  const [catalog, setCatalog] = useState<SkillEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [remoteError, setRemoteError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<SkillCategory | 'all'>('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillEntry | null>(null);

  // installedMap: projectId → InstalledSkillRecord[]
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledSkillRecord[]>>({});
  const [installing, setInstalling] = useState<string | null>(null); // skillId being installed

  // Load catalog on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    api.skills.fetchCatalog().then((skills) => {
      if (cancelled) return;
      setCatalog(skills);
      // If all are built-in, remote might have failed (but we still have built-ins)
      const hasRemote = skills.some((s) => !s.builtIn);
      if (!hasRemote) setRemoteError(true);
    }).catch(() => {
      if (!cancelled) setRemoteError(true);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [api]);

  // Load installed skills for all projects
  const refreshInstalled = useCallback(async () => {
    if (projects.length === 0) return;
    const entries = await Promise.all(
      projects.map(async (p) => {
        const records = await api.skills.getInstalled(p.id);
        return [p.id, records] as const;
      }),
    );
    setInstalledMap(Object.fromEntries(entries));
  }, [api, projects]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  // Filtering
  const filtered = catalog.filter((s) => {
    if (activeCategory !== 'all' && s.category !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  async function handleInstall(skillId: string, projectId: string) {
    setInstalling(skillId);
    try {
      await api.skills.install(skillId, projectId);
      await refreshInstalled();
    } catch (err) {
      console.error('Install failed:', err);
    } finally {
      setInstalling(null);
    }
  }

  async function handleUninstall(skillId: string, projectId: string) {
    setInstalling(skillId);
    try {
      await api.skills.uninstall(skillId, projectId);
      await refreshInstalled();
    } catch (err) {
      console.error('Uninstall failed:', err);
    } finally {
      setInstalling(null);
    }
  }

  async function handleSaveAs(skillId: string) {
    try {
      await api.skills.saveAs(skillId);
    } catch (err) {
      console.error('Save as failed:', err);
    }
  }

  // For the list view: consider a skill "installed" if it's installed in at least one project
  function isInstalledAnywhere(skillId: string): boolean {
    return Object.values(installedMap).some((records) =>
      records.some((r) => r.skillId === skillId),
    );
  }

  // Default project for quick install in list view: first project
  const defaultProjectId = projects[0]?.id ?? '';

  const categories: (SkillCategory | 'all')[] = ['all', 'personality', 'starter', 'constraint'];

  if (selectedSkill) {
    return (
      <div className="h-full overflow-hidden">
        <AnimatePresence mode="wait">
          <SkillDetail
            key={selectedSkill.id}
            skill={selectedSkill}
            projects={projects}
            installedMap={installedMap}
            installing={installing === selectedSkill.id}
            onBack={() => setSelectedSkill(null)}
            onInstall={(projectId) => handleInstall(selectedSkill.id, projectId)}
            onUninstallFrom={(projectId) => handleUninstall(selectedSkill.id, projectId)}
            onSaveAs={() => handleSaveAs(selectedSkill.id)}
          />
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Caboo Skills</h1>
          <p className="text-xs text-text-muted mt-0.5">Agent personalities and project bundles</p>
        </div>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path d="M10 10l3.5 3.5" />
          </svg>
          <input
            type="text"
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-white/[0.05] border border-white/[0.08] rounded-lg pl-9 pr-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 w-48"
          />
        </div>
      </div>

      {/* Remote error banner */}
      {remoteError && (
        <div className="mx-6 mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300 flex items-center gap-2 shrink-0">
          <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 3.5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4.5zm0 7.25a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
          Couldn't reach the community store — showing built-in skills only.
        </div>
      )}

      {/* Category tabs */}
      <div className="flex gap-1.5 px-6 pb-4 shrink-0">
        {categories.map((cat) => {
          const count = cat === 'all' ? catalog.length : catalog.filter((s) => s.category === cat).length;
          if (count === 0 && cat !== 'all') return null;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-white/[0.05]'
              }`}
            >
              {CATEGORY_LABELS[cat]}
              <span className="ml-1.5 text-text-muted">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Skill grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <SkillCardSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-text-muted text-sm">
            <svg className="w-8 h-8 mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            No skills match your search.
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {filtered.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                installed={isInstalledAnywhere(skill.id)}
                installing={installing === skill.id}
                onInstall={() => {
                  if (defaultProjectId) {
                    handleInstall(skill.id, defaultProjectId);
                  } else {
                    setSelectedSkill(skill);
                  }
                }}
                onUninstall={() => {
                  const pid = Object.entries(installedMap).find(([, records]) =>
                    records.some((r) => r.skillId === skill.id),
                  )?.[0];
                  if (pid) handleUninstall(skill.id, pid);
                }}
                onClick={() => setSelectedSkill(skill)}
              />
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
