import { useState, useRef, useEffect } from 'react';
import type { ConductorPlan, ConductorTask, ConductorStation, AgentType } from '../../../shared/types';
import TaskCard from './TaskCard';

interface WorkbenchProps {
  plan: ConductorPlan;
  liveOutput?: Record<string, string>;
  onReassignTask?: (taskId: string, agent: AgentType) => void;
}

type Column = 'queued' | 'forging' | 'done';

function getTaskColumn(task: ConductorTask): Column {
  switch (task.status) {
    case 'running': return 'forging';
    case 'completed':
    case 'failed':
    case 'skipped':  return 'done';
    default:         return 'queued';
  }
}

const AGENT_COLORS: Record<AgentType, string> = {
  claude:  'var(--caboo-accent-amber)',
  gemini:  '#4285F4',
  codex:   '#10A37F',
  copilot: '#6e40c9',
  ollama:  '#777777',
};

const AGENT_LABELS: Record<AgentType, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
  ollama:  'Local AI',
};

interface ColumnDef { id: Column; label: string; icon: string; glowColor?: string; }

const COLUMNS: ColumnDef[] = [
  { id: 'queued',  label: 'QUEUED',  icon: '📋' },
  { id: 'forging', label: 'FORGING', icon: '🔨', glowColor: 'rgba(184,134,11,0.08)' },
  { id: 'done',    label: 'DONE',    icon: '✅' },
];

interface TaskEntry { task: ConductorTask; station: ConductorStation; }

