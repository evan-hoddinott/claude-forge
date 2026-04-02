/**
 * Cross-platform command runner that handles:
 * A) Native Windows with WSL → runs commands inside WSL via wsl.exe
 * B) Inside WSL / Native Linux / macOS → runs commands directly with bash -l -c
 * C) Native Windows without WSL → runs directly via cmd.exe (limited)
 */
import { execFile, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, readFileSync } from 'node:fs';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Platform detection (cached)
// ---------------------------------------------------------------------------

let _isWSL: boolean | null = null;
let _wslAvailableOnWindows: boolean | null = null;

function isWSL(): boolean {
  if (_isWSL === null) {
    if (process.platform !== 'linux') {
      _isWSL = false;
    } else if (process.env.WSL_DISTRO_NAME || process.env.WSLENV !== undefined) {
      _isWSL = true;
    } else {
      try {
        _isWSL = existsSync('/proc/version') &&
          /microsoft|wsl/i.test(readFileSync('/proc/version', 'utf-8'));
      } catch {
        _isWSL = false;
      }
    }
  }
  return _isWSL;
}

async function hasWSLOnWindows(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  if (_wslAvailableOnWindows !== null) return _wslAvailableOnWindows;

  try {
    await execFileAsync('wsl.exe', ['--status'], { timeout: 5000 });
    _wslAvailableOnWindows = true;
  } catch {
    try {
      await execFileAsync('where.exe', ['wsl.exe'], { timeout: 3000 });
      _wslAvailableOnWindows = true;
    } catch {
      _wslAvailableOnWindows = false;
    }
  }
  return _wslAvailableOnWindows;
}

export type PlatformMode = 'wsl' | 'native-linux' | 'native-windows-wsl' | 'native-windows';

let _platformMode: PlatformMode | null = null;

export async function getPlatformMode(): Promise<PlatformMode> {
  if (_platformMode) return _platformMode;

  if (process.platform === 'win32') {
    const wsl = await hasWSLOnWindows();
    _platformMode = wsl ? 'native-windows-wsl' : 'native-windows';
  } else if (isWSL()) {
    _platformMode = 'wsl';
  } else {
    _platformMode = 'native-linux';
  }
  return _platformMode;
}

// ---------------------------------------------------------------------------
// runCommand — execute a shell command string cross-platform
// ---------------------------------------------------------------------------

/**
 * Convert a Windows path to a WSL path for use inside WSL commands.
 * \\wsl.localhost\Ubuntu\home\user → /home/user
 * C:\Users\foo → /mnt/c/Users/foo
 */
