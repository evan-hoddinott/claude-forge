import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { AgentType, ProjectInput } from '../../shared/types';
import { AGENTS } from '../../shared/types';

const activeProcesses = new Map<string, ChildProcess>();

function buildInitialPrompt(
  projectName: string,
  inputs: ProjectInput[],
  agentType: AgentType,
): string {
  const config = AGENTS[agentType];
  const parts = [`I'm starting a new project called "${projectName}".`];

  const filled = inputs.filter((i) => i.value.trim());
  if (filled.length > 0) {
    parts.push("Here's what I need:");
    for (const input of filled) {
      parts.push(`- ${input.label}: ${input.value}`);
    }
  }

  parts.push(
    `\nPlease read the ${config.contextFileName} file for full context, then help me set up the project structure and start building.`,
  );

  return parts.join('\n');
}

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

function buildLaunchCommand(agentType: AgentType, projectPath: string, prompt: string): string {
  const config = AGENTS[agentType];
  const escapedPath = shellEscape(projectPath);
  const escapedPrompt = shellEscape(prompt);

  // Each CLI has slightly different prompt flag syntax
  let agentCmd: string;
  if (agentType === 'codex') {
    agentCmd = `${config.command} '${escapedPrompt}'`;
  } else {
    agentCmd = `${config.command} -p '${escapedPrompt}'`;
  }

  return `cd '${escapedPath}' && ${agentCmd}`;
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
  const launchCmd = buildLaunchCommand(agentType, projectPath, prompt);

  let child: ChildProcess;

  if (process.platform === 'darwin') {
    child = spawn(
      'osascript',
      ['-e', `tell application "Terminal" to do script "${launchCmd.replace(/"/g, '\\"')}"`],
      { detached: true, stdio: 'ignore' },
    );
  } else if (process.platform === 'win32') {
    child = spawn('cmd', ['/c', 'start', 'cmd', '/k', launchCmd], {
      detached: true,
      shell: true,
      stdio: 'ignore',
    });
  } else {
    const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;

    if (isWSL) {
      child = spawn(
        'bash',
        ['-c', `wt.exe -d '${shellEscape(projectPath)}' bash -c '${shellEscape(launchCmd)}'`],
        { detached: true, stdio: 'ignore' },
      );
    } else {
      child = spawn(
        'x-terminal-emulator',
        ['-e', `bash -c "${launchCmd.replace(/"/g, '\\"')}; exec bash"`],
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
