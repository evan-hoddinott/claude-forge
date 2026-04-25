import { useState, useEffect, useRef } from 'react';
import type { ConductorPlan, ConductorStation, ConductorTask, AgentType } from '../../../shared/types';
import { useAPI } from '../../hooks/useAPI';
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

const AGENT_COLORS: Record<AgentType, string> = {
  claude:  'var(--caboo-accent-amber)',
  gemini:  '#4285F4',
  codex:   '#10A37F',
  copilot: '#6e40c9',
  ollama:  '#777777',
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
  const [liveOutput, setLiveOutput] = useState<Record<string, string>>({});
  const api = useAPI();

  const isPaused = plan.status === 'paused';
  const isRunning = plan.status === 'executing';

  // Collect live streaming output per task
  useEffect(() => {
    api.conductor.onTaskStream((data: unknown) => {
      const { planId, taskId, chunk } = data as { planId: string; taskId: string; chunk: string };
      if (planId !== plan.id) return;
      setLiveOutput((prev) => ({
        ...prev,
        [taskId]: ((prev[taskId] ?? '') + chunk).slice(-2000),
      }));
    });
    return () => api.conductor.offTaskStream();
  }, [api, plan.id]);

  // Clear live output for completed/failed tasks
  useEffect(() => {
    const completedIds = plan.stations
      .flatMap((s) => s.tasks)
      .filter((t) => t.status === 'completed' || t.status === 'failed' || t.status === 'skipped')
      .map((t) => t.id);
    if (completedIds.length === 0) return;
    setLiveOutput((prev) => {
      const next = { ...prev };
      for (const id of completedIds) delete next[id];
      return next;
    });
  }, [plan]);

  const completedTasks = plan.stations.flatMap((s) => s.tasks).filter((t) => t.status === 'completed').length;
  const runningTasks  = plan.stations.flatMap((s) => s.tasks).filter((t) => t.status === 'running').length;
  const totalTasks = plan.stations.flatMap((s) => s.tasks).length;

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--caboo-font-body)' }}>
      {/* Train animation */}
      <div className="shrink-0" style={{ borderBottom: '2px solid var(--caboo-border)', background: 'var(--caboo-bg-mid)', padding: '8px 16px' }}>
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
      <div className="shrink-0 flex items-center justify-between px-4 py-2" style={{ borderBottom: '1px solid var(--caboo-border)', background: 'var(--caboo-bg-deep)' }}>
        <div className="flex items-center gap-3">
          <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '10px', color: isRunning ? 'var(--caboo-accent-green)' : 'var(--caboo-accent-amber)' }}>
            {isRunning ? '● EN ROUTE' : isPaused ? '⏸ PAUSED' : '● STOPPED'}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)' }}>
            {completedTasks}/{totalTasks} tasks
          </div>
          {runningTasks > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--caboo-accent-amber)', fontFamily: 'var(--caboo-font-heading)' }}>
              ⚡ {runningTasks} running in parallel
            </div>
          )}
          {plan.tokenUsage.used > 0 && (
            <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)' }}>
              ⛽ ${plan.tokenUsage.used.toFixed(4)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex" style={{ border: '1px solid var(--caboo-border)' }}>
            <button onClick={() => setViewMode('list')} style={viewToggleStyle(viewMode === 'list')}>LIST</button>
            <button onClick={() => setViewMode('workbench')} style={viewToggleStyle(viewMode === 'workbench')}>WORKBENCH</button>
          </div>

          {/* Controls */}
          {isPaused ? (
            <button onClick={onResume} style={controlBtnStyle('var(--caboo-accent-green)')}>▶ Resume</button>
          ) : isRunning ? (
            <button onClick={onPause} style={controlBtnStyle('var(--caboo-accent-amber)')}>⏸ Pause</button>
          ) : null}
          {isRunning && (
            <button onClick={onSkipTask} style={controlBtnStyle('var(--caboo-text-muted)')}>⏭ Skip</button>
          )}
          <button onClick={onStop} style={controlBtnStyle('var(--caboo-accent-rust)')}>🛑 Stop</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'workbench' ? (
          <Workbench plan={plan} liveOutput={liveOutput} onReassignTask={onReassignTask} />
        ) : (
          <StationList plan={plan} liveOutput={liveOutput} />
        )}
      </div>
    </div>
  );
}

function viewToggleStyle(active: boolean): React.CSSProperties {
  return {
    padding: '2px 8px',
    fontSize: '10px',
    background: active ? 'var(--caboo-accent-amber)' : 'transparent',
    color: active ? 'var(--caboo-bg-deep)' : 'var(--caboo-text-muted)',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--caboo-font-heading)',
  };
}

function controlBtnStyle(color: string): React.CSSProperties {
  return {
    padding: '3px 10px',
    fontSize: '10px',
    border: `1px solid ${color}`,
    color,
    background: 'transparent',
    cursor: 'pointer',
    fontFamily: 'var(--caboo-font-heading)',
    letterSpacing: '0.5px',
  };
}

function StationList({ plan, liveOutput }: { plan: ConductorPlan; liveOutput: Record<string, string> }) {
  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-4">
      {plan.stations.map((station, si) => (
        <StationBlock
          key={station.id}
          station={station}
          stationIndex={si}
          isActive={si === plan.currentStationIndex}
          liveOutput={liveOutput}
        />
      ))}
    </div>
  );
}