function windowsToWslPath(winPath: string): string {
  // UNC WSL path
  const uncMatch = winPath.match(/^\\\\wsl\.localhost\\[^\\]+\\(.+)$/i);
  if (uncMatch) return '/' + uncMatch[1].replace(/\\/g, '/');
  // Drive letter path
  const driveMatch = winPath.match(/^([A-Za-z]):\\(.*)$/);
  if (driveMatch) return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2].replace(/\\/g, '/')}`;
  return winPath;
}

/**
 * Runs a shell command and returns stdout. On native Windows with WSL,
 * the command is routed through `wsl.exe -e bash -l -c ...` so that
 * tools installed inside WSL (claude, gemini, codex, git, gh, node, npm)
 * are found on the PATH.
 */
export async function runCommand(
  command: string,
  opts?: { timeout?: number; cwd?: string },
): Promise<string> {
  const timeout = opts?.timeout ?? 15000;
  const mode = await getPlatformMode();

  if (mode === 'native-windows-wsl') {
    // Prepend cd if cwd provided, converting Windows path to WSL path
    let fullCmd = command;
    if (opts?.cwd) {
      const wslCwd = windowsToWslPath(opts.cwd);
      fullCmd = `cd '${wslCwd}' && ${command}`;
    }
    const args = ['-e', 'bash', '-l', '-c', fullCmd];
    const { stdout } = await execFileAsync('wsl.exe', args, { timeout });
    return stdout.replace(/\0/g, '').trim();
  }

  if (mode === 'native-windows') {
    // No WSL — run directly on Windows (might fail for Linux-only tools)
    const { stdout } = await execFileAsync('cmd.exe', ['/c', command], {
      timeout,
      cwd: opts?.cwd,
    });
    return stdout.trim();
  }

  // WSL / native Linux / macOS — run directly with login shell
  const { stdout } = await execFileAsync('bash', ['-l', '-c', command], {
    timeout,
    cwd: opts?.cwd,
  });
  return stdout.trim();
}

// ---------------------------------------------------------------------------
// runExecFile — like execFileAsync but routed through WSL when needed
// ---------------------------------------------------------------------------

/**
 * Runs a command with arguments, routing through WSL on native Windows.
 * For checking tool versions, auth status, etc.
 */
export async function runExecFile(
  command: string,
  args: string[],
  opts?: { timeout?: number; cwd?: string; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  const timeout = opts?.timeout ?? 15000;
  const mode = await getPlatformMode();

  if (mode === 'native-windows-wsl') {
    // Build the full command string and run it inside WSL
    let fullCmd = [command, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    if (opts?.cwd) {
      const wslCwd = windowsToWslPath(opts.cwd);
      fullCmd = `cd '${wslCwd}' && ${fullCmd}`;
    }
    const wslArgs = ['-e', 'bash', '-l', '-c', fullCmd];
    const result = await execFileAsync('wsl.exe', wslArgs, { timeout, maxBuffer: opts?.maxBuffer });
    return {
      stdout: result.stdout.replace(/\0/g, '').trim(),
      stderr: result.stderr.replace(/\0/g, '').trim(),
    };
  }

  if (mode === 'native-windows') {
    return execFileAsync(command, args, { timeout, cwd: opts?.cwd, maxBuffer: opts?.maxBuffer });
  }

  // WSL / native Linux / macOS
  // Use bash -l -c to ensure login shell PATH (finds nvm, ~/.local/bin, etc.)
  const fullCmd = [command, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
  const result = await execFileAsync('bash', ['-l', '-c', fullCmd], {
    timeout,
    cwd: opts?.cwd,
    maxBuffer: opts?.maxBuffer,
  });
  return { stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

// ---------------------------------------------------------------------------
// spawnCommand — spawn a process routed through WSL when needed
// ---------------------------------------------------------------------------

/**
 * Spawns a command, routing through WSL on native Windows.
 * Returns the ChildProcess for streaming output.
 */
export function spawnCommand(
  command: string,
  args: string[],
  opts?: { env?: NodeJS.ProcessEnv; detached?: boolean; stdio?: 'ignore' | 'pipe' },
): ChildProcess {
  // Synchronous check — use cached platform mode
  const mode = _platformMode;

  if (mode === 'native-windows-wsl') {
    const fullCmd = [command, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
    return spawn('wsl.exe', ['-e', 'bash', '-l', '-c', fullCmd], {
      env: opts?.env,
      detached: opts?.detached,
      stdio: opts?.stdio === 'ignore' ? 'ignore' : 'pipe',
    });
  }

  if (mode === 'native-windows') {
    return spawn(command, args, {
      env: opts?.env,
      detached: opts?.detached,
      stdio: opts?.stdio === 'ignore' ? 'ignore' : 'pipe',
    });
  }

  // WSL / native Linux / macOS — use login shell
  const fullCmd = [command, ...args].map(a => `'${a.replace(/'/g, "'\\''")}'`).join(' ');
  return spawn('bash', ['-l', '-c', fullCmd], {
    env: opts?.env,
    detached: opts?.detached,
    stdio: opts?.stdio === 'ignore' ? 'ignore' : 'pipe',
  });
}

// ---------------------------------------------------------------------------
// findTerminalEmulator — find available terminal on native Linux
// ---------------------------------------------------------------------------

const TERMINAL_EMULATORS = [
  'x-terminal-emulator',
  'gnome-terminal',
  'konsole',
  'xfce4-terminal',
  'alacritty',
  'kitty',
  'xterm',
];

/**
 * Returns the first available terminal emulator on native Linux.
 * Falls back to 'xterm' if none found.
 */
export async function findTerminalEmulator(): Promise<string> {
  for (const term of TERMINAL_EMULATORS) {
    try {
      await runCommand(`which ${term}`, { timeout: 2000 });
      return term;
    } catch {
      continue;
    }
  }
  return 'xterm';
}

// ---------------------------------------------------------------------------
// detectPackageManager — for install commands on Linux
// ---------------------------------------------------------------------------

export type PackageManager = 'apt' | 'dnf' | 'pacman' | 'unknown';

export async function detectPackageManager(): Promise<PackageManager> {
  try {
    await runCommand('command -v apt', { timeout: 3000 });
    return 'apt';
  } catch { /* not apt */ }
  try {
    await runCommand('command -v dnf', { timeout: 3000 });
    return 'dnf';
  } catch { /* not dnf */ }
  try {
    await runCommand('command -v pacman', { timeout: 3000 });
    return 'pacman';
  } catch { /* not pacman */ }
  return 'unknown';
}

export function getInstallCommand(pkg: string, pm: PackageManager): string {
  switch (pm) {
    case 'apt': return `sudo apt install -y ${pkg}`;
    case 'dnf': return `sudo dnf install -y ${pkg}`;
    case 'pacman': return `sudo pacman -S --noconfirm ${pkg}`;
    default: return `# Install ${pkg} using your package manager`;
  }
}

// Ensure platform mode is initialized early
export async function init(): Promise<void> {
  await getPlatformMode();
}
