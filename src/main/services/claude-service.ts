import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { ProjectInput } from '../../shared/types';

// Track spawned terminal processes by project ID
const activeProcesses = new Map<string, ChildProcess>();

function buildInitialPrompt(
  projectName: string,
  inputs: ProjectInput[],
): string {
  const parts = [`I'm starting a new project called "${projectName}".`];

  const filled = inputs.filter((i) => i.value.trim());
  if (filled.length > 0) {
    parts.push("Here's what I need:");
    for (const input of filled) {
      parts.push(`- ${input.label}: ${input.value}`);
    }
  }

  parts.push(
    '\nPlease read the CLAUDE.md file for full context, then help me set up the project structure and start building.',
  );

  return parts.join('\n');
}

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

export function startClaudeCode(
  projectId: string,
  projectPath: string,
  projectName: string,
  inputs: ProjectInput[],
): void {
  // Don't spawn a second session for the same project
  if (activeProcesses.has(projectId)) return;

  const prompt = buildInitialPrompt(projectName, inputs);
  const escapedPath = shellEscape(projectPath);
  const escapedPrompt = shellEscape(prompt);

  // Build the claude command: interactive with an initial prompt
  const claudeCmd = `cd '${escapedPath}' && claude -p '${escapedPrompt}'`;

  let child: ChildProcess;

  if (process.platform === 'darwin') {
    // macOS: open Terminal.app via osascript
    child = spawn(
      'osascript',
      ['-e', `tell application "Terminal" to do script "${claudeCmd.replace(/"/g, '\\"')}"`],
      { detached: true, stdio: 'ignore' },
    );
  } else if (process.platform === 'win32') {
    // Windows: try Windows Terminal, fall back to cmd
    child = spawn('cmd', ['/c', 'start', 'cmd', '/k', claudeCmd], {
      detached: true,
      shell: true,
      stdio: 'ignore',
    });
  } else {
    // Linux / WSL
    // Try wt.exe for WSL first, fall back to x-terminal-emulator
    const isWSL = process.env.WSL_DISTRO_NAME || process.env.WSLENV;

    if (isWSL) {
      child = spawn(
        'bash',
        ['-c', `wt.exe -d '${escapedPath}' bash -c '${shellEscape(claudeCmd)}'`],
        { detached: true, stdio: 'ignore' },
      );
    } else {
      child = spawn(
        'x-terminal-emulator',
        ['-e', `bash -c "${claudeCmd.replace(/"/g, '\\"')}; exec bash"`],
        { detached: true, stdio: 'ignore' },
      );
    }
  }

  child.unref();
  activeProcesses.set(projectId, child);
  child.on('exit', () => activeProcesses.delete(projectId));
}

export async function getStatus(
  projectId: string,
  projectPath: string,
): Promise<{ running: boolean; hasHistory: boolean }> {
  const running = activeProcesses.has(projectId);

  // Check for .claude/ directory or session artifacts
  let hasHistory = false;
  try {
    await fs.access(path.join(projectPath, '.claude'));
    hasHistory = true;
  } catch {
    // no .claude dir
  }

  return { running, hasHistory };
}

export function isRunning(projectId: string): boolean {
  return activeProcesses.has(projectId);
}
