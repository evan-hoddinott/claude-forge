/**
 * Agent Battle Service
 * Runs two AI agents simultaneously on copies of the project and compares results.
 */

import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { AgentType, BattleRecord, BattleSideResult, GhostTestStatus } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { runCommand } from '../utils/run-command';
import * as ghostTestService from './ghost-test-service';

const BATTLE_BASE_DIR = path.join(os.tmpdir(), 'caboo-battle');

// --- Progress types ---

export interface BattleSideProgress {
  status: 'waiting' | 'running' | 'done' | 'error';
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  runtimeMs: number;
  log: string[];
  ghostTestStatus?: GhostTestStatus;
  error?: string;
}

export interface BattleProgressEvent {
  battleId: string;
  side: 0 | 1;
  type: 'status' | 'log' | 'done' | 'error' | 'ghost-test';
  progress?: BattleSideProgress;
  message?: string;
}

// --- Active battle state ---

interface ActiveBattle {
  id: string;
  projectId: string;
  task: string;
  agents: [AgentType, AgentType];
  tempBase: string;
  tempDirs: [string, string];
  startTime: number;
  processes: [ChildProcess | null, ChildProcess | null];
  progress: [BattleSideProgress, BattleSideProgress];
  pollInterval: ReturnType<typeof setInterval> | null;
}

let activeBattle: ActiveBattle | null = null;

type ProgressCallback = (event: BattleProgressEvent) => void;
const progressCallbacks = new Set<ProgressCallback>();

export function onProgress(cb: ProgressCallback): void {
  progressCallbacks.add(cb);
}

export function offProgress(cb?: ProgressCallback): void {
  if (cb) {
    progressCallbacks.delete(cb);
  } else {
    progressCallbacks.clear();
  }
}

function emit(event: BattleProgressEvent): void {
  progressCallbacks.forEach((cb) => cb(event));
}

// --- Public API ---

export function isActive(): boolean {
  return activeBattle !== null;
}

export function getActiveBattleId(): string | null {
  return activeBattle?.id ?? null;
}

export function getProgress(): {
  id: string;
  agents: [AgentType, AgentType];
  progress: [BattleSideProgress, BattleSideProgress];
} | null {
  if (!activeBattle) return null;
  return {
    id: activeBattle.id,
    agents: activeBattle.agents,
    progress: [cloneProgress(activeBattle.progress[0]), cloneProgress(activeBattle.progress[1])],
  };
}

function cloneProgress(p: BattleSideProgress): BattleSideProgress {
  return { ...p, log: [...p.log] };
}

export async function startBattle(
  projectId: string,
  projectPath: string,
  task: string,
  agents: [AgentType, AgentType],
  ghostTestSettings?: { enabled: boolean; customCommand: string; timeoutSeconds: number },
): Promise<string> {
  if (activeBattle) throw new Error('A battle is already in progress. Cancel it first.');

  const battleId = uuidv4();
  const tempBase = path.join(BATTLE_BASE_DIR, battleId);
  const tempDirs: [string, string] = [
    path.join(tempBase, 'challenger-1'),
    path.join(tempBase, 'challenger-2'),
  ];

  // Create temp directories
  await fs.mkdir(tempDirs[0], { recursive: true });
  await fs.mkdir(tempDirs[1], { recursive: true });

  // Copy project to both temp dirs (no node_modules/.git to keep it fast)
  await Promise.all([
    copyProject(projectPath, tempDirs[0]),
    copyProject(projectPath, tempDirs[1]),
  ]);

  // Init git in both for diff tracking
  await Promise.all([
    initGitBaseline(tempDirs[0]),
    initGitBaseline(tempDirs[1]),
  ]);

  const makeProgress = (): BattleSideProgress => ({
    status: 'waiting',
    filesModified: 0,
    linesAdded: 0,
    linesRemoved: 0,
    runtimeMs: 0,
    log: [],
  });

  activeBattle = {
    id: battleId,
    projectId,
    task,
    agents,
    tempBase,
    tempDirs,
    startTime: Date.now(),
    processes: [null, null],
    progress: [makeProgress(), makeProgress()],
    pollInterval: null,
  };

  // Start polling for file changes every 5 seconds
  activeBattle.pollInterval = setInterval(() => {
    void pollFileChanges();
  }, 5000);

  // Launch both agents simultaneously
  void runBattleSide(0, task, ghostTestSettings);
  void runBattleSide(1, task, ghostTestSettings);

  return battleId;
}

export async function cancelBattle(): Promise<void> {
  if (!activeBattle) return;
  const battle = activeBattle;

  // Kill processes
  for (const proc of battle.processes) {
    if (proc && !proc.killed) {
      try { proc.kill('SIGTERM'); } catch { /* ignore */ }
    }
  }

  if (battle.pollInterval) clearInterval(battle.pollInterval);
  activeBattle = null;

  await cleanupDir(battle.tempBase);
}

