import { v4 as uuidv4 } from 'uuid';
import type { TimelineEvent, TimelineEventType, AgentType } from '../../shared/types';
import * as store from '../store';

type EventInput = Omit<TimelineEvent, 'id' | 'timestamp' | 'projectId'>;

type EventAddedCallback = (data: { projectId: string; event: TimelineEvent }) => void;

const eventAddedCallbacks: EventAddedCallback[] = [];

export function onEventAdded(cb: EventAddedCallback): void {
  eventAddedCallbacks.push(cb);
}

export function offEventAdded(cb?: EventAddedCallback): void {
  if (cb) {
    const idx = eventAddedCallbacks.indexOf(cb);
    if (idx !== -1) eventAddedCallbacks.splice(idx, 1);
  } else {
    eventAddedCallbacks.length = 0;
  }
}

export function addEvent(projectId: string, input: EventInput): TimelineEvent {
  const event: TimelineEvent = {
    id: uuidv4(),
    projectId,
    timestamp: new Date().toISOString(),
    ...input,
  };
  store.addTimelineEvent(projectId, event);
  for (const cb of eventAddedCallbacks) {
    cb({ projectId, event });
  }
  return event;
}

export function getEvents(projectId: string): TimelineEvent[] {
  return store.getTimelineEvents(projectId);
}

// Convenience helpers called from ipc-handlers hooks

export function recordAgentStart(projectId: string, agent: AgentType, task?: string): void {
  addEvent(projectId, {
    type: 'agent-start' as TimelineEventType,
    agent,
    description: `${agentLabel(agent)} session started`,
    details: task ? { battleTask: task } : undefined,
  });
}

export function recordAgentEnd(
  projectId: string,
  agent: AgentType,
  filesChanged: string[],
  durationMs?: number,
): void {
  addEvent(projectId, {
    type: 'agent-end' as TimelineEventType,
    agent,
    description: `${agentLabel(agent)} session ended`,
    details: {
      filesChanged,
      duration: durationMs,
    },
  });
}

export function recordFileEdit(projectId: string, filePath: string): void {
  addEvent(projectId, {
    type: 'file-edit' as TimelineEventType,
    description: `Edited ${filePath.split('/').pop() ?? filePath}`,
    details: { filesChanged: [filePath] },
  });
}

export function recordGhostTest(
  projectId: string,
  status: string,
  command: string,
  duration: number,
): void {
  const passed = status === 'passed' || status === 'auto-fixed';
  addEvent(projectId, {
    type: 'ghost-test' as TimelineEventType,
    description: passed
      ? `Ghost test ${status === 'auto-fixed' ? 'auto-fixed' : 'passed'}`
      : `Ghost test ${status}`,
    details: {
      testResult: status,
      battleTask: command,
      duration,
    },
  });
}

export function recordBattle(
  projectId: string,
  task: string,
  agents: [AgentType, AgentType],
  winnerAgent?: AgentType,
): void {
  addEvent(projectId, {
    type: 'battle' as TimelineEventType,
    description: `Battle: ${agentLabel(agents[0])} vs ${agentLabel(agents[1])}`,
    details: {
      battleTask: task,
      battleWinner: winnerAgent ? agentLabel(winnerAgent) : undefined,
    },
  });
}

export function recordSkillInstall(projectId: string, skillName: string, uninstall = false): void {
  addEvent(projectId, {
    type: uninstall ? ('skill-uninstall' as TimelineEventType) : ('skill-install' as TimelineEventType),
    description: uninstall
      ? `Uninstalled skill: ${skillName}`
      : `Installed skill: ${skillName}`,
    details: { skillName },
  });
}

export function recordGitPush(projectId: string, commitCount?: number): void {
  addEvent(projectId, {
    type: 'git-push' as TimelineEventType,
    description: commitCount
      ? `Pushed ${commitCount} commit${commitCount !== 1 ? 's' : ''} to GitHub`
      : 'Pushed to GitHub',
  });
}

export function recordSettingsChange(projectId: string): void {
  addEvent(projectId, {
    type: 'settings-change' as TimelineEventType,
    description: 'Project settings updated',
  });
}

function agentLabel(agent: AgentType): string {
  const labels: Record<AgentType, string> = {
    claude: 'Claude Code',
    gemini: 'Gemini CLI',
    codex: 'OpenAI Codex',
    copilot: 'GitHub Copilot',
  };
  return labels[agent] ?? agent;
}
