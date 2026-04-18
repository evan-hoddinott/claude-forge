import { useState } from 'react';
import type { ConductorPlan, ConductorTask, ConductorStation, AgentType } from '../../../shared/types';
import TaskCard from './TaskCard';

interface WorkbenchProps {
  plan: ConductorPlan;
  onReassignTask?: (taskId: string, agent: AgentType) => void;
}

type Column = 'queued' | 'forging' | 'testing' | 'done';

function getTaskColumn(task: ConductorTask): Column {
  switch (task.status) {
    case 'running': return 'forging';
    case 'completed': return 'done';
    case 'failed': return 'done';
    case 'skipped': return 'done';
    default: return 'queued';
  }
}

interface ColumnDef {
  id: Column;
  label: string;
  icon: string;
  glowColor?: string;
}

const COLUMNS: ColumnDef[] = [
  { id: 'queued',  label: 'QUEUED',   icon: '📋' },
  { id: 'forging', label: 'FORGING',  icon: '🔨', glowColor: 'rgba(184,134,11,0.12)' },
  { id: 'testing', label: 'TESTING',  icon: '🔍' },
  { id: 'done',    label: 'DONE',     icon: '✅' },
];

interface TaskEntry {
  task: ConductorTask;
  station: ConductorStation;
}

export default function Workbench({ plan, onReassignTask }: WorkbenchProps) {
  const [selectedTask, setSelectedTask] = useState<TaskEntry | null>(null);

  // Flatten all tasks with their station
  const allTasks: TaskEntry[] = plan.stations.flatMap((station) =>
    station.tasks.map((task) => ({ task, station })),
  );

  // Group by column
  const columns: Record<Column, TaskEntry[]> = {
    queued:  allTasks.filter((e) => getTaskColumn(e.task) === 'queued'),
    forging: allTasks.filter((e) => getTaskColumn(e.task) === 'forging'),
    testing: [],
    done:    allTasks.filter((e) => getTaskColumn(e.task) === 'done'),
  };

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--caboo-font-body)' }}>
      {/* Column layout */}
      <div className="flex-1 flex gap-0 overflow-hidden">
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
              style={{
                borderBottom: '2px solid var(--caboo-border)',
                background: 'var(--caboo-bg-mid)',
              }}
            >
              <span style={{ fontSize: '11px' }}>{col.icon}</span>
              <span
                style={{
                  fontFamily: 'var(--caboo-font-heading)',
                  fontSize: '9px',
                  color: col.id === 'forging' ? 'var(--caboo-accent-amber)' : 'var(--caboo-text-secondary)',
                  letterSpacing: '1px',
                }}
              >
                {col.label}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: '9px',
                  color: 'var(--caboo-text-muted)',
                  border: '1px solid var(--caboo-border)',
                  padding: '0 3px',
                }}
              >
                {columns[col.id].length}
              </span>
            </div>

            {/* Column divider */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {columns[col.id].length === 0 ? (
                <div
                  className="text-center py-6 text-[10px]"
                  style={{
                    color: 'var(--caboo-text-muted)',
                    border: '1px dashed var(--caboo-border)',
                  }}
                >
                  {col.id === 'done' ? '─' : '...'}
                </div>
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
        <div
          className="shrink-0 p-4"
          style={{
            borderTop: '2px solid var(--caboo-border)',
            background: 'var(--caboo-bg-mid)',
            maxHeight: '200px',
            overflow: 'auto',
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              style={{
                fontFamily: 'var(--caboo-font-heading)',
                fontSize: '10px',
                color: 'var(--caboo-text-heading)',
              }}
            >
              {selectedTask.station.name} → {selectedTask.task.description}
            </div>
            <button
              onClick={() => setSelectedTask(null)}
              style={{ color: 'var(--caboo-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>
          {selectedTask.task.output && (
            <pre
              style={{
                fontSize: '10px',
                color: 'var(--caboo-text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '120px',
                overflow: 'auto',
              }}
            >
              {selectedTask.task.output}
            </pre>
          )}
          {selectedTask.task.error && (
            <div
              style={{
                fontSize: '10px',
                color: 'var(--caboo-accent-rust)',
                padding: '4px',
                border: '1px solid var(--caboo-accent-rust)',
              }}
            >
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