// Live agent pane shown when a task is running
function LiveAgentPane({ task, output }: { task: ConductorTask; output: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const agentColor = AGENT_COLORS[task.assignedAgent] ?? 'var(--caboo-text-muted)';

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [output]);

  return (
    <div style={{
      border: `1px solid ${agentColor}`,
      background: `${agentColor}0a`,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{
        padding: '6px 10px',
        borderBottom: `1px solid ${agentColor}40`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, color: agentColor, letterSpacing: 1 }}>
          🔄 {AGENT_LABELS[task.assignedAgent]}
        </span>
        <span style={{ fontSize: 9, color: 'var(--caboo-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.description}
        </span>
        <span style={{ fontSize: 8, color: 'var(--caboo-text-muted)', fontFamily: 'var(--caboo-font-heading)', animation: 'conductor-spin 2s linear infinite' }}>
          ↻
        </span>
      </div>

      {/* Live output stream */}
      <pre
        ref={ref}
        style={{
          flex: 1,
          margin: 0,
          padding: '8px 10px',
          fontSize: 10,
          fontFamily: 'var(--caboo-font-body)',
          color: 'var(--caboo-text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {output || '(waiting for output…)'}
        <span style={{ color: agentColor, animation: 'conductor-blink 1s step-end infinite' }}>▌</span>
      </pre>

      {/* Footer */}
      {task.modelVariant && (
        <div style={{
          padding: '4px 10px',
          borderTop: `1px solid ${agentColor}30`,
          fontSize: 9,
          color: 'var(--caboo-text-muted)',
          fontFamily: 'var(--caboo-font-body)',
          flexShrink: 0,
        }}>
          model: {task.modelVariant}
        </div>
      )}
    </div>
  );
}

// Completed task pane
function DoneAgentPane({ task }: { task: ConductorTask }) {
  const [expanded, setExpanded] = useState(false);
  const agentColor = AGENT_COLORS[task.assignedAgent] ?? 'var(--caboo-text-muted)';
  const isFailed = task.status === 'failed';

  return (
    <div style={{
      border: `1px solid ${isFailed ? 'var(--caboo-accent-rust)' : 'var(--caboo-border)'}`,
      background: 'var(--caboo-bg-mid)',
    }}>
      <div
        style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, cursor: task.output ? 'pointer' : 'default' }}
        onClick={() => task.output && setExpanded((v) => !v)}
      >
        <span style={{ fontSize: 11 }}>{isFailed ? '❌' : task.status === 'skipped' ? '⏭️' : '✅'}</span>
        <span style={{ fontSize: 10, color: 'var(--caboo-text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.description}
        </span>
        <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 8, color: agentColor }}>
          {AGENT_LABELS[task.assignedAgent]}
        </span>
        {task.duration && (
          <span style={{ fontSize: 8, color: 'var(--caboo-text-muted)' }}>{Math.round(task.duration / 1000)}s</span>
        )}
        {task.filesChanged && task.filesChanged.length > 0 && (
          <span style={{ fontSize: 8, color: 'var(--caboo-accent-green)' }}>+{task.filesChanged.length}f</span>
        )}
      </div>
      {expanded && task.output && (
        <pre style={{
          margin: 0, padding: '6px 10px', fontSize: 9, fontFamily: 'var(--caboo-font-body)',
          color: 'var(--caboo-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          maxHeight: 120, overflowY: 'auto', borderTop: '1px solid var(--caboo-border)',
        }}>
          {task.output.slice(-1000)}
        </pre>
      )}
      {task.error && (
        <div style={{ padding: '4px 10px', fontSize: 9, color: 'var(--caboo-accent-rust)', borderTop: '1px solid var(--caboo-accent-rust)30' }}>
          {task.error.slice(0, 200)}
        </div>
      )}
    </div>
  );
}

export default function Workbench({ plan, liveOutput = {}, onReassignTask }: WorkbenchProps) {
  const [selectedTask, setSelectedTask] = useState<TaskEntry | null>(null);

  const allTasks: TaskEntry[] = plan.stations.flatMap((station) =>
    station.tasks.map((task) => ({ task, station })),
  );

  const columns: Record<Column, TaskEntry[]> = {
    queued:  allTasks.filter((e) => getTaskColumn(e.task) === 'queued'),
    forging: allTasks.filter((e) => getTaskColumn(e.task) === 'forging'),
    done:    allTasks.filter((e) => getTaskColumn(e.task) === 'done'),
  };

  const runningTasks = columns.forging;

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--caboo-font-body)' }}>
      {/* Live agent workspace — shown when tasks are running */}
      {runningTasks.length > 0 && (
        <div style={{
          height: runningTasks.length > 0 ? Math.min(runningTasks.length * 200, 300) : 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${Math.min(runningTasks.length, 3)}, 1fr)`,
          gap: 1,
          borderBottom: '2px solid var(--caboo-border)',
          flexShrink: 0,
        }}>
          {runningTasks.map(({ task }) => (
            <LiveAgentPane key={task.id} task={task} output={liveOutput[task.id] ?? ''} />
          ))}
        </div>
      )}

      {/* Kanban columns */}
      <div className="flex-1 flex overflow-hidden">
        {COLUMNS.map((col, ci) => (
          <div
            key={col.id}
            className="flex-1 flex flex-col overflow-hidden"
            style={{
              borderRight: ci < COLUMNS.length - 1 ? '2px solid var(--caboo-border)' : 'none',
              background: col.glowColor ?? 'transparent',
            }}
          >
            {/* Column header */}
            <div
              className="shrink-0 px-3 py-2 flex items-center gap-1"
              style={{ borderBottom: '2px solid var(--caboo-border)', background: 'var(--caboo-bg-mid)' }}
            >
              <span style={{ fontSize: '11px' }}>{col.icon}</span>
              <span style={{
                fontFamily: 'var(--caboo-font-heading)',
                fontSize: '9px',
                color: col.id === 'forging' ? 'var(--caboo-accent-amber)' : 'var(--caboo-text-secondary)',
                letterSpacing: '1px',
              }}>
                {col.label}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: '9px', color: 'var(--caboo-text-muted)',
                border: '1px solid var(--caboo-border)', padding: '0 3px',
              }}>
                {columns[col.id].length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {columns[col.id].length === 0 ? (
                <div className="text-center py-6 text-[10px]" style={{ color: 'var(--caboo-text-muted)', border: '1px dashed var(--caboo-border)' }}>
                  {col.id === 'done' ? '─' : '...'}
                </div>
              ) : col.id === 'done' ? (
                columns[col.id].map(({ task }) => (
                  <DoneAgentPane key={task.id} task={task} />
                ))
              ) : (
                columns[col.id].map(({ task, station }) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => setSelectedTask(selectedTask?.task.id === task.id ? null : { task, station })}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Selected task detail panel */}
      {selectedTask && (
        <div className="shrink-0 p-4" style={{ borderTop: '2px solid var(--caboo-border)', background: 'var(--caboo-bg-mid)', maxHeight: '180px', overflow: 'auto' }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '10px', color: 'var(--caboo-text-heading)' }}>
              {selectedTask.station.name} → {selectedTask.task.description}
            </div>
            <button onClick={() => setSelectedTask(null)} style={{ color: 'var(--caboo-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
          </div>
          {selectedTask.task.output && (
            <pre style={{ fontSize: '10px', color: 'var(--caboo-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '100px', overflow: 'auto' }}>
              {selectedTask.task.output}
            </pre>
          )}
          {selectedTask.task.error && (
            <div style={{ fontSize: '10px', color: 'var(--caboo-accent-rust)', padding: '4px', border: '1px solid var(--caboo-accent-rust)' }}>
              Error: {selectedTask.task.error}
            </div>
          )}
          {selectedTask.task.filesChanged && selectedTask.task.filesChanged.length > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)', marginTop: '4px' }}>
              Files: {selectedTask.task.filesChanged.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
