import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentType, ProjectInput } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { sanitizeProjectName, sanitizeDescription } from '../utils/sanitize';

const activeProcesses = new Map<string, ChildProcess>();

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

export function startAgent(
  agentType: AgentType,
  projectId: string,
  projectPath: string,
  projectName: string,
  inputs: ProjectInput[],
): void {
  const processKey = `${projectId}:${agentType}`;
  if (activeProcesses.has(processKey)) return;

  const prompt = buildInitialPrompt(projectName, inputs, agentType);
  const config = AGENTS[agentType];
  const agentArgs = buildLaunchArgs(agentType, prompt);

  let child: ChildProcess;

  if (process.platform === 'darwin') {
    // On macOS, use osascript to open Terminal.
    // We must build a shell command string for osascript, but we carefully
    // escape all user-provided values.
    const escapedPath = shellEscape(projectPath);
    const escapedPrompt = shellEscape(prompt);
    let agentCmd: string;
    if (agentType === 'codex') {
      agentCmd = `${config.command} '${escapedPrompt}'`;
    } else {
      agentCmd = `${config.command} -p '${escapedPrompt}'`;
    }
    const launchCmd = `cd '${escapedPath}' && ${agentCmd}`;
    const script = `tell application "Terminal" to do script "${launchCmd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

    child = spawn(
      'osascript',
      ['-e', script],
      { detached: true, stdio: 'ignore' },
    );
  } else if (process.platform === 'win32') {
    // On Windows, spawn cmd to open a new window.
    // Use /k with the agent command as separate args.
    const escapedPath = shellEscape(projectPath);
    const escapedPrompt = shellEscape(prompt);
    let agentCmd: string;
    if (agentType === 'codex') {
      agentCmd = `${config.command} '${escapedPrompt}'`;
    } else {
      agentCmd = `${config.command} -p '${escapedPrompt}'`;
    }
    const launchCmd = `cd /d "${projectPath}" && ${agentCmd}`;

    child = spawn('cmd', ['/c', 'start', 'cmd', '/k', launchCmd], {
      detached: true,
      stdio: 'ignore',
    });
  } else {
    const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;

    if (isWSL) {
      // WSL: launch in Windows Terminal
      const escapedPath = shellEscape(projectPath);
      const escapedPrompt = shellEscape(prompt);
      let agentCmd: string;
      if (agentType === 'codex') {
        agentCmd = `${config.command} '${escapedPrompt}'`;
      } else {
        agentCmd = `${config.command} -p '${escapedPrompt}'`;
      }
      const launchCmd = `cd '${escapedPath}' && ${agentCmd}`;

      child = spawn(
        'bash',
        ['-c', `wt.exe -d '${escapedPath}' bash -c '${shellEscape(launchCmd)}'`],
        { detached: true, stdio: 'ignore' },
      );
    } else {
      // Linux: use x-terminal-emulator
      const escapedPath = shellEscape(projectPath);
      const escapedPrompt = shellEscape(prompt);
      let agentCmd: string;
      if (agentType === 'codex') {
        agentCmd = `${config.command} '${escapedPrompt}'`;
      } else {
        agentCmd = `${config.command} -p '${escapedPrompt}'`;
      }
      const launchCmd = `cd '${escapedPath}' && ${agentCmd}`;

      child = spawn(
        'x-terminal-emulator',
        ['-e', `bash -c '${shellEscape(launchCmd)}; exec bash'`],
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
