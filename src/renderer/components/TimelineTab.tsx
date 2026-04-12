import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import type { Project, TimelineEvent, TimelineEventType, AgentType } from '../../shared/types';

// ─── Filter options ───────────────────────────────────────────────────────────

type FilterOption = 'all' | 'agent' | 'git' | 'ghost-test' | 'my-edits' | 'skills' | 'battles';

const FILTERS: { id: FilterOption; label: string }[] = [
  { id: 'all', label: 'All events' },
  { id: 'agent', label: 'Agent sessions' },
  { id: 'git', label: 'Git events' },
  { id: 'ghost-test', label: 'Ghost tests' },
  { id: 'my-edits', label: 'My edits' },
  { id: 'skills', label: 'Skills' },
  { id: 'battles', label: 'Battles' },
];

function matchesFilter(event: TimelineEvent, filter: FilterOption): boolean {
  if (filter === 'all') return true;
  if (filter === 'agent') return event.type === 'agent-start' || event.type === 'agent-end';
  if (filter === 'git') return event.type === 'git-commit' || event.type === 'git-push';
  if (filter === 'ghost-test') return event.type === 'ghost-test';
  if (filter === 'my-edits') return event.type === 'file-edit';
  if (filter === 'skills') return event.type === 'skill-install' || event.type === 'skill-uninstall';
  if (filter === 'battles') return event.type === 'battle';
  return true;
}

// ─── Icon & color per event type ─────────────────────────────────────────────

function eventIcon(event: TimelineEvent): string {
  switch (event.type) {
    case 'agent-start':
    case 'agent-end':
      return '🤖';
    case 'file-edit':
      return '📝';
    case 'git-commit':
      return '💾';
    case 'git-push':
      return '📤';
    case 'ghost-test': {
      const r = event.details?.testResult;
      if (r === 'passed' || r === 'auto-fixed') return '✅';
      if (r === 'failed') return '⚠️';
      return '🧪';
    }
    case 'battle':
      return '⚔️';
    case 'skill-install':
      return '🛡';
    case 'skill-uninstall':
      return '🗑';
    case 'bundle-export':
      return '📦';
    case 'settings-change':
      return '⚙️';
    default:
      return '•';
  }
}

function eventBorderColor(event: TimelineEvent): string {
  switch (event.type) {
    case 'agent-start':
    case 'agent-end':
      return agentColor(event.agent);
    case 'file-edit':
    case 'settings-change':
      return 'border-gray-500/40';
    case 'git-commit':
    case 'git-push':
      return 'border-teal-500/40';
    case 'ghost-test': {
      const r = event.details?.testResult;
      if (r === 'passed' || r === 'auto-fixed') return 'border-green-500/40';
      if (r === 'failed') return 'border-amber-500/40';
      return 'border-green-500/40';
    }
    case 'battle':
      return 'border-purple-500/40';
    case 'skill-install':
    case 'skill-uninstall':
      return 'border-yellow-700/40';
    case 'bundle-export':
      return 'border-blue-500/40';
    default:
      return 'border-border/30';
  }
}

function agentColor(agent: AgentType | undefined): string {
  if (!agent) return 'border-accent/40';
  const map: Record<AgentType, string> = {
    claude: 'border-amber-500/50',
    gemini: 'border-blue-500/50',
    codex: 'border-green-500/50',
    copilot: 'border-purple-500/50',
  };
  return map[agent] ?? 'border-accent/40';
}

// ─── Time helpers ─────────────────────────────────────────────────────────────

function formatTime(isoDate: string): string {
  const d = new Date(isoDate);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m}${ampm}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

function dayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, now)) return 'TODAY';
  if (sameDay(d, yesterday)) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

// ─── Event detail lines ───────────────────────────────────────────────────────

function EventDetails({ event }: { event: TimelineEvent }) {
  const d = event.details;
  if (!d) return null;

  const lines: string[] = [];

  if (d.filesChanged && d.filesChanged.length > 0) {
    const shown = d.filesChanged.slice(0, 4);
    const extra = d.filesChanged.length - shown.length;
    lines.push(
      `Modified: ${shown.map((f) => f.split('/').pop()).join(', ')}${extra > 0 ? ` +${extra} more` : ''}`,
    );
  }
  if (d.filesCreated && d.filesCreated.length > 0) {
    lines.push(`Created: ${d.filesCreated.map((f) => f.split('/').pop()).join(', ')}`);
  }
  if (d.filesDeleted && d.filesDeleted.length > 0) {
    lines.push(`Deleted: ${d.filesDeleted.map((f) => f.split('/').pop()).join(', ')}`);
  }
  if (d.duration !== undefined) {
    lines.push(`Duration: ${formatDuration(d.duration)}`);
  }
  if (d.commitMessage) {
    lines.push(`Commit: "${d.commitMessage}"`);
  }
  if (d.testResult) {
    const resultLabel: Record<string, string> = {
      passed: 'All tests pass',
      failed: 'Tests failed',
      'auto-fixed': 'Auto-fixed and re-run',
      timeout: 'Test timed out',
    };
    if (d.battleTask) lines.push(d.battleTask);
    lines.push(resultLabel[d.testResult] ?? d.testResult);
  }
  if (d.battleTask && event.type === 'battle') {
    lines.push(`Task: "${d.battleTask}"`);
  }
  if (d.battleWinner && event.type === 'battle') {
    lines.push(`Winner: ${d.battleWinner}`);
  }
  if (d.skillName) {
    lines.push(d.skillName);
  }
  if (d.linesAdded !== undefined || d.linesRemoved !== undefined) {
    const parts = [];
    if (d.linesAdded) parts.push(`+${d.linesAdded}`);
    if (d.linesRemoved) parts.push(`-${d.linesRemoved}`);
    if (parts.length > 0) lines.push(parts.join(', ') + ' lines');
  }

  if (lines.length === 0) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {lines.map((line, i) => (
        <div key={i} className="text-xs text-text-muted font-mono leading-snug">
          {line}
        </div>
      ))}
    </div>
  );
}

