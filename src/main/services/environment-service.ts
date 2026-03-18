import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

const execFileAsync = promisify(execFile);

export type Platform = 'wsl' | 'native-linux' | 'native-windows';

export interface EnvironmentInfo {
  platform: Platform;
  wslAvailable: boolean;
  wslDistro: string;
  wslHomePath: string;
  defaultProjectDir: string;
  windowsProjectDir: string;
  wslProjectDir: string;
}

let cachedEnv: EnvironmentInfo | null = null;

// ---------------------------------------------------------------------------
// Detection helpers
// ---------------------------------------------------------------------------

function isWSL(): boolean {
  if (process.platform !== 'linux') return false;
  // Check common WSL environment variables
  if (process.env.WSL_DISTRO_NAME) return true;
  if (process.env.WSLENV !== undefined) return true;
  // Check for WSL in /proc/version (synchronous fallback)
  try {
    const procVersion = readFileSync('/proc/version', 'utf-8');
    return /microsoft|wsl/i.test(procVersion);
  } catch {
    return false;
  }
}

async function checkWslAvailableOnWindows(): Promise<boolean> {
  if (process.platform !== 'win32') return false;
  try {
    await execFileAsync('wsl.exe', ['--status'], { timeout: 5000 });
    return true;
  } catch {
    // --status may fail but wsl.exe exists
    try {
      await execFileAsync('where.exe', ['wsl.exe'], { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

async function getWslDistro(): Promise<string> {
  // If running inside WSL, env var has it
  if (process.env.WSL_DISTRO_NAME) return process.env.WSL_DISTRO_NAME;

  // From native Windows, query wsl.exe
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync('wsl.exe', ['-l', '-q'], {
        timeout: 5000,
      });
      // Output may be UTF-16LE encoded; clean it up
      const lines = stdout
        .replace(/\0/g, '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      return lines[0] || 'Ubuntu';
    } catch {
      return 'Ubuntu';
    }
  }

  return '';
}

async function getWslHome(): Promise<string> {
  if (isWSL()) {
    return process.env.HOME || `/home/${process.env.USER || 'user'}`;
  }

  if (process.platform === 'win32') {
    try {
      const { stdout } = await execFileAsync(
        'wsl.exe',
        ['-e', 'bash', '-c', 'echo $HOME'],
        { timeout: 5000 },
      );
      return stdout.replace(/\0/g, '').trim() || '/home/user';
    } catch {
      return '/home/user';
    }
  }

  return '';
}

// ---------------------------------------------------------------------------
// Path conversion
// ---------------------------------------------------------------------------

export function wslToWindows(wslPath: string, distro: string): string {
  // /home/user/Projects → \\wsl.localhost\Ubuntu\home\user\Projects
  const cleaned = wslPath.replace(/^\//, '');
  return `\\\\wsl.localhost\\${distro}\\${cleaned.replace(/\//g, '\\')}`;
}

export function windowsToWsl(windowsPath: string): string {
  // \\wsl.localhost\Ubuntu\home\user\Projects → /home/user/Projects
  const match = windowsPath.match(
    /^\\\\wsl\.localhost\\[^\\]+\\(.+)$/i,
  );
  if (match) {
    return '/' + match[1].replace(/\\/g, '/');
  }

  // C:\Users\foo → /mnt/c/Users/foo
  const driveMatch = windowsPath.match(/^([A-Za-z]):\\(.*)$/);
  if (driveMatch) {
    const drive = driveMatch[1].toLowerCase();
    const rest = driveMatch[2].replace(/\\/g, '/');
    return `/mnt/${drive}/${rest}`;
  }

  return windowsPath;
}

/**
 * Given a project path, return the path suitable for CLI use (WSL paths for
 * commands that run inside WSL, even when the Electron app is on Windows).
 */
export function toCliPath(projectPath: string): string {
  if (isWSL() || process.platform === 'linux') {
    // Already a Unix path
    return projectPath;
  }

  // On native Windows, convert \\wsl.localhost paths to /home/... paths
  if (process.platform === 'win32') {
    const wsl = windowsToWsl(projectPath);
    if (wsl !== projectPath) return wsl;
  }

  return projectPath;
}

// ---------------------------------------------------------------------------
// Main detection
// ---------------------------------------------------------------------------

export async function detectEnvironment(): Promise<EnvironmentInfo> {
  if (cachedEnv) return cachedEnv;

  const homeDir = app.getPath('home');
  let platform: Platform;
  let wslAvailable = false;
  let wslDistro = '';
  let wslHomePath = '';
  let defaultProjectDir: string;
  let windowsProjectDir = '';
  let wslProjectDir = '';

  if (isWSL()) {
    platform = 'wsl';
    wslAvailable = true;
    wslDistro = process.env.WSL_DISTRO_NAME || 'Ubuntu';
    wslHomePath = homeDir;
    wslProjectDir = path.join(homeDir, 'Projects');
    defaultProjectDir = wslProjectDir;
  } else if (process.platform === 'win32') {
    wslAvailable = await checkWslAvailableOnWindows();
    windowsProjectDir = path.join(homeDir, 'Projects');

    if (wslAvailable) {
      platform = 'native-windows'; // with WSL available
      wslDistro = await getWslDistro();
      wslHomePath = await getWslHome();
      wslProjectDir = `${wslHomePath}/Projects`;
      // Default to WSL path (shown as Windows UNC path)
      defaultProjectDir = wslToWindows(wslProjectDir, wslDistro);
    } else {
      platform = 'native-windows';
      defaultProjectDir = windowsProjectDir;
    }
  } else {
    // Native Linux (non-WSL)
    platform = 'native-linux';
    defaultProjectDir = path.join(homeDir, 'Projects');
  }

  cachedEnv = {
    platform,
    wslAvailable,
    wslDistro,
    wslHomePath,
    defaultProjectDir,
    windowsProjectDir,
    wslProjectDir,
  };

  return cachedEnv;
}

/** Clear the cached environment (useful if user changes WSL setup). */
export function clearCache(): void {
  cachedEnv = null;
}