export async function applyWinner(
  side: 0 | 1,
  projectPath: string,
): Promise<void> {
  if (!activeBattle) throw new Error('No active battle');

  const winnerDir = activeBattle.tempDirs[side];

  // Copy winner files back to the real project (exclude git/node_modules)
  await fs.cp(winnerDir, projectPath, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return base !== 'node_modules' && base !== '.git' && !base.startsWith('.git');
    },
  });
}

export async function finalizeBattle(
  side: 0 | 1,
  projectPath: string,
): Promise<BattleRecord> {
  if (!activeBattle) throw new Error('No active battle');
  const battle = activeBattle;

  if (battle.pollInterval) clearInterval(battle.pollInterval);

  await applyWinner(side, projectPath);

  const record: BattleRecord = {
    id: battle.id,
    projectId: battle.projectId,
    task: battle.task,
    timestamp: new Date().toISOString(),
    agents: battle.agents,
    sides: [
      progressToResult(battle.progress[0], battle.agents[0], side === 0),
      progressToResult(battle.progress[1], battle.agents[1], side === 1),
    ],
    winnerSide: side,
  };

  activeBattle = null;
  await cleanupDir(battle.tempBase);

  return record;
}

export async function discardBattle(): Promise<void> {
  if (!activeBattle) return;
  const battle = activeBattle;
  if (battle.pollInterval) clearInterval(battle.pollInterval);
  activeBattle = null;
  await cleanupDir(battle.tempBase);
}

export async function getDiff(side: 0 | 1): Promise<string> {
  if (!activeBattle) throw new Error('No active battle');
  const workDir = activeBattle.tempDirs[side];
  try {
    return await runCommand('git diff HEAD', { cwd: workDir, timeout: 15000 });
  } catch {
    return '';
  }
}

// --- Internal helpers ---

async function copyProject(src: string, dest: string): Promise<void> {
  await fs.cp(src, dest, {
    recursive: true,
    filter: (name) => {
      const base = path.basename(name);
      return base !== 'node_modules' && base !== '.git';
    },
  });
}

async function initGitBaseline(dir: string): Promise<void> {
  try {
    await runCommand(
      `git init && git add -A && git -c user.email="battle@caboo" -c user.name="Battle" commit -m "battle-start" --allow-empty`,
      { cwd: dir, timeout: 30000 },
    );
  } catch {
    // If git isn't available, diff stats won't work — that's OK
  }
}

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

async function resolveAgentBinary(agentType: AgentType): Promise<string> {
  const config = AGENTS[agentType];
  if (config.launchCommand) return config.launchCommand;
  try {
    return await runCommand(`which ${config.command}`, { timeout: 5000 });
  } catch {
    try {
      const npmGlobalBin = `${process.env.HOME ?? '~'}/.npm-global/bin/${config.command}`;
      await runCommand(`test -x "${npmGlobalBin}"`, { timeout: 2000 });
      return npmGlobalBin;
    } catch {
      return config.command;
    }
  }
}

function buildAgentArgs(agentType: AgentType, task: string): string {
  if (agentType === 'codex') {
    return shellEscape(task);
  }
  if (agentType === 'copilot') {
    return `suggest '${shellEscape(task)}'`;
  }
  return `-p '${shellEscape(task)}'`;
}

