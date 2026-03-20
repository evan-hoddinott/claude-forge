import { spawn, execFile, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import path from 'node:path';
import type { AgentType, ProjectInput } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { sanitizeProjectName, sanitizeDescription } from '../utils/sanitize';

const execFileAsync = promisify(execFile);
const activeProcesses = new Map<string, ChildProcess>();

/**
 * Resolves the full binary path for an agent command using a login shell,
 * so that PATH includes ~/.local/bin, nvm paths, etc.
 */
async function resolveAgentBinary(command: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('bash', ['-l', '-c', `which ${command}`], { timeout: 5000 });
    return stdout.trim();
  } catch {
    return command;
  }
}

function buildInitialPrompt(
  projectName: string,
  inputs: ProjectInput[],
  agentType: AgentType,
): string {
  const config = AGENTS[agentType];
  // Sanitize project name for use in prompt text
  const safeName = sanitizeProjectName(projectName);
  const parts = [`I'm starting a new project called "${safeName}".`];

  const filled = inputs.filter((i) => i.value.trim());
  if (filled.length > 0) {
    parts.push("Here's what I need:");
    for (const input of filled) {
      // Sanitize input values
      const safeLabel = sanitizeDescription(input.label);
      const safeValue = sanitizeDescription(input.value);
      parts.push(`- ${safeLabel}: ${safeValue}`);
    }
  }

  parts.push(
    `\nPlease read the ${config.contextFileName} file for full context, then help me set up the project structure and start building.`,
  );

  return parts.join('\n');
}

/**
 * Escapes single quotes for safe embedding in single-quoted shell strings.
 */
function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

function buildLaunchArgs(agentType: AgentType, prompt: string): string[] {
  const config = AGENTS[agentType];
  if (agentType === 'codex') {
    return [config.command, prompt];
  }
  return [config.command, '-p', prompt];
}

export async function startAgent(
  agentType: AgentType,
  projectId: string,
  projectPath: string,
  projectName: string,
  inputs: ProjectInput[],
): Promise<void> {
  const processKey = `${projectId}:${agentType}`;
  if (activeProcesses.has(processKey)) return;

  // Ensure the project directory exists before launching
  fsSync.mkdirSync(projectPath, { recursive: true });

  const config = AGENTS[agentType];
  // Resolve full binary path so it works even without full PATH in the terminal
  const agentCmd = await resolveAgentBinary(config.command);

  let child: ChildProcess;

  if (process.platform === 'darwin') {
    const escapedPath = shellEscape(projectPath);
    const launchCmd = `cd '${escapedPath}' && ${agentCmd}`;
    const script = `tell application "Terminal" to do script "${launchCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    child = spawn(
      'osascript',
      ['-e', script],
      { detached: true, stdio: 'ignore' },
    );
  } else if (process.platform === 'win32') {
    const launchCmd = `cd /d "${projectPath}" && ${agentCmd}`;

    child = spawn('cmd', ['/c', 'start', 'cmd', '/k', launchCmd], {
      detached: true,
      stdio: 'ignore',
    });
  } else {
    const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;

    if (isWSL) {
      // WSL: launch in Windows Terminal with wt.exe, fallback to cmd.exe
      const escapedPath = shellEscape(projectPath);
      const innerCmd = `cd '${escapedPath}' && ${agentCmd}`;

      // Try wt.exe first, fall back to cmd.exe — use login shell (-l) for full PATH
      const wtCmd = `wt.exe -d "$(wslpath -w '${escapedPath}')" wsl.exe bash -l -c '${shellEscape(innerCmd)}'`;
      const fallbackCmd = `cmd.exe /c start bash -l -c "${innerCmd.replace(/"/g, '\\"')}"`;

      child = spawn(
        'bash',
        ['-l', '-c', `${wtCmd} 2>/dev/null || ${fallbackCmd}`],
        { detached: true, stdio: 'ignore' },
      );
    } else {
      // Linux: use x-terminal-emulator — use login shell (-l) for full PATH
      const escapedPath = shellEscape(projectPath);
      const launchCmd = `cd '${escapedPath}' && ${agentCmd}`;

      child = spawn(
        'x-terminal-emulator',
        ['-e', `bash -l -c '${shellEscape(launchCmd)}; exec bash'`],
        { detached: true, stdio: 'ignore' },
      );
    }
  }

  child.unref();
  activeProcesses.set(processKey, child);
  child.on('exit', () => activeProcesses.delete(processKey));
}

export async function getStatus(
  projectId: string,
  projectPath: string,
): Promise<{ running: boolean; hasHistory: boolean }> {
  // Check if any agent is running for this project
  const running = Array.from(activeProcesses.keys()).some((k) => k.startsWith(`${projectId}:`));

  let hasHistory = false;
  try {
    await fs.access(path.join(projectPath, '.claude'));
    hasHistory = true;
  } catch {
    // no history dir
  }

  return { running, hasHistory };
}

export function isRunning(projectId: string, agentType?: AgentType): boolean {
  if (agentType) {
    return activeProcesses.has(`${projectId}:${agentType}`);
  }
  return Array.from(activeProcesses.keys()).some((k) => k.startsWith(`${projectId}:`));
}
