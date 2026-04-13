import { useState } from 'react';
import type { ConductorPlan, ConductorStation, ConductorTask, AgentType } from '../../../shared/types';
import ConductorTrain from '../retro/ConductorTrain';
import Workbench from './Workbench';

interface ExecutionViewProps {
  plan: ConductorPlan;
  onPause: () => void;
  onResume: () => void;
  onSkipTask: () => void;
  onStop: () => void;
  onReassignTask?: (taskId: string, agent: AgentType) => void;
}

const AGENT_LABELS: Record<AgentType, string> = {
  claude:  'Claude',
  gemini:  'Gemini',
  codex:   'Codex',
  copilot: 'Copilot',
  ollama:  'Local AI',
};

function TaskStatusIcon({ status }: { status: ConductorTask['status'] }) {
  const icons: Record<ConductorTask['status'], string> = {
    pending:   '⏳',
    running:   '🔄',
    completed: '✅',
    failed:    '❌',
    skipped:   '⏭️',
  };
  return <span>{icons[status]}</span>;
}

type ViewMode = 'list' | 'workbench';

export default function ExecutionView({
  plan,
  onPause,
  onResume,
  onSkipTask,
  onStop,
  onReassignTask,
}: ExecutionViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const isPaused = plan.status === 'paused';
  const isRunning = plan.status === 'executing';
  const currentStation = plan.stations[plan.currentStationIndex];

  // Completed task count
  const completedTasks = plan.stations.flatMap((s) => s.tasks).filter((t) => t.status === 'completed').length;
  const totalTasks = plan.stations.flatMap((s) => s.tasks).length;

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--forge-font-body)' }}>
      {/* Train animation */}
      <div
        className="shrink-0"
        style={{
          borderBottom: '2px solid var(--forge-border)',
          background: 'var(--forge-bg-mid)',
          padding: '8px 16px',
        }}
      >
        <ConductorTrain
          stations={plan.stations.map((s) => ({ id: s.id, name: s.name, status: s.status }))}
          currentStationIndex={plan.currentStationIndex}
          isRunning={isRunning}
          isCheckpoint={plan.status === 'checkpoint'}
          isComplete={plan.status === 'completed'}
          hasError={plan.stations.some((s) => s.status === 'failed')}
        />
      </div>

      {/* Toolbar */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2"
        style={{ borderBottom: '1px solid var(--forge-border)', background: 'var(--forge-bg-deep)' }}
      >
        <div className="flex items-center gap-3">
          <div
            style={{
              fontFamily: 'var(--forge-font-heading)',
              fontSize: '10px',
              color: isRunning ? 'var(--forge-accent-green)' : 'var(--forge-accent-amber)',
            }}
          >
            {isRunning ? '● EN ROUTE' : isPaused ? '⏸ PAUSED' : '● STOPPED'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--forge-text-muted)' }}>
            {completedTasks}/{totalTasks} tasks
          </div>
          {plan.tokenUsage.used > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--forge-text-muted)' }}>
              ⛽ ${plan.tokenUsage.used.toFixed(3)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div
            className="flex"
            style={{ border: '1px solid var(--forge-border)' }}
          >
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                background: viewMode === 'list' ? 'var(--forge-accent-amber)' : 'transparent',
                color: viewMode === 'list' ? 'var(--forge-bg-deep)' : 'var(--forge-text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--forge-font-heading)',
              }}
            >
              LIST
            </button>
            <button
              onClick={() => setViewMode('workbench')}
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                background: viewMode === 'workbench' ? 'var(--forge-accent-amber)' : 'transparent',
                color: viewMode === 'workbench' ? 'var(--forge-bg-deep)' : 'var(--forge-text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'var(--forge-font-heading)',
              }}
            >
              WORKBENCH
            </button>
          </div>

          {/* Controls */}
          {isPaused ? (
            <button
              onClick={onResume}
              style={controlBtnStyle('var(--forge-accent-green)')}
            >
              ▶ Resume
            </button>
          ) : isRunning ? (
            <button
              onClick={onPause}
              style={controlBtnStyle('var(--forge-accent-amber)')}
            >
              ⏸ Pause
            </button>
          ) : null}
          {isRunning && (
            <button onClick={onSkipTask} style={controlBtnStyle('var(--forge-text-muted)')}>
              ⏭ Skip
            </button>
          )}
          <button onClick={onStop} style={controlBtnStyle('var(--forge-accent-rust)')}>
            🛑 Stop
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'workbench' ? (
          <Workbench plan={plan} onReassignTask={onReassignTask} />
        ) : (
          <StationList plan={plan} />
        )}
      </div>
    </div>
  );
}

function controlBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: '10px',
    border: `1px solid ${color}`,
    color,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--forge-font-heading)',
    letterSpacing: '0.5px',
  };
}

function StationList({ plan }: { plan: ConductorPlan }) {
  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-4">
      {plan.stations.map((station, si) => (
        <StationBlock key={station.id} station={station} stationIndex={si} isActive={si === plan.currentStationIndex} />
      ))}
    </div>
  );
}

function StationBlock({
  station,
  stationIndex,
  isActive,
}: {
  station: ConductorStation;
  stationIndex: number;
  isActive: boolean;
}) {
  const completedCount = station.tasks.filter((t) => t.status === 'completed').length;

  return (
    <div>
      <div
        className="flex items-center justify-between px-3 py-2 mb-1"
        style={{
          border: `2px solid ${isActive ? 'var(--forge-accent-amber)' : 'var(--forge-border)'}`,
          background: isActive ? 'rgba(184,134,11,0.08)' : 'var(--forge-bg-mid)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '10px',
            color: isActive ? 'var(--forge-accent-amber)' : 'var(--forge-text-secondary)',
          }}
        >
          Station {stationIndex + 1}: {station.name}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--forge-text-muted)', fontFamily: 'var(--forge-font-body)' }}>
          [{completedCount}/{station.tasks.length}]{' '}
          {station.status === 'completed' ? '✅' : station.status === 'failed' ? '❌' : station.status === 'active' ? '🔄' : '⏳'}
        </div>
      </div>

      <div
        style={{
          border: '1px solid var(--forge-border)',
          borderTop: 'none',
          background: 'var(--forge-bg-deep)',
        }}
      >
        {station.tasks.map((task, ti) => (
          <TaskRow key={task.id} task={task} isLast={ti === station.tasks.length - 1} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, isLast }: { task: ConductorTask; isLast: boolean }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5"
      style={{
        borderBottom: isLast ? 'none' : '1px solid rgba(74,90,56,0.3)',
      }}
    >
      <TaskStatusIcon status={task.status} />
      <span
        style={{
          flex: 1,
          fontSize: '11px',
          color: task.status === 'completed'
            ? 'var(--forge-text-muted)'
            : task.status === 'running'
            ? 'var(--forge-text-primary)'
            : 'var(--forge-text-secondary)',
        }}
      >
        {task.description}
      </span>
      <span style={{ fontSize: '10px', color: 'var(--forge-text-muted)' }}>
        {AGENT_LABELS[task.assignedAgent] ?? task.assignedAgent}
      </span>
      {task.duration && (
        <span style={{ fontSize: '9px', color: 'var(--forge-text-muted)' }}>
          {Math.round(task.duration / 1000)}s
        </span>
      )}
      {task.status === 'running' && (
        <span
          style={{
            fontSize: '10px',
            color: 'var(--forge-accent-amber)',
            animation: 'conductor-spin 1s linear infinite',
          }}
        >
          ↻
        </span>
      )}
    </div>
  );
}