function StationBlock({
  station,
  stationIndex,
  isActive,
  liveOutput,
}: {
  station: ConductorStation;
  stationIndex: number;
  isActive: boolean;
  liveOutput: Record<string, string>;
}) {
  const completedCount = station.tasks.filter((t) => t.status === 'completed').length;
  const runningCount   = station.tasks.filter((t) => t.status === 'running').length;

  return (
    <div>
      <div
        className="flex items-center justify-between px-3 py-2 mb-1"
        style={{
          border: `2px solid ${isActive ? 'var(--caboo-accent-amber)' : 'var(--caboo-border)'}`,
          background: isActive ? 'rgba(184,134,11,0.08)' : 'var(--caboo-bg-mid)',
        }}
      >
        <div className="flex items-center gap-2">
          <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '10px', color: isActive ? 'var(--caboo-accent-amber)' : 'var(--caboo-text-secondary)' }}>
            Station {stationIndex + 1}: {station.name}
          </div>
          {isActive && runningCount > 1 && (
            <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: '9px', color: 'var(--caboo-accent-green)', border: '1px solid var(--caboo-accent-green)', padding: '0 3px' }}>
              ⚡ {runningCount} parallel
            </div>
          )}
        </div>
        <div style={{ fontSize: '10px', color: 'var(--caboo-text-muted)', fontFamily: 'var(--caboo-font-body)' }}>
          [{completedCount}/{station.tasks.length}]{' '}
          {station.status === 'completed' ? '✅' : station.status === 'failed' ? '❌' : station.status === 'active' ? '🔄' : '⏳'}
        </div>
      </div>

      <div style={{ border: '1px solid var(--caboo-border)', borderTop: 'none', background: 'var(--caboo-bg-deep)' }}>
        {station.tasks.map((task, ti) => (
          <TaskRow key={task.id} task={task} isLast={ti === station.tasks.length - 1} liveOutput={liveOutput[task.id]} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ task, isLast, liveOutput }: { task: ConductorTask; isLast: boolean; liveOutput?: string }) {
  const [expanded, setExpanded] = useState(false);
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (task.status === 'running' && liveOutput) {
      setExpanded(true);
    }
  }, [task.status, liveOutput]);

  useEffect(() => {
    if (outputRef.current && liveOutput) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [liveOutput]);

  const agentColor = AGENT_COLORS[task.assignedAgent] ?? 'var(--caboo-text-muted)';

  return (
    <div style={{ borderBottom: isLast ? 'none' : '1px solid rgba(74,90,56,0.3)' }}>
      <div
        className="flex items-center gap-2 px-4 py-1.5 cursor-pointer"
        onClick={() => (task.output || liveOutput) && setExpanded((v) => !v)}
      >
        <TaskStatusIcon status={task.status} />
        <span style={{ flex: 1, fontSize: '11px', color: task.status === 'completed' ? 'var(--caboo-text-muted)' : task.status === 'running' ? 'var(--caboo-text-primary)' : 'var(--caboo-text-secondary)' }}>
          {task.description}
        </span>

        {/* Agent + model variant */}
        <span style={{ fontSize: '9px', color: agentColor, border: `1px solid ${agentColor}30`, padding: '0 3px', fontFamily: 'var(--caboo-font-heading)' }}>
          {AGENT_LABELS[task.assignedAgent] ?? task.assignedAgent}
        </span>
        {task.modelVariant && (
          <span style={{ fontSize: '8px', color: 'var(--caboo-text-muted)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.modelVariant}>
            {task.modelVariant}
          </span>
        )}

        {task.duration && (
          <span style={{ fontSize: '9px', color: 'var(--caboo-text-muted)' }}>
            {Math.round(task.duration / 1000)}s
          </span>
        )}
        {task.filesChanged && task.filesChanged.length > 0 && (
          <span style={{ fontSize: '9px', color: 'var(--caboo-accent-green)' }}>
            +{task.filesChanged.length} files
          </span>
        )}
        {task.status === 'running' && (
          <span style={{ fontSize: '10px', color: 'var(--caboo-accent-amber)', animation: 'conductor-spin 1s linear infinite' }}>↻</span>
        )}
        {(task.output || liveOutput) && (
          <span style={{ fontSize: '10px', color: 'var(--caboo-text-muted)' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {/* Live / completed output */}
      {expanded && (task.output || liveOutput) && (
        <pre
          ref={outputRef}
          style={{
            margin: 0,
            padding: '8px 12px 8px 36px',
            fontSize: '10px',
            fontFamily: 'var(--caboo-font-body)',
            color: task.status === 'running' ? 'var(--caboo-accent-amber)' : 'var(--caboo-text-dim)',
            background: 'var(--station-bg-deep)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: task.status === 'running' ? 160 : 200,
            overflowY: 'auto',
            borderTop: '1px solid var(--caboo-border)',
          }}
        >
          {(liveOutput ?? task.output ?? '')}
          {task.status === 'running' && <span style={{ animation: 'conductor-blink 1s step-end infinite' }}>▌</span>}
        </pre>
      )}

      {task.error && (
        <div style={{ padding: '6px 12px 6px 36px', fontSize: '10px', color: 'var(--caboo-accent-rust)', background: 'rgba(180,50,30,0.06)', borderTop: '1px solid rgba(180,50,30,0.3)' }}>
          ❌ {task.error}
        </div>
      )}
    </div>
  );
}
