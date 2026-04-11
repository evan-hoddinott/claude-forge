/**
 * Ghost Test Service
 *
 * Silently runs project code in the background after agent sessions.
 * If tests fail, attempts auto-fix by invoking the agent non-interactively.
 * Users only ever see working code.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import type { FSWatcher } from 'chokidar';
import type { GhostTestResult, GhostTestSettings, AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import * as store from '../store';

// ---------------------------------------------------------------------------
// Command detection
// ---------------------------------------------------------------------------

/**
 * Auto-detect the best test/build command to run for a project.
 * Returns empty string if nothing can be detected.
 */
export async function detectTestCommand(projectPath: string): Promise<string> {
  // 1. package.json — prefer test, then build
  try {
    const raw = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    if (pkg.scripts?.test && !/^\s*echo|no test/i.test(pkg.scripts.test)) {
      return 'npm test';
    }
    if (pkg.scripts?.build) return 'npm run build';
    if (pkg.scripts?.start) return 'npm run build 2>/dev/null || npm install';
    // Has a package.json at all → try install + build
    return 'npm install --silent 2>/dev/null && npm run build 2>/dev/null; exit 0';
  } catch {
    // not a node project
  }

  // 2. Cargo.toml → Rust
  try {
    await fs.access(path.join(projectPath, 'Cargo.toml'));
    return 'cargo check 2>&1';
  } catch { /* not found */ }

  // 3. go.mod → Go
  try {
    await fs.access(path.join(projectPath, 'go.mod'));
    return 'go build ./... 2>&1';
  } catch { /* not found */ }

  // 4. Python: look for if __name__ == "__main__"
  try {
    const entries = await fs.readdir(projectPath);
    for (const entry of entries) {
      if (!entry.endsWith('.py')) continue;
      const content = await fs.readFile(path.join(projectPath, entry), 'utf-8');
      if (content.includes('if __name__')) {
        return `python3 -c "import ast, sys; ast.parse(open(${JSON.stringify(entry)}).read()); print('Syntax OK')"`;
      }
    }
    // Any .py file at all → syntax check
    const pyFiles = entries.filter((e) => e.endsWith('.py'));
    if (pyFiles.length > 0) {
      return 'python3 -m py_compile *.py && echo "Syntax OK"';
    }
  } catch { /* not found */ }

  // 5. Makefile with test or build target
  try {
    const makefile = await fs.readFile(path.join(projectPath, 'Makefile'), 'utf-8');
    if (/^test:/m.test(makefile)) return 'make test';
    if (/^build:/m.test(makefile)) return 'make build';
  } catch { /* not found */ }

  return '';
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

/**
 * Run a single ghost test. Spawns the command as a background child process,
 * captures output, and enforces a hard timeout.
 */
export function runGhostTest(
  projectPath: string,
  command: string,
  timeoutMs: number,
  onProgress?: (msg: string) => void,
): Promise<GhostTestResult> {
  return new Promise((resolve) => {
    const id = uuidv4();
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;

    onProgress?.(`Running: ${command}`);

    const child = spawn('bash', ['-l', '-c', command], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        // Suppress colour codes and interactive prompts
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        CI: 'true',
        DEBIAN_FRONTEND: 'noninteractive',
      },
    });

    const MAX_OUTPUT = 8000;

    const hardKill = setTimeout(() => {
      timedOut = true;
      onProgress?.('Ghost test timed out');
      child.kill('SIGTERM');
      setTimeout(() => {
        if (!settled) child.kill('SIGKILL');
      }, 2000);
    }, timeoutMs);

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
      if (stdout.length > MAX_OUTPUT) stdout = '...(truncated)\n' + stdout.slice(-MAX_OUTPUT);
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
      if (stderr.length > MAX_OUTPUT) stderr = '...(truncated)\n' + stderr.slice(-MAX_OUTPUT);
    });

    function finish(code: number | null) {
      settled = true;
      clearTimeout(hardKill);
      const duration = Date.now() - startTime;
      const status: GhostTestResult['status'] = timedOut
        ? 'timeout'
        : code === 0
          ? 'passed'
          : 'failed';
      resolve({
        id,
        timestamp: new Date().toISOString(),
        command,
        exitCode: timedOut ? -1 : (code ?? -1),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration,
        status,
        fixAttempts: 0,
      });
    }

    child.on('close', finish);
    child.on('error', (err) => {
      settled = true;
      clearTimeout(hardKill);
      resolve({
        id,
        timestamp: new Date().toISOString(),
        command,
        exitCode: -1,
        stdout: '',
        stderr: err.message,
        duration: Date.now() - startTime,
        status: 'failed',
        fixAttempts: 0,
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Auto-fix
// ---------------------------------------------------------------------------

/**
 * Invoke the agent CLI non-interactively to fix an error.
 * Only Claude Code and Gemini CLI support the -p flag for non-interactive prompts.
 * Returns true if the agent exited cleanly (not necessarily that it fixed anything).
 */
async function attemptAutoFix(
  projectPath: string,
  errorOutput: string,
  agentType: AgentType,
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  const config = AGENTS[agentType];

  // Only agents that support -p / non-interactive mode
  if (!['claude', 'gemini'].includes(agentType)) return false;

  const truncated = (errorOutput || '').slice(0, 800).trim();
  if (!truncated) return false;

  // Escape single-quotes for shell embedding
  const safeError = truncated.replace(/'/g, "'\\''");
  const prompt = `Fix this error in the project without asking questions. Here is the error output:\n\n${safeError}`;
  const safePrompt = prompt.replace(/'/g, "'\\''");
  const fixCmd = `${config.command} -p '${safePrompt}'`;

  onProgress?.(`Sending error to ${config.displayName} for auto-fix…`);

  return new Promise((resolve) => {
    let settled = false;

    const child = spawn('bash', ['-l', '-c', fixCmd], {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', CI: 'true' },
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        resolve(false);
      }
    }, 90_000); // 90s max for auto-fix

    child.on('close', (code) => {
      settled = true;
      clearTimeout(timer);
      resolve(code === 0);
    });

    child.on('error', () => {
      settled = true;
      clearTimeout(timer);
      resolve(false);
    });
  });
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run a ghost test with automatic retry + AI-assisted fix loop.
 * Persists every result to the store.
 */
export async function runGhostTestWithRetry(
  projectId: string,
  projectPath: string,
  command: string,
  settings: GhostTestSettings,
  agentType: AgentType,
  onProgress?: (msg: string) => void,
): Promise<GhostTestResult> {
  const timeoutMs = settings.timeoutSeconds * 1000;

  let result = await runGhostTest(projectPath, command, timeoutMs, onProgress);

  // No point retrying on timeout
  if (result.status !== 'failed') {
    store.saveGhostTestResult(projectId, result);
    return result;
  }

  let fixAttempts = 0;
  const maxRetries = settings.useDocker ? 0 : settings.maxRetries; // skip auto-fix in docker mode

  while (result.status === 'failed' && fixAttempts < maxRetries) {
    fixAttempts++;
    onProgress?.(`Auto-fix attempt ${fixAttempts}/${maxRetries}…`);

    const errorText = (result.stderr || result.stdout || '').trim();
    const fixed = await attemptAutoFix(projectPath, errorText, agentType, onProgress);

    if (!fixed) {
      onProgress?.('Auto-fix attempt returned an error');
      break;
    }

    // Brief pause for file writes to complete
    await new Promise<void>((r) => setTimeout(r, 1500));

    onProgress?.('Re-running test after fix…');
    const retryResult = await runGhostTest(projectPath, command, timeoutMs, onProgress);
    retryResult.fixAttempts = fixAttempts;

    if (retryResult.status === 'passed') {
      retryResult.status = 'auto-fixed';
      retryResult.fixDescription = `Auto-fixed after ${fixAttempts} attempt${fixAttempts > 1 ? 's' : ''}`;
      store.saveGhostTestResult(projectId, retryResult);
      return retryResult;
    }

    result = retryResult;
  }

  result.fixAttempts = fixAttempts;
  store.saveGhostTestResult(projectId, result);
  return result;
}

// ---------------------------------------------------------------------------
// Auto-trigger (file-change-based, fires after agent session ends)
// ---------------------------------------------------------------------------

interface AutoTriggerState {
  watcher: FSWatcher;
  debounceTimer: ReturnType<typeof setTimeout> | null;
  maxTimer: ReturnType<typeof setTimeout>;
  changed: boolean;
}

const autoTriggers = new Map<string, AutoTriggerState>();

/**
 * Start watching a project directory for file changes.
 * After DEBOUNCE_MS of inactivity (following at least one change),
 * automatically runs a ghost test and calls onResult with the outcome.
 *
 * Stops itself after MAX_WATCH_MS regardless (prevents indefinite watching).
 */
export async function startAutoTrigger(
  projectId: string,
  projectPath: string,
  agentType: AgentType,
  settings: GhostTestSettings,
  onResult: (result: GhostTestResult) => void,
  onProgress: (msg: string) => void,
): Promise<void> {
  if (!settings.enabled) return;

  // Cancel any existing trigger for this project first
  stopAutoTrigger(projectId);

  const DEBOUNCE_MS = 30_000; // 30s of no changes → test
  const MAX_WATCH_MS = 15 * 60 * 1000; // 15 min max watch window

  const chokidar = await import('chokidar');
  const watcher = chokidar.watch(projectPath, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/.next/**',
      '**/.vite/**',
      '**/__pycache__/**',
      '**/.claude/**', // agent history/session files
      '**/.cache/**',
      '**/coverage/**',
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 4,
    followSymlinks: false,
    usePolling: false,
  });

  const state: AutoTriggerState = {
    watcher,
    debounceTimer: null,
    maxTimer: setTimeout(() => {
      // Max watch time reached — clean up without running test
      stopAutoTrigger(projectId);
    }, MAX_WATCH_MS),
    changed: false,
  };

  autoTriggers.set(projectId, state);

  async function triggerTest() {
    // Avoid double-triggering
    if (!autoTriggers.has(projectId)) return;
    stopAutoTrigger(projectId);

    let command = settings.customCommand.trim();
    if (!command) {
      try {
        command = await detectTestCommand(projectPath);
      } catch {
        return; // can't detect command
      }
    }
    if (!command) return;

    onProgress('Auto-running ghost test…');
    try {
      const result = await runGhostTestWithRetry(
        projectId,
        projectPath,
        command,
        settings,
        agentType,
        onProgress,
      );
      onResult(result);
    } catch {
      // Silently ignore auto-trigger errors
    }
  }

  function onFileChange() {
    state.changed = true;
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      if (state.changed) {
        triggerTest().catch(() => {/* ignore */});
      }
    }, DEBOUNCE_MS);
  }

  watcher.on('add', onFileChange);
  watcher.on('change', onFileChange);
  watcher.on('unlink', onFileChange);
  watcher.on('addDir', onFileChange);
  watcher.on('unlinkDir', onFileChange);
}

/**
 * Stop any pending auto-trigger for a project (cancels watcher and timers).
 */
export function stopAutoTrigger(projectId: string): void {
  const state = autoTriggers.get(projectId);
  if (!state) return;
  autoTriggers.delete(projectId);
  if (state.debounceTimer) clearTimeout(state.debounceTimer);
  clearTimeout(state.maxTimer);
  state.watcher.close().catch(() => {/* ignore */});
}