// ─── Single timeline entry ────────────────────────────────────────────────────

function TimelineEntry({ event, isLast }: { event: TimelineEvent; isLast: boolean }) {
  const borderClass = eventBorderColor(event);

  return (
    <div className="flex gap-3">
      {/* Vertical line + node */}
      <div className="flex flex-col items-center">
        <div className="w-2 h-2 rounded-none border-2 border-accent bg-surface mt-1 shrink-0" />
        {!isLast && <div className="w-0.5 flex-1 bg-border/30 mt-1" />}
      </div>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className={`mb-3 flex-1 border ${borderClass} bg-surface/60 p-3 rounded-none`}
      >
        <div className="flex items-start gap-2">
          <span className="text-base leading-none mt-0.5 shrink-0">{eventIcon(event)}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xs font-mono text-text-muted shrink-0">{formatTime(event.timestamp)}</span>
              <span className="text-sm text-text-primary font-medium leading-snug">{event.description}</span>
            </div>
            <EventDetails event={event} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Day group ────────────────────────────────────────────────────────────────

function DayGroup({ label, events }: { label: string; events: TimelineEvent[] }) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-mono font-bold text-text-muted tracking-widest">{label}</span>
        <div className="flex-1 h-px bg-border/20" />
      </div>
      {events.map((event, i) => (
        <TimelineEntry key={event.id} event={event} isLast={i === events.length - 1} />
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: FilterOption }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div className="text-4xl opacity-40">📋</div>
      <p className="text-text-secondary font-medium">No timeline events yet</p>
      <p className="text-text-muted text-sm max-w-xs">
        {filter === 'all'
          ? 'Start an agent session, edit files, or run Ghost Tests — every action will appear here.'
          : `No "${FILTERS.find((f) => f.id === filter)?.label.toLowerCase()}" events recorded yet.`}
      </p>
    </div>
  );
}

// ─── Filter Dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({
  value,
  onChange,
}: {
  value: FilterOption;
  onChange: (v: FilterOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = FILTERS.find((f) => f.id === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border/40 bg-surface/80 hover:bg-surface text-text-secondary hover:text-text-primary transition-colors rounded-none"
      >
        {current.label}
        <span className="opacity-60">▾</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1 z-50 min-w-[180px] border border-border/40 bg-surface shadow-lg"
          >
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => { onChange(f.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs font-mono transition-colors ${
                  f.id === value
                    ? 'text-accent bg-accent/10'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
                }`}
              >
                {f.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TimelineTab({ project }: { project: Project }) {
  const api = useAPI();
  const [filter, setFilter] = useState<FilterOption>('all');

  const { data: rawEvents, refetch } = useQuery(
    () => api.timeline.getEvents(project.id),
    [project.id],
  );

  // Listen for new events pushed from main process
  useEffect(() => {
    const handler = (data: unknown) => {
      const d = data as { projectId: string };
      if (d.projectId === project.id) refetch();
    };
    api.timeline.onEventAdded(handler);
    return () => api.timeline.offEventAdded();
  }, [api, project.id, refetch]);

  const events = (rawEvents ?? []).filter((e) => matchesFilter(e, filter));

  // Group events by day
  const dayGroups: { label: string; events: TimelineEvent[] }[] = [];
  for (const event of events) {
    const label = dayLabel(event.timestamp);
    const last = dayGroups[dayGroups.length - 1];
    if (last && last.label === label) {
      last.events.push(event);
    } else {
      dayGroups.push({ label, events: [event] });
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/20 shrink-0">
        <div>
          <h2 className="text-base font-semibold text-text-primary font-mono tracking-tight">
            Project Timeline
          </h2>
          <p className="text-xs text-text-muted mt-0.5 font-mono">
            {(rawEvents ?? []).length} events recorded
          </p>
        </div>
        <FilterDropdown value={filter} onChange={setFilter} />
      </div>

      {/* Timeline content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {events.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={filter}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {dayGroups.map((group) => (
                <DayGroup key={group.label} label={group.label} events={group.events} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