async function runBattleSide(
  side: 0 | 1,
  task: string,
  ghostTestSettings?: { enabled: boolean; customCommand: string; timeoutSeconds: number },
): Promise<void> {
  if (!activeBattle) return;
  const battle = activeBattle;

  const agentType = battle.agents[side];
  const workDir = battle.tempDirs[side];
  const progress = battle.progress[side];
  const battleId = battle.id;

  progress.status = 'running';
  emit({ battleId, side, type: 'status', progress: cloneProgress(progress) });

  const startTime = Date.now();

  try {
    const agentBin = await resolveAgentBinary(agentType);
    const agentArgs = buildAgentArgs(agentType, task);
    const escapedDir = shellEscape(workDir);

    // Run agent via login shell so PATH includes npm globals, nvm, etc.
    const shellCmd = `cd '${escapedDir}' && ${agentBin} ${agentArgs}`;

    const child = spawn('bash', ['-l', '-c', shellCmd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    battle.processes[side] = child;

    const appendLog = (line: string) => {
      progress.log.push(line.trim());
      if (progress.log.length > 200) progress.log.shift();
      emit({ battleId, side, type: 'log', message: line.trim(), progress: cloneProgress(progress) });
    };

    child.stdout?.on('data', (data: Buffer) => appendLog(data.toString()));
    child.stderr?.on('data', (data: Buffer) => appendLog(data.toString()));

    await new Promise<void>((resolve) => {
      child.on('exit', (code) => {
        progress.runtimeMs = Date.now() - startTime;
        if (code !== 0 && code !== null) {
          progress.status = 'error';
          progress.error = `Agent exited with code ${code}`;
        } else {
          progress.status = 'done';
        }
        resolve();
      });
      child.on('error', (err) => {
        progress.runtimeMs = Date.now() - startTime;
        progress.status = 'error';
        progress.error = err.message;
        resolve();
      });
    });

    // Compute diff stats
    const stats = await computeDiffStats(workDir);
    progress.filesModified = stats.filesModified;
    progress.linesAdded = stats.linesAdded;
    progress.linesRemoved = stats.linesRemoved;

    const finalStatus = progress.status as BattleSideProgress['status'];
    emit({ battleId, side, type: finalStatus === 'error' ? 'error' : 'done', progress: cloneProgress(progress) });

    // Run ghost tests if enabled
    if (ghostTestSettings?.enabled && finalStatus === 'done') {
      await runGhostTestForSide(side, workDir, ghostTestSettings);
    }
  } catch (err) {
    progress.runtimeMs = Date.now() - startTime;
    progress.status = 'error';
    progress.error = err instanceof Error ? err.message : String(err);
    emit({ battleId, side, type: 'error', progress: cloneProgress(progress), message: progress.error });
  }
}

async function runGhostTestForSide(
  side: 0 | 1,
  workDir: string,
  settings: { customCommand: string; timeoutSeconds: number },
): Promise<void> {
  if (!activeBattle) return;
  const battle = activeBattle;
  const progress = battle.progress[side];

  try {
    // Detect or use custom command
    let command = settings.customCommand;
    if (!command) {
      command = await ghostTestService.detectTestCommand(workDir);
    }
    if (!command) return;

    const result = await ghostTestService.runGhostTest(
      workDir,
      command,
      settings.timeoutSeconds * 1000,
    );

    progress.ghostTestStatus = result.status;
    emit({ battleId: battle.id, side, type: 'ghost-test', progress: cloneProgress(progress) });
  } catch {
    // Ghost test errors are non-fatal
  }
}

async function pollFileChanges(): Promise<void> {
  if (!activeBattle) return;
  for (let side = 0; side <= 1; side++) {
    const s = side as 0 | 1;
    const progress = activeBattle.progress[s];
    if (progress.status !== 'running') continue;
    const stats = await computeDiffStats(activeBattle.tempDirs[s]);
    progress.filesModified = stats.filesModified;
    progress.linesAdded = stats.linesAdded;
    progress.linesRemoved = stats.linesRemoved;
    emit({ battleId: activeBattle.id, side: s, type: 'status', progress: cloneProgress(progress) });
  }
}

async function computeDiffStats(workDir: string): Promise<{
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
}> {
  try {
    const diff = await runCommand('git diff --stat HEAD', { cwd: workDir, timeout: 10000 });
    const lines = diff.trim().split('\n');
    const summary = lines[lines.length - 1] || '';

    const filesMatch = summary.match(/(\d+) file/);
    const addMatch = summary.match(/(\d+) insertion/);
    const delMatch = summary.match(/(\d+) deletion/);

    return {
      filesModified: filesMatch ? parseInt(filesMatch[1]) : 0,
      linesAdded: addMatch ? parseInt(addMatch[1]) : 0,
      linesRemoved: delMatch ? parseInt(delMatch[1]) : 0,
    };
  } catch {
    try {
      const status = await runCommand('git status --short', { cwd: workDir, timeout: 5000 });
      const files = status.split('\n').filter(Boolean).length;
      return { filesModified: files, linesAdded: 0, linesRemoved: 0 };
    } catch {
      return { filesModified: 0, linesAdded: 0, linesRemoved: 0 };
    }
  }
}

function progressToResult(p: BattleSideProgress, agentType: AgentType, winner: boolean): BattleSideResult {
  return {
    agentType,
    filesModified: p.filesModified,
    linesAdded: p.linesAdded,
    linesRemoved: p.linesRemoved,
    runtimeMs: p.runtimeMs,
    ghostTestStatus: p.ghostTestStatus,
    winner,
  };
}

async function cleanupDir(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// Cleanup on process exit
process.on('exit', () => {
  if (activeBattle) {
    const { tempBase, processes, pollInterval } = activeBattle;
    if (pollInterval) clearInterval(pollInterval);
    for (const proc of processes) {
      if (proc && !proc.killed) {
        try { proc.kill('SIGTERM'); } catch { /* ignore */ }
      }
    }
    try {
      fsSync.rmSync(tempBase, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
});
