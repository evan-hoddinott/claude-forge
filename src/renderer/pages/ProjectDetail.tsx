import { useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery, useMutation } from '../hooks/useAPI';
import { useToast } from '../components/Toast';
import type { Project, ProjectInput, AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import StatusBadge from '../components/StatusBadge';

// Lazy-load FileExplorer (includes Monaco Editor) — only when Files tab is opened
const FileExplorer = lazy(() => import('../components/FileExplorer'));

type Tab = 'overview' | 'files' | 'github' | 'agents' | 'settings';

const tabs: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'files', label: 'Files' },
  { id: 'github', label: 'GitHub' },
  { id: 'agents', label: 'AI Agents' },
  { id: 'settings', label: 'Settings' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function buildContextPreview(project: Project): string {
  const sections: string[] = [];
  sections.push(`# ${project.name}`);
  if (project.description) {
    sections.push(`## What This Is\n${project.description}`);
  }
  for (const input of project.inputs) {
    if (input.value.trim()) {
      sections.push(`## ${input.label}\n${input.value}`);
    }
  }
  if (project.tags.length > 0) {
    sections.push(`## Tags\n${project.tags.join(', ')}`);
  }
  sections.push(
    [
      '## Coding Standards',
      '- Write clean, readable code with meaningful names',
      '- Add error handling for external operations',
      '- Keep functions small and focused',
      '- Use TypeScript strict mode where applicable',
      '- Commit after completing each major feature',
    ].join('\n'),
  );
  return sections.join('\n\n');
}

// --- Agent icon helper ---

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

// --- Main Component ---

export default function ProjectDetail({
  projectId,
  onBack,
}: {
  projectId: string;
  onBack: () => void;
}) {
  const api = useAPI();
  const {
    data: project,
    loading,
    refetch,
  } = useQuery(() => api.projects.get(projectId), [projectId]);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  if (loading) return <LoadingSkeleton />;

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-sm">
        Project not found.
        <button
          onClick={onBack}
          className="text-accent hover:text-accent-hover ml-1"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-6 pt-4 pb-0">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-xs text-text-muted mb-3">
          <button
            onClick={onBack}
            className="hover:text-text-primary transition-colors"
          >
            Dashboard
          </button>
          <ChevronRightIcon />
          <span className="text-text-secondary">{project.name}</span>
        </nav>

        {/* Title row */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-bold text-text-primary truncate">
              {project.name}
            </h1>
            <StatusBadge status={project.status} />
            {project.githubUrl && (
              <button
                onClick={() => window.open(project.githubUrl!, '_blank')}
                className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
              >
                <GitHubIcon />
                <span className="truncate max-w-[160px]">
                  {project.githubRepo}
                </span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <HeaderButton
              onClick={() => api.system.openInTerminal(project.path)}
            >
              <TerminalIcon /> Terminal
            </HeaderButton>
            <HeaderButton
              onClick={() => api.system.openInEditor(project.path)}
            >
              <CodeIcon /> Editor
            </HeaderButton>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'files' ? (
          <div className="h-full">
            <Suspense fallback={<FileExplorerSkeleton />}>
              <FileExplorer project={project} />
            </Suspense>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="p-6"
            >
              {activeTab === 'overview' && <OverviewTab project={project} />}
              {activeTab === 'github' && (
                <GitHubTab project={project} onUpdate={refetch} />
              )}
              {activeTab === 'agents' && <AgentsTab project={project} />}
              {activeTab === 'settings' && (
                <SettingsTab
                  project={project}
                  onUpdate={refetch}
                  onDelete={onBack}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// --- Tab: Overview ---

function OverviewTab({ project }: { project: Project }) {
  const preview = buildContextPreview(project);
  const contextFiles = (project.agents || ['claude']).map(a => AGENTS[a].contextFileName);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Info cards */}
      <div className="grid grid-cols-3 gap-3">
        <InfoCard label="Path" value={project.path} mono />
        <InfoCard label="Created" value={formatDate(project.createdAt)} />
        <InfoCard
          label="Last Updated"
          value={relativeTime(project.updatedAt)}
        />
      </div>

      {/* Description */}
      {project.description && (
        <SectionCard title="Description">
          <p className="text-sm text-text-secondary leading-relaxed">
            {project.description}
          </p>
        </SectionCard>
      )}

      {/* Inputs */}
      {project.inputs.length > 0 && (
        <SectionCard title="Project Inputs">
          <dl className="space-y-3">
            {project.inputs.map((input) => (
              <div key={input.id}>
                <dt className="text-xs font-medium text-text-muted mb-0.5">
                  {input.label}
                </dt>
                <dd className="text-sm text-text-secondary whitespace-pre-wrap">
                  {input.value || '\u2014'}
                </dd>
              </div>
            ))}
          </dl>
        </SectionCard>
      )}

      {/* Tags */}
      {project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {project.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 rounded-full bg-white/5 text-xs text-text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Context file preview */}
      <SectionCard title={`Context Files (${contextFiles.join(', ')})`}>
        <pre className="text-xs text-text-secondary leading-relaxed whitespace-pre-wrap font-mono overflow-x-auto">
          {preview}
        </pre>
      </SectionCard>
    </div>
  );
}

// --- Tab: GitHub ---

function GitHubTab({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: () => void;
}) {
  const api = useAPI();
  const { toast } = useToast();
  const [repoUrl, setRepoUrl] = useState('');
  const [repoName, setRepoName] = useState(project.name);
  const [isPrivate, setIsPrivate] = useState(true);
  const [mode, setMode] = useState<'create' | 'link'>('create');

  const createRepo = useMutation(async () => {
    const repo = await api.github.createRepo(
      repoName,
      isPrivate,
      project.description,
      project.path,
    );
    await api.projects.update(project.id, {
      githubRepo: repo.fullName,
      githubUrl: repo.url,
    });
    toast('GitHub repo created');
    onUpdate();
  });

  const linkRepo = useMutation(async () => {
    await api.github.linkRepo(project.path, repoUrl);
    const match = repoUrl.match(/github\.com[/:](.+?)(?:\.git)?$/);
    const cleanUrl = repoUrl
      .replace(/\.git$/, '')
      .replace('git@github.com:', 'https://github.com/');
    await api.projects.update(project.id, {
      githubRepo: match?.[1] ?? repoUrl,
      githubUrl: cleanUrl,
    });
    toast('Repository linked');
    onUpdate();
  });

  const unlinkRepo = useMutation(async () => {
    await api.projects.update(project.id, {
      githubRepo: null,
      githubUrl: null,
    });
    onUpdate();
  });

  if (project.githubRepo) {
    return (
      <div className="max-w-2xl">
        <SectionCard>
          <div className="flex items-center gap-2 mb-2">
            <GitHubIcon className="w-5 h-5 text-text-secondary" />
            <span className="text-sm font-semibold text-text-primary">
              {project.githubRepo}
            </span>
          </div>
          {project.githubUrl && (
            <p className="text-xs text-text-muted mb-4">{project.githubUrl}</p>
          )}
          <div className="flex items-center gap-2">
            {project.githubUrl && (
              <button
                onClick={() => window.open(project.githubUrl!, '_blank')}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary transition-colors"
              >
                Open on GitHub
              </button>
            )}
            <button
              onClick={() => unlinkRepo.mutate()}
              disabled={unlinkRepo.loading}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-status-error/70 hover:text-status-error hover:bg-status-error/10 transition-colors"
            >
              {unlinkRepo.loading ? 'Unlinking\u2026' : 'Unlink'}
            </button>
          </div>
          {unlinkRepo.error && (
            <p className="mt-3 text-xs text-status-error">
              {unlinkRepo.error}
            </p>
          )}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-sm text-text-muted">
        No repository linked to this project.
      </p>

      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] w-fit">
        {(['create', 'link'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              mode === m
                ? 'bg-white/8 text-text-primary'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            {m === 'create' ? 'Create New' : 'Link Existing'}
          </button>
        ))}
      </div>

      {mode === 'create' ? (
        <SectionCard>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Repository name
              </label>
              <input
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="rounded border-white/20 bg-white/5 text-accent focus:ring-accent/25"
              />
              <span className="text-sm text-text-secondary">
                Private repository
              </span>
            </label>
            {createRepo.error && (
              <p className="text-xs text-status-error">{createRepo.error}</p>
            )}
            <button
              onClick={() => createRepo.mutate()}
              disabled={createRepo.loading || !repoName.trim()}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg text-sm font-semibold transition-all"
            >
              {createRepo.loading ? 'Creating\u2026' : 'Create Repository'}
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Repository URL
              </label>
              <input
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo"
                className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            {linkRepo.error && (
              <p className="text-xs text-status-error">{linkRepo.error}</p>
            )}
            <button
              onClick={() => linkRepo.mutate()}
              disabled={linkRepo.loading || !repoUrl.trim()}
              className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg text-sm font-semibold transition-all"
            >
              {linkRepo.loading ? 'Linking\u2026' : 'Link Repository'}
            </button>
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// --- Tab: AI Agents ---

function AgentsTab({ project }: { project: Project }) {
  const api = useAPI();
  const { data: status, refetch: refetchStatus } = useQuery(
    () => api.agent.status(project.id),
    [project.id],
  );

  const projectAgents = project.agents || [project.preferredAgent || 'claude'];

  const quickActions = [
    { label: 'Continue working', desc: 'Pick up where you left off' },
    { label: 'Fix bugs', desc: 'Find and fix issues' },
    { label: 'Add tests', desc: 'Improve test coverage' },
    { label: 'Review code', desc: 'Get a code review' },
  ];

  return (
    <div className="max-w-2xl space-y-6">
      {projectAgents.map((agentType) => {
        return (
          <AgentLaunchCard
            key={agentType}
            agentType={agentType}
            project={project}
            status={status}
            quickActions={quickActions}
            onStatusRefresh={refetchStatus}
          />
        );
      })}

      {/* If no agents configured, show a message */}
      {projectAgents.length === 0 && (
        <div className="text-sm text-text-muted">
          No AI agents configured for this project. Edit project settings to add agents.
        </div>
      )}
    </div>
  );
}

function AgentLaunchCard({
  agentType,
  project,
  status,
  quickActions,
  onStatusRefresh,
}: {
  agentType: AgentType;
  project: Project;
  status: { running: boolean; hasHistory: boolean } | null;
  quickActions: { label: string; desc: string }[];
  onStatusRefresh: () => void;
}) {
  const api = useAPI();
  const { toast } = useToast();
  const config = AGENTS[agentType];

  const launch = useMutation(async () => {
    await api.agent.start(project.id, agentType);
    toast(`${config.displayName} launched`);
    setTimeout(onStatusRefresh, 1000);
  });

  return (
    <SectionCard>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span style={{ color: config.color }}>
            <AgentIcon agentType={agentType} className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {config.displayName}
            </h3>
            <div className="flex items-center gap-3 text-xs text-text-muted mt-0.5">
              <span className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status?.running
                      ? 'bg-status-ready animate-pulse'
                      : 'bg-text-muted'
                  }`}
                />
                {status?.running ? 'Running' : 'Not running'}
              </span>
              {project.lastClaudeSession && (
                <span>
                  Last session: {relativeTime(project.lastClaudeSession)}
                </span>
              )}
              {status?.hasHistory && !status.running && (
                <span style={{ color: config.color + '99' }}>Has session history</span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => launch.mutate()}
          disabled={launch.loading || status?.running}
          className="px-4 py-2 rounded-lg text-bg text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            backgroundColor: config.color,
          }}
        >
          {launch.loading
            ? 'Launching\u2026'
            : status?.running
              ? 'Running'
              : `Launch ${config.displayName}`}
        </button>
      </div>
      {launch.error && (
        <p className="mt-3 text-xs text-status-error">{launch.error}</p>
      )}

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {quickActions.map((action) => (
          <button
            key={action.label}
            onClick={() => launch.mutate()}
            disabled={launch.loading}
            className="flex flex-col items-start p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all text-left"
          >
            <span className="text-sm font-medium text-text-primary">
              {action.label}
            </span>
            <span className="text-xs text-text-muted mt-0.5">
              {action.desc}
            </span>
          </button>
        ))}
      </div>

      {/* Context file info */}
      <div className="mt-3 flex items-center gap-2 text-[10px] text-text-muted">
        <span>Context file:</span>
        <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">{config.contextFileName}</span>
      </div>
    </SectionCard>
  );
}

// --- Tab: Settings ---

function SettingsTab({
  project,
  onUpdate,
  onDelete,
}: {
  project: Project;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const api = useAPI();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [inputs, setInputs] = useState<ProjectInput[]>(project.inputs);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [agents, setAgents] = useState<AgentType[]>(project.agents || ['claude']);
  const [preferredAgent, setPreferredAgent] = useState<AgentType>(project.preferredAgent || 'claude');

  const hasChanges =
    name !== project.name ||
    description !== project.description ||
    JSON.stringify(inputs) !== JSON.stringify(project.inputs) ||
    JSON.stringify(agents) !== JSON.stringify(project.agents || ['claude']) ||
    preferredAgent !== (project.preferredAgent || 'claude');

  const { toast } = useToast();

  const save = useMutation(async () => {
    await api.projects.update(project.id, { name, description, inputs, agents, preferredAgent });
    toast('Changes saved');
    onUpdate();
  });

  const remove = useMutation(async (fromDisk: boolean) => {
    await api.projects.delete(project.id, fromDisk);
    toast('Project deleted');
    onDelete();
  });

  function updateInput(index: number, field: 'label' | 'value', val: string) {
    setInputs((prev) =>
      prev.map((inp, i) => (i === index ? { ...inp, [field]: val } : inp)),
    );
  }

  function toggleAgent(agentType: AgentType) {
    setAgents((prev) => {
      if (prev.includes(agentType)) {
        const next = prev.filter((a) => a !== agentType);
        if (next.length === 0) return prev; // must have at least one
        if (preferredAgent === agentType) setPreferredAgent(next[0]);
        return next;
      }
      return [...prev, agentType];
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* General */}
      <SectionCard title="General">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Project name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors resize-none"
            />
          </div>
        </div>
      </SectionCard>

      {/* AI Agents */}
      <SectionCard title="AI Agents">
        <div className="space-y-3">
          <p className="text-xs text-text-muted">
            Select which agents to use with this project. Context files will be generated for each.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['claude', 'gemini', 'codex'] as AgentType[]).map((agentType) => {
              const config = AGENTS[agentType];
              const selected = agents.includes(agentType);
              return (
                <button
                  key={agentType}
                  onClick={() => toggleAgent(agentType)}
                  className={`p-3 rounded-xl border transition-all text-left ${
                    selected
                      ? 'border-white/20 bg-white/[0.06]'
                      : 'border-white/[0.06] bg-white/[0.02] opacity-50'
                  }`}
                  style={selected ? { borderColor: config.color + '40' } : undefined}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ color: config.color }}>
                      <AgentIcon agentType={agentType} className="w-4 h-4" />
                    </span>
                    <span className="text-xs font-medium text-text-primary">{config.displayName}</span>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono">{config.contextFileName}</span>
                </button>
              );
            })}
          </div>
          {agents.length > 1 && (
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Preferred agent
              </label>
              <select
                value={preferredAgent}
                onChange={(e) => setPreferredAgent(e.target.value as AgentType)}
                className="bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
              >
                {agents.map((a) => (
                  <option key={a} value={a}>{AGENTS[a].displayName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Inputs */}
      {inputs.length > 0 && (
        <SectionCard title="Project Inputs">
          <div className="space-y-3">
            {inputs.map((input, i) => (
              <div key={input.id} className="grid grid-cols-[140px_1fr] gap-3">
                <input
                  value={input.label}
                  onChange={(e) => updateInput(i, 'label', e.target.value)}
                  className="bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                  placeholder="Label"
                />
                {input.type === 'textarea' ? (
                  <textarea
                    value={input.value}
                    onChange={(e) => updateInput(i, 'value', e.target.value)}
                    rows={2}
                    className="bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors resize-none"
                    placeholder="Value"
                  />
                ) : (
                  <input
                    value={input.value}
                    onChange={(e) => updateInput(i, 'value', e.target.value)}
                    className="bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent/50 transition-colors"
                    placeholder="Value"
                  />
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Save */}
      {hasChanges && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => save.mutate()}
            disabled={save.loading || !name.trim()}
            className="px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover disabled:opacity-50 text-bg text-sm font-semibold transition-all"
          >
            {save.loading ? 'Saving\u2026' : 'Save Changes'}
          </button>
          {save.error && (
            <p className="text-xs text-status-error">{save.error}</p>
          )}
        </div>
      )}

      {/* Danger zone */}
      <div className="rounded-xl border border-status-error/20 p-5">
        <h3 className="text-sm font-semibold text-status-error mb-1">
          Danger Zone
        </h3>
        <p className="text-xs text-text-muted mb-4">
          Permanently delete this project.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 rounded-lg border border-status-error/30 text-status-error text-sm font-medium hover:bg-status-error/10 transition-colors"
          >
            Delete Project
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => remove.mutate(false)}
              disabled={remove.loading}
              className="px-3 py-2 rounded-lg border border-status-error/30 text-status-error text-xs font-medium hover:bg-status-error/10 transition-colors"
            >
              Remove from app
            </button>
            <button
              onClick={() => remove.mutate(true)}
              disabled={remove.loading}
              className="px-3 py-2 rounded-lg bg-status-error text-white text-xs font-medium hover:bg-status-error/90 transition-colors"
            >
              Delete from disk too
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-2 rounded-lg text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Shared UI ---

function SectionCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5">
      {title && (
        <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

function InfoCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
      <dt className="text-xs text-text-muted mb-1">{label}</dt>
      <dd
        className={`text-sm text-text-primary truncate ${mono ? 'font-mono text-xs' : ''}`}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function HeaderButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
    >
      {children}
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <div className="h-4 w-32 rounded bg-white/[0.04] animate-pulse" />
      <div className="h-8 w-64 rounded bg-white/[0.04] animate-pulse" />
      <div className="h-10 w-full rounded bg-white/[0.04] animate-pulse" />
      <div className="h-48 w-full rounded-xl bg-white/[0.02] animate-pulse mt-6" />
    </div>
  );
}

function FileExplorerSkeleton() {
  return (
    <div className="h-full flex">
      <div className="w-80 border-r border-white/[0.06] p-4 space-y-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="h-5 rounded bg-white/[0.03] animate-pulse"
            style={{ width: `${50 + Math.random() * 40}%`, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Loading file explorer...
      </div>
    </div>
  );
}

// --- Icons ---

function ChevronRightIcon() {
  return (
    <svg
      className="w-3 h-3"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className ?? 'w-3.5 h-3.5'}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function TerminalIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 5 7 8 4 11" />
      <line x1="9" y1="11" x2="12" y2="11" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 3 1.5 8 5 13" />
      <polyline points="11 3 14.5 8 11 13" />
    </svg>
  );
}
