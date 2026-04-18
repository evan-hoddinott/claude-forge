/**
 * blackboard-service.ts
 * Implements the Blackboard Pattern for inter-agent coordination.
 *
 * Agents communicate through structured task postings and artifact sharing,
 * not raw conversational context. Agent-to-agent mailboxes enable direct
 * lateral communication without shared context windows.
 *
 * All state lives in .caboo/blackboard/:
 *   tasks.json          — shared task queue (single source of truth)
 *   .lock               — atomic file lock (prevents race conditions)
 *   artifacts/<name>    — structured outputs posted by agents
 *   mailboxes/<agent>.jsonl — per-agent JSONL message queues
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import type {
  AgentType,
  BlackboardTask,
  BlackboardTaskStatus,
  BlackboardPriority,
  BlackboardArtifact,
  AgentMessage,
  AgentMessageType,
} from '../../shared/types';

// --- Helpers ---

function broadcast(channel: string, data: unknown): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

function bbPath(projectPath: string, ...parts: string[]): string {
  return path.join(projectPath, '.caboo', 'blackboard', ...parts);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// --- File Locking ---
// Uses atomic O_EXCL file creation so two processes can't both succeed.

export async function acquireLock(projectPath: string): Promise<boolean> {
  const lockPath = bbPath(projectPath, '.lock');
  try {
    await fs.writeFile(lockPath, process.pid.toString(), { flag: 'wx' });
    return true;
  } catch {
    // Check for stale lock (> 30 s old)
    try {
      const stat = await fs.stat(lockPath);
      if (Date.now() - stat.mtimeMs > 30_000) {
        await fs.unlink(lockPath);
        return acquireLock(projectPath); // retry once
      }
    } catch {
      // Lock file disappeared between check and stat — retry
      return acquireLock(projectPath);
    }
    return false; // lock held by another process
  }
}

export async function releaseLock(projectPath: string): Promise<void> {
  try {
    await fs.unlink(bbPath(projectPath, '.lock'));
  } catch {
    // Already released or never existed
  }
}

// --- Internal task I/O ---

async function readTasks(projectPath: string): Promise<BlackboardTask[]> {
  const data = await readJson<{ tasks: BlackboardTask[] }>(bbPath(projectPath, 'tasks.json'));
  return data?.tasks ?? [];
}

async function writeTasks(projectPath: string, tasks: BlackboardTask[]): Promise<void> {
  await writeJson(bbPath(projectPath, 'tasks.json'), { tasks });
}

// --- Task Lifecycle ---

export async function getTasks(projectPath: string): Promise<BlackboardTask[]> {
  return readTasks(projectPath);
}

export async function createTask(
  projectPath: string,
  task: Omit<BlackboardTask, 'id' | 'createdAt' | 'artifacts' | 'filesModified'>,
): Promise<BlackboardTask> {
  const locked = await acquireLock(projectPath);
  if (!locked) throw new Error('Could not acquire blackboard lock');
  try {
    const tasks = await readTasks(projectPath);

    const newTask: BlackboardTask = {
      ...task,
      id: `task-${uuidv4().slice(0, 8)}`,
      createdAt: new Date().toISOString(),
      artifacts: [],
      filesModified: [],
    };

    // Compute initial blockedBy from dependencies
    if (newTask.dependencies.length > 0) {
      const firstIncomplete = newTask.dependencies.find(
        (depId) => tasks.find((t) => t.id === depId)?.status !== 'completed',
      );
      if (firstIncomplete) newTask.blockedBy = firstIncomplete;
    }

    tasks.push(newTask);
    await writeTasks(projectPath, tasks);
    broadcast('blackboard:task-update', { projectPath, task: newTask });
    return newTask;
  } finally {
    await releaseLock(projectPath);
  }
}

export async function claimTask(
  projectPath: string,
  taskId: string,
  agent: AgentType,
): Promise<boolean> {
  const locked = await acquireLock(projectPath);
  if (!locked) return false;
  try {
    const tasks = await readTasks(projectPath);
    const task = tasks.find((t) => t.id === taskId);

    if (!task || task.status !== 'pending') return false;
    if (task.blockedBy) return false;

    // Verify all dependencies are completed
    const allDepsDone = task.dependencies.every(
      (depId) => tasks.find((t) => t.id === depId)?.status === 'completed',
    );
    if (!allDepsDone) return false;

    task.status = 'claimed';
    task.claimedBy = agent;
    task.claimedAt = new Date().toISOString();

    await writeTasks(projectPath, tasks);
    broadcast('blackboard:task-update', { projectPath, task });
    return true;
  } finally {
    await releaseLock(projectPath);
  }
}

export async function updateTaskStatus(
  projectPath: string,
  taskId: string,
  status: BlackboardTaskStatus,
): Promise<void> {
  const locked = await acquireLock(projectPath);
  if (!locked) throw new Error('Could not acquire blackboard lock');
  try {
    const tasks = await readTasks(projectPath);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = status;
    await writeTasks(projectPath, tasks);
    broadcast('blackboard:task-update', { projectPath, task });
  } finally {
    await releaseLock(projectPath);
  }
}

export async function completeTask(
  projectPath: string,
  taskId: string,
  artifacts: string[],
  filesModified: string[],
): Promise<void> {
  const locked = await acquireLock(projectPath);
  if (!locked) throw new Error('Could not acquire blackboard lock');
  try {
    const tasks = await readTasks(projectPath);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.artifacts = [...(task.artifacts ?? []), ...artifacts];
    task.filesModified = [...(task.filesModified ?? []), ...filesModified];

    if (task.claimedAt) {
      task.actualMinutes = Math.round(
        (Date.now() - new Date(task.claimedAt).getTime()) / 60_000,
      );
    }

    // Resolve any tasks that were blocked by this one
    for (const t of tasks) {
      if (t.blockedBy === taskId && t.status === 'pending') {
        const allDone = t.dependencies.every(
          (dId) => tasks.find((x) => x.id === dId)?.status === 'completed',
        );
        if (allDone) t.blockedBy = undefined;
      }
    }

    await writeTasks(projectPath, tasks);
    broadcast('blackboard:task-update', { projectPath, task });
  } finally {
    await releaseLock(projectPath);
  }
}

export async function failTask(
  projectPath: string,
  taskId: string,
  error: string,
): Promise<void> {
  const locked = await acquireLock(projectPath);
  if (!locked) throw new Error('Could not acquire blackboard lock');
  try {
    const tasks = await readTasks(projectPath);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'failed';
    task.failedAt = new Date().toISOString();
    task.error = error;
    await writeTasks(projectPath, tasks);
    broadcast('blackboard:task-update', { projectPath, task });
  } finally {
    await releaseLock(projectPath);
  }
}

export async function deleteTask(projectPath: string, taskId: string): Promise<void> {
  const locked = await acquireLock(projectPath);
  if (!locked) throw new Error('Could not acquire blackboard lock');
  try {
    const tasks = await readTasks(projectPath);
    await writeTasks(projectPath, tasks.filter((t) => t.id !== taskId));
  } finally {
    await releaseLock(projectPath);
  }
}

export async function clearCompleted(projectPath: string): Promise<void> {
  const locked = await acquireLock(projectPath);
  if (!locked) throw new Error('Could not acquire blackboard lock');
  try {
    const tasks = await readTasks(projectPath);
    await writeTasks(projectPath, tasks.filter((t) => t.status !== 'completed'));
  } finally {
    await releaseLock(projectPath);
  }
}

// --- Artifact Management ---

export async function postArtifact(
  projectPath: string,
  name: string,
  content: string,
): Promise<void> {
  const artifactsDir = bbPath(projectPath, 'artifacts');
  await fs.mkdir(artifactsDir, { recursive: true });
  // Sanitize filename to prevent path traversal
  const safeName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  await fs.writeFile(path.join(artifactsDir, safeName), content, 'utf8');
}

export async function getArtifact(projectPath: string, name: string): Promise<string> {
  const safeName = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return fs.readFile(bbPath(projectPath, 'artifacts', safeName), 'utf8');
}

export async function listArtifacts(projectPath: string): Promise<BlackboardArtifact[]> {
  const artifactsDir = bbPath(projectPath, 'artifacts');
  try {
    const files = await fs.readdir(artifactsDir);
    const results: BlackboardArtifact[] = [];
    for (const name of files) {
      try {
        const stat = await fs.stat(path.join(artifactsDir, name));
        results.push({ name, createdAt: stat.birthtime.toISOString(), size: stat.size });
      } catch {
        // skip unreadable entries
      }
    }
    return results;
  } catch {
    return [];
  }
}

// --- Agent Mailboxes ---
// JSONL format — one AgentMessage per line.

function mailboxPath(projectPath: string, agent: AgentType): string {
  return bbPath(projectPath, 'mailboxes', `${agent}.jsonl`);
}

export async function sendMessage(
  projectPath: string,
  message: Omit<AgentMessage, 'id' | 'timestamp' | 'read'>,
): Promise<void> {
  const fullMsg: AgentMessage = {
    ...message,
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    read: false,
  };

  const mboxDir = bbPath(projectPath, 'mailboxes');
  await fs.mkdir(mboxDir, { recursive: true });
  await fs.appendFile(mailboxPath(projectPath, message.to), JSON.stringify(fullMsg) + '\n', 'utf8');

  broadcast('blackboard:message-received', { projectPath, message: fullMsg });
}

export async function readMessages(
  projectPath: string,
  agent: AgentType,
  since?: string,
): Promise<AgentMessage[]> {
  try {
    const content = await fs.readFile(mailboxPath(projectPath, agent), 'utf8');
    const messages = content
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try { return JSON.parse(line) as AgentMessage; } catch { return null; }
      })
      .filter((m): m is AgentMessage => m !== null);

    if (since) {
      const sinceMs = new Date(since).getTime();
      return messages.filter((m) => new Date(m.timestamp).getTime() > sinceMs);
    }
    return messages;
  } catch {
    return [];
  }
}

export async function markRead(
  projectPath: string,
  agent: AgentType,
  messageId: string,
): Promise<void> {
  const mboxPath = mailboxPath(projectPath, agent);
  try {
    const content = await fs.readFile(mboxPath, 'utf8');
    const updated = content
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        try {
          const msg = JSON.parse(line) as AgentMessage;
          if (msg.id === messageId) msg.read = true;
          return JSON.stringify(msg);
        } catch {
          return line;
        }
      });
    await fs.writeFile(mboxPath, updated.join('\n') + '\n', 'utf8');
  } catch {
    // File might not exist yet
  }
}

export async function clearMailbox(projectPath: string, agent: AgentType): Promise<void> {
  try {
    await fs.writeFile(mailboxPath(projectPath, agent), '', 'utf8');
  } catch {
    // OK if file doesn't exist
  }
}

// --- Conductor Sync Helpers ---
// Called from conductor-service to keep the blackboard in sync with plan execution.

export interface ConductorTaskRef {
  taskId: string;       // ConductorTask.id
  title: string;
  description: string;
  agent: AgentType;
  stationId: string;
  stationName: string;
  estimatedMinutes?: number;
  dependencies: string[];  // blackboard task IDs for deps within same plan
}

/**
 * Write all tasks from a conductor plan onto the blackboard.
 * Returns a map from conductorTaskId → blackboard taskId so the
 * caller can resolve cross-task dependencies.
 */
export async function syncPlanToBlackboard(
  projectPath: string,
  tasks: ConductorTaskRef[],
  priority: BlackboardPriority = 'high',
): Promise<Map<string, string>> {
  const idMap = new Map<string, string>(); // conductorId → blackboardId

  // We create tasks in order so dependency IDs can be resolved
  for (const ref of tasks) {
    const resolvedDeps = ref.dependencies
      .map((depId) => idMap.get(depId))
      .filter((id): id is string => id !== undefined);

    const created = await createTask(projectPath, {
      title: ref.title,
      description: ref.description,
      status: 'pending',
      priority,
      dependencies: resolvedDeps,
      claimedBy: undefined,
      conductorStation: ref.stationId,
      estimatedMinutes: ref.estimatedMinutes,
    });

    idMap.set(ref.taskId, created.id);
  }

  return idMap;
}

// Re-export types needed by callers
export type { BlackboardTask, BlackboardTaskStatus, BlackboardPriority, BlackboardArtifact, AgentMessage, AgentMessageType };
