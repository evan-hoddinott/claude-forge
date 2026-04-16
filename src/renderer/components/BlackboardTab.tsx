/**
 * BlackboardTab.tsx
 * Visualises the .forge/blackboard/ state for a project.
 *
 * Three panels:
 *   1. Kanban board — tasks grouped by status
 *   2. Artifact shelf — structured outputs posted by agents
 *   3. Agent mailboxes — lateral messages between agents
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import { useToast } from './Toast';
import type {
  Project,
  BlackboardTask,
  BlackboardTaskStatus,
  BlackboardArtifact,
  AgentMessage,
  AgentType,
} from '../../shared/types';
import { AGENTS } from '../../shared/types';

// ---------- Helpers ----------

const STATUS_META: Record<
  BlackboardTaskStatus,
  { label: string; bg: string; dot: string; colLabel: string }
> = {
  pending:     { label: 'Pending',     bg: 'bg-white/[0.04]',    dot: 'bg-white/30',    colLabel: 'QUEUED'   },
  claimed:     { label: 'Claimed',     bg: 'bg-blue-900/20',     dot: 'bg-blue-400',    colLabel: 'CLAIMED'  },
  'in-progress': { label: 'In Progress', bg: 'bg-amber-900/20', dot: 'bg-amber-400',   colLabel: 'FORGING'  },
  blocked:     { label: 'Blocked',     bg: 'bg-red-900/20',      dot: 'bg-red-400',     colLabel: 'BLOCKED'  },
  completed:   { label: 'Completed',   bg: 'bg-green-900/20',    dot: 'bg-green-400',   colLabel: 'DONE'     },
  failed:      { label: 'Failed',      bg: 'bg-red-900/30',      dot: 'bg-red-500',     colLabel: 'FAILED'   },
};

const PRIORITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high:     'bg-amber-500/20 text-amber-300 border-amber-500/30',
  medium:   'bg-blue-500/20 text-blue-300 border-blue-500/30',
  low:      'bg-white/5 text-text-muted border-white/10',
};

const COLUMN_ORDER: BlackboardTaskStatus[] = [
  'pending', 'claimed', 'in-progress', 'blocked', 'completed', 'failed',
];

function agentColor(agent?: AgentType): string {
  if (!agent) return '#ffffff40';
  return AGENTS[agent]?.color ?? '#ffffff40';
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'Just now';
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}

// ---------- Task Card ----------

function TaskCard({
  task,
  allTasks,
  onDelete,
}: {
  task: BlackboardTask;
  allTasks: BlackboardTask[];
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[task.status];

  const depTasks = task.dependencies
    .map((id) => allTasks.find((t) => t.id === id))
    .filter(Boolean) as BlackboardTask[];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl border border-white/[0.06] p-3 cursor-pointer select-none ${meta.bg}`}
      onClick={() => setExpanded((v) => !v)}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-text-primary leading-snug truncate">
            {task.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] font-mono text-text-muted">{task.id}</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${PRIORITY_BADGE[task.priority] ?? PRIORITY_BADGE.low}`}
            >
              {task.priority}
            </span>
            {task.claimedBy && (
              <span
                className="text-[10px] font-medium"
                style={{ color: agentColor(task.claimedBy) }}
              >
                {task.claimedBy}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
          className="shrink-0 p-0.5 rounded text-text-muted hover:text-red-400 transition-colors"
          title="Delete task"
        >
          <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
              {task.description && (
                <p className="text-[11px] text-text-secondary leading-relaxed line-clamp-4">
                  {task.description}
                </p>
              )}

              {/* Dependencies */}
              {depTasks.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Dependencies</p>
                  <div className="flex flex-wrap gap-1">
                    {depTasks.map((dep) => (
                      <span
                        key={dep.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          dep.status === 'completed'
                            ? 'bg-green-900/30 text-green-400'
                            : 'bg-white/[0.04] text-text-muted'
                        }`}
                      >
                        {dep.id}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Artifacts */}
              {task.artifacts.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Artifacts</p>
                  <div className="flex flex-wrap gap-1">
                    {task.artifacts.map((a) => (
                      <span key={a} className="text-[10px] font-mono bg-amber-900/20 text-amber-300 px-1.5 py-0.5 rounded">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Files modified */}
              {task.filesModified.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wide mb-1">Files Modified</p>
                  <div className="space-y-0.5">
                    {task.filesModified.slice(0, 5).map((f) => (
                      <p key={f} className="text-[10px] font-mono text-text-secondary truncate">{f}</p>
                    ))}
                    {task.filesModified.length > 5 && (
                      <p className="text-[10px] text-text-muted">+{task.filesModified.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {/* Error */}
              {task.error && (
                <p className="text-[11px] text-red-400 bg-red-900/20 rounded p-2 font-mono">
                  {task.error}
                </p>
              )}

              {/* Timing */}
              <div className="flex items-center gap-3 text-[10px] text-text-muted">
                <span>Created {relativeTime(task.createdAt)}</span>
                {task.completedAt && <span>· Completed {relativeTime(task.completedAt)}</span>}
                {task.actualMinutes != null && <span>· Took {task.actualMinutes}m</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------- Kanban Column ----------

function KanbanColumn({
  status,
  tasks,
  allTasks,
  onDelete,
}: {
  status: BlackboardTaskStatus;
  tasks: BlackboardTask[];
  allTasks: BlackboardTask[];
  onDelete: (id: string) => void;
}) {
  const meta = STATUS_META[status];

  return (
    <div className="flex flex-col min-w-[220px] max-w-[260px] shrink-0">
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">
          {meta.colLabel}
        </span>
        <span className="ml-auto text-[10px] text-text-muted bg-white/[0.04] rounded px-1.5 py-0.5">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2 flex-1">
        <AnimatePresence>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              onDelete={onDelete}
            />
          ))}
        </AnimatePresence>
        {tasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] p-4 text-center">
            <p className="text-[10px] text-text-muted">Empty</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Artifact Shelf ----------

function ArtifactShelf({
  projectPath,
  artifacts,
}: {
  projectPath: string;
  artifacts: BlackboardArtifact[];
}) {
  const api = useAPI();
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null);
  const { toast } = useToast();

  async function openArtifact(name: string) {
    try {
      const content = await api.blackboard.getArtifact(projectPath, name);
      setPreview({ name, content });
    } catch {
      toast('Could not read artifact');
    }
  }

  if (artifacts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.06] p-6 text-center">
        <p className="text-xs text-text-muted">No artifacts yet</p>
        <p className="text-[10px] text-text-muted mt-1">Agents post structured outputs here during execution</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {artifacts.map((a) => (
          <button
            key={a.name}
            onClick={() => openArtifact(a.name)}
            className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] text-left transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-3.5 h-3.5 text-amber-400 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="1" width="10" height="13" rx="1.5" />
                <path d="M5 5h5M5 7.5h5M5 10h3" />
                <path d="M12 1l2 2-2 2" />
              </svg>
              <span className="text-[11px] font-mono text-text-primary truncate group-hover:text-accent transition-colors">
                {a.name}
              </span>
            </div>
            <p className="text-[10px] text-text-muted">{formatBytes(a.size)} · {relativeTime(a.createdAt)}</p>
          </button>
        ))}
      </div>

      {/* Artifact preview modal */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
            onClick={() => setPreview(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-bg-secondary border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[70vh] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <span className="text-xs font-mono text-text-primary">{preview.name}</span>
                <button
                  onClick={() => setPreview(null)}
                  className="text-text-muted hover:text-text-primary text-lg leading-none"
                >
                  ×
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-5 text-[11px] font-mono text-text-secondary whitespace-pre-wrap leading-relaxed">
                {preview.content}
              </pre>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Mailbox Panel ----------

function MailboxPanel({
  projectPath,
  agents,
}: {
  projectPath: string;
  agents: AgentType[];
}) {
  const api = useAPI();
  const [selectedAgent, setSelectedAgent] = useState<AgentType>(agents[0]);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const { toast } = useToast();

  const loadMessages = useCallback(async () => {
    if (!selectedAgent) return;
    try {
      const msgs = await api.blackboard.readMessages(projectPath, selectedAgent);
      setMessages(msgs.slice().reverse()); // newest first
    } catch {
      setMessages([]);
    }
  }, [api, projectPath, selectedAgent]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Live updates via IPC event
  useEffect(() => {
    api.blackboard.onMessageReceived((data: unknown) => {
      const d = data as { projectPath: string; message: AgentMessage };
      if (d.projectPath === projectPath && d.message.to === selectedAgent) {
        setMessages((prev) => [d.message, ...prev]);
      }
    });
    return () => api.blackboard.offMessageReceived();
  }, [api, projectPath, selectedAgent]);

  async function handleMarkRead(messageId: string) {
    try {
      await api.blackboard.markRead(projectPath, selectedAgent, messageId);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, read: true } : m));
    } catch {
      toast('Could not mark as read');
    }
  }

  async function handleClearMailbox() {
    try {
      await api.blackboard.clearMailbox(projectPath, selectedAgent);
      setMessages([]);
      toast('Mailbox cleared');
    } catch {
      toast('Could not clear mailbox');
    }
  }

  const unreadCount = messages.filter((m) => !m.read).length;

  const TYPE_ICON: Record<string, string> = {
    request: '❓',
    response: '✅',
    info: 'ℹ',
    system: '⚙',
  };

  const TYPE_COLOR: Record<string, string> = {
    request: 'text-blue-400',
    response: 'text-green-400',
    info: 'text-text-muted',
    system: 'text-amber-400',
  };

  return (
    <div className="space-y-4">
      {/* Agent tabs */}
      <div className="flex items-center gap-1">
        {agents.map((a) => (
          <button
            key={a}
            onClick={() => setSelectedAgent(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedAgent === a
                ? 'bg-white/10 text-text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
            }`}
            style={selectedAgent === a ? { borderBottom: `2px solid ${agentColor(a)}` } : undefined}
          >
            {a}
            {selectedAgent === a && unreadCount > 0 && (
              <span className="ml-1.5 text-[9px] bg-accent/80 text-white rounded-full px-1.5 py-0.5">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={handleClearMailbox}
          className="ml-auto text-[11px] text-text-muted hover:text-red-400 transition-colors"
        >
          Clear
        </button>
      </div>

      {/* Message list */}
      <div className="space-y-2">
        {messages.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/[0.06] p-6 text-center">
            <p className="text-xs text-text-muted">No messages</p>
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className={`p-3 rounded-xl border transition-colors ${
                msg.read
                  ? 'border-white/[0.05] bg-white/[0.02]'
                  : 'border-white/[0.10] bg-white/[0.04]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm">{TYPE_ICON[msg.type] ?? '·'}</span>
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLOR[msg.type] ?? 'text-text-muted'}`}
                  >
                    {msg.type}
                  </span>
                  <span className="text-[10px] font-medium text-text-secondary">
                    from <span style={{ color: agentColor(msg.from as AgentType) }}>{msg.from}</span>
                  </span>
                  <span className="text-[10px] text-text-muted">· {relativeTime(msg.timestamp)}</span>
                </div>
                {!msg.read && (
                  <button
                    onClick={() => handleMarkRead(msg.id)}
                    className="text-[10px] text-accent hover:text-accent-hover shrink-0"
                  >
                    Mark read
                  </button>
                )}
              </div>
              <p className="text-xs font-medium text-text-primary mt-1">{msg.subject}</p>
              <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">{msg.body}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------- New Task Form ----------

function NewTaskForm({
  projectPath,
  onCreated,
}: {
  projectPath: string;
  onCreated: () => void;
}) {
  const api = useAPI();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api.blackboard.createTask(projectPath, {
        title: title.trim(),
        description: description.trim(),
        priority,
        status: 'pending',
        dependencies: [],
      });
      toast('Task created');
      setTitle('');
      setDescription('');
      setOpen(false);
      onCreated();
    } catch {
      toast('Could not create task');
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.06] text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v10M3 8h10" />
        </svg>
        New Task
      </button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-white/[0.10] bg-white/[0.03] p-4 space-y-3"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 resize-none"
      />
      <div className="flex items-center gap-3">
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-accent/50"
        >
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setOpen(false)}
            className="px-3 py-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || saving}
            className="px-3 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent text-xs font-medium disabled:opacity-40 transition-all"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------- Main Component ----------

type Panel = 'board' | 'artifacts' | 'mailboxes';

export default function BlackboardTab({ project }: { project: Project }) {
  const api = useAPI();
  const { toast } = useToast();
  const [panel, setPanel] = useState<Panel>('board');

  const {
    data: tasks,
    loading: tasksLoading,
    refetch: refetchTasks,
  } = useQuery<BlackboardTask[]>(
    () => api.blackboard.getTasks(project.path),
    [project.path],
  );

  const {
    data: artifacts,
    refetch: refetchArtifacts,
  } = useQuery<BlackboardArtifact[]>(
    () => api.blackboard.listArtifacts(project.path),
    [project.path],
  );

  // Live updates
  useEffect(() => {
    api.blackboard.onTaskUpdate((data: unknown) => {
      const d = data as { projectPath: string; task: BlackboardTask };
      if (d.projectPath === project.path) refetchTasks();
    });
    return () => api.blackboard.offTaskUpdate();
  }, [api, project.path, refetchTasks]);

  const agents = (project.agents ?? ['claude']) as AgentType[];

  const taskList = tasks ?? [];

  const tasksByStatus = COLUMN_ORDER.reduce<Record<BlackboardTaskStatus, BlackboardTask[]>>(
    (acc, s) => {
      acc[s] = taskList.filter((t) => t.status === s);
      return acc;
    },
    {} as Record<BlackboardTaskStatus, BlackboardTask[]>,
  );

  async function handleDelete(taskId: string) {
    try {
      await api.blackboard.deleteTask(project.path, taskId);
      refetchTasks();
      toast('Task removed');
    } catch {
      toast('Could not delete task');
    }
  }

  async function handleClearCompleted() {
    try {
      await api.blackboard.clearCompleted(project.path);
      refetchTasks();
      toast('Completed tasks cleared');
    } catch {
      toast('Could not clear tasks');
    }
  }

  const totalTasks = taskList.length;
  const doneTasks = taskList.filter((t) => t.status === 'completed').length;
  const activeTasks = taskList.filter((t) => t.status === 'in-progress' || t.status === 'claimed').length;

  const PANELS: { id: Panel; label: string }[] = [
    { id: 'board', label: 'Task Board' },
    { id: 'artifacts', label: `Artifacts (${(artifacts ?? []).length})` },
    { id: 'mailboxes', label: 'Mailboxes' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-white/[0.06] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Blackboard</h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              {totalTasks === 0
                ? 'No tasks posted'
                : `${doneTasks}/${totalTasks} done${activeTasks > 0 ? ` · ${activeTasks} active` : ''}`}
            </p>
          </div>
          {/* Mini progress bar */}
          {totalTasks > 0 && (
            <div className="w-24 h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {doneTasks > 0 && (
            <button
              onClick={handleClearCompleted}
              className="text-[11px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Clear done
            </button>
          )}
          <NewTaskForm projectPath={project.path} onCreated={refetchTasks} />
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="shrink-0 flex items-center gap-1 px-6 py-2 border-b border-white/[0.04]">
        {PANELS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPanel(p.id);
              if (p.id === 'artifacts') refetchArtifacts();
            }}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              panel === p.id
                ? 'bg-white/[0.08] text-text-primary'
                : 'text-text-muted hover:text-text-secondary hover:bg-white/[0.04]'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {panel === 'board' && (
          tasksLoading ? (
            <div className="flex items-center gap-3 text-text-muted text-xs">
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-accent animate-spin" />
              Loading tasks...
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMN_ORDER.map((status) => (
                <KanbanColumn
                  key={status}
                  status={status}
                  tasks={tasksByStatus[status]}
                  allTasks={taskList}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )
        )}

        {panel === 'artifacts' && (
          <ArtifactShelf
            projectPath={project.path}
            artifacts={artifacts ?? []}
          />
        )}

        {panel === 'mailboxes' && agents.length > 0 && (
          <MailboxPanel projectPath={project.path} agents={agents} />
        )}
      </div>
    </div>
  );
}
