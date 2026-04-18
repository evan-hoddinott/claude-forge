import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { v4 as uuidv4 } from 'uuid';
import type { TimeMachineSnapshot, SnapshotTrigger, SnapshotColor, AgentType } from '../../shared/types';
import { runExecFile } from '../utils/run-command';
import * as store from '../store';

const TAG_PREFIX = 'caboo-snapshot-';

function triggerToColor(trigger: SnapshotTrigger): SnapshotColor {
  switch (trigger) {
    case 'agent-end':    return 'green';
    case 'agent-start':  return 'blue';
    case 'manual':       return 'blue';
    case 'conductor':    return 'amber';
    case 'auto':         return 'amber';
    default:             return 'blue';
  }
}

async function gitExec(projectPath: string, args: string[]): Promise<string> {
  const result = await runExecFile('git', args, { cwd: projectPath, timeout: 30000 });
  return result.stdout;
}

export async function createSnapshot(opts: {
  projectId: string;
  projectPath: string;
  label: string;
  trigger: SnapshotTrigger;
  agentType?: AgentType;
}): Promise<TimeMachineSnapshot> {
  const { projectId, projectPath, label, trigger, agentType } = opts;

  const id = uuidv4();
  const ts = Date.now();
  const gitTag = `${TAG_PREFIX}${ts}-${id.slice(0, 8)}`;

  // Stage all changes and create a commit if there are any pending
  try {
    const status = await gitExec(projectPath, ['status', '--porcelain']);
    if (status.trim()) {
      await gitExec(projectPath, ['add', '-A']);
      await gitExec(projectPath, ['commit', '-m', `[caboo snapshot] ${label}`, '--allow-empty']);
    }
  } catch {
    // If git operations fail (no git repo), just store the snapshot without a tag
  }

  // Get changed files for display
  let filesChanged: string[] = [];
  try {
    const diff = await gitExec(projectPath, ['diff', '--name-only', 'HEAD~1', 'HEAD']);
    filesChanged = diff.split('\n').filter(Boolean);
  } catch {
    // HEAD~1 might not exist (first commit)
  }

  // Create the tag
  try {
    await gitExec(projectPath, ['tag', '-a', gitTag, '-m', label]);
  } catch {
    // tag creation may fail if no commits
  }

  const snapshot: TimeMachineSnapshot = {
    id,
    projectId,
    gitTag,
    timestamp: new Date().toISOString(),
    label,
    trigger,
    agentType,
    filesChanged,
    color: triggerToColor(trigger),
  };

  store.addTimeMachineSnapshot(projectId, snapshot);

  // Clean up old snapshots beyond 50 limit
  const oldTags = store.removeOldSnapshots(projectId, 50);
  for (const tag of oldTags) {
    try {
      await gitExec(projectPath, ['tag', '-d', tag]);
    } catch {
      // ignore cleanup failures
    }
  }

  return snapshot;
}

export function getSnapshots(projectId: string): TimeMachineSnapshot[] {
  return store.getTimeMachineSnapshots(projectId);
}

export async function revertToSnapshot(opts: {
  projectId: string;
  projectPath: string;
  snapshotId: string;
}): Promise<{ label: string; filesChanged: string[] }> {
  const { projectId, projectPath, snapshotId } = opts;

  const snapshots = store.getTimeMachineSnapshots(projectId);
  const snapshot = snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) throw new Error('Snapshot not found');

  // Hard reset to the snapshot tag
  await gitExec(projectPath, ['reset', '--hard', snapshot.gitTag]);

  // Append revert notice to context files
  await appendRevertNotice(projectPath, snapshot);

  return { label: snapshot.label, filesChanged: snapshot.filesChanged ?? [] };
}

export async function previewSnapshot(opts: {
  projectPath: string;
  projectId: string;
  snapshotId: string;
}): Promise<{ filesChanged: string[]; diff: string }> {
  const { projectPath, projectId, snapshotId } = opts;

  const snapshots = store.getTimeMachineSnapshots(projectId);
  const snapshot = snapshots.find((s) => s.id === snapshotId);
  if (!snapshot) throw new Error('Snapshot not found');

  let diff = '';
  let filesChanged: string[] = snapshot.filesChanged ?? [];

  try {
    diff = await gitExec(projectPath, ['diff', snapshot.gitTag, 'HEAD', '--stat']);
    const nameOnly = await gitExec(projectPath, ['diff', '--name-only', snapshot.gitTag, 'HEAD']);
    filesChanged = nameOnly.split('\n').filter(Boolean);
  } catch {
    // git diff may fail
  }

  return { filesChanged, diff };
}

export async function backToPresent(opts: {
  projectPath: string;
}): Promise<void> {
  const { projectPath } = opts;
  // Go back to the current branch HEAD (undo time travel)
  try {
    await gitExec(projectPath, ['checkout', '-']);
  } catch {
    try {
      await gitExec(projectPath, ['checkout', 'main']);
    } catch {
      await gitExec(projectPath, ['checkout', 'master']);
    }
  }
}

async function appendRevertNotice(projectPath: string, snapshot: TimeMachineSnapshot): Promise<void> {
  const contextFiles = ['CLAUDE.md', 'GEMINI.md', 'codex.md'];
  const notice = `\n## ⚠️ Time Machine Revert\n\nReverted to: "${snapshot.label}" (${snapshot.timestamp})\n\nThe following changes were reverted:\n${(snapshot.filesChanged ?? []).map((f) => `- ${f}`).join('\n') || '- (see git history)'}\n\nDo NOT repeat this approach. Try a different strategy.\n`;

  for (const file of contextFiles) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
      await fs.appendFile(filePath, notice, 'utf-8');
    } catch {
      // File doesn't exist — skip
    }
  }
}
