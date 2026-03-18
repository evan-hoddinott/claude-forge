import { ipcMain, dialog, shell } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import type { CreateProjectInput, Project } from '../shared/types';
import * as store from './store';
import * as projectService from './services/project-service';
import * as githubService from './services/github-service';
import * as claudeService from './services/claude-service';
import * as environmentService from './services/environment-service';

const execFileAsync = promisify(execFile);

export function registerIpcHandlers(): void {
  // --- Projects ---

  ipcMain.handle('projects:list', () => {
    return store.getAllProjects();
  });

  ipcMain.handle('projects:get', (_, id: string) => {
    return store.getProjectById(id);
  });

  ipcMain.handle('projects:create', async (_, input: CreateProjectInput) => {
    return projectService.createProject(input);
  });

  ipcMain.handle(
    'projects:update',
    (_, id: string, updates: Partial<Project>) => {
      return store.updateProject(id, updates);
    },
  );

  ipcMain.handle(
    'projects:delete',
    async (_, id: string, deleteFromDisk?: boolean) => {
      return projectService.deleteProject(id, deleteFromDisk ?? false);
    },
  );

  // --- GitHub ---

  ipcMain.handle(
    'github:create-repo',
    async (_, name: string, isPrivate: boolean, description: string, projectPath: string) => {
      return githubService.createRepo(name, isPrivate, description, projectPath);
    },
  );

  ipcMain.handle('github:list-repos', async () => {
    return githubService.listRepos();
  });

  ipcMain.handle(
    'github:link-repo',
    async (_, projectPath: string, repoUrl: string) => {
      return githubService.linkExistingRepo(projectPath, repoUrl);
    },
  );

  // --- Claude Code ---

  ipcMain.handle('claude:start', async (_, projectId: string) => {
    const project = store.getProjectById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    claudeService.startClaudeCode(
      projectId,
      project.path,
      project.name,
      project.inputs,
    );

    store.updateProject(projectId, {
      lastClaudeSession: new Date().toISOString(),
      status: 'in-progress',
    });
  });

  ipcMain.handle('claude:status', async (_, projectId: string) => {
    const project = store.getProjectById(projectId);
    if (!project) return { running: false, hasHistory: false };
    return claudeService.getStatus(projectId, project.path);
  });

  // --- System ---

  ipcMain.handle('system:select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('system:open-in-terminal', async (_, dirPath: string) => {
    if (process.platform === 'darwin') {
      await execFileAsync('open', ['-a', 'Terminal', dirPath]);
    } else if (process.platform === 'win32') {
      await execFileAsync('cmd', ['/c', 'start', 'cmd', '/k', `cd /d "${dirPath}"`]);
    } else {
      spawn('x-terminal-emulator', [], {
        cwd: dirPath,
        detached: true,
      }).unref();
    }
  });

  ipcMain.handle('system:open-in-editor', async (_, dirPath: string) => {
    try {
      await execFileAsync('code', [dirPath]);
    } catch {
      await shell.openPath(dirPath);
    }
  });

  ipcMain.handle('system:open-external', async (_, url: string) => {
    await shell.openExternal(url);
  });

  // --- Environment ---

  ipcMain.handle('system:get-environment', async () => {
    return environmentService.detectEnvironment();
  });

  // --- Preferences ---

  ipcMain.handle('preferences:get', () => {
    return store.getPreferences();
  });

  ipcMain.handle(
    'preferences:update',
    (_, updates: Partial<import('../shared/types').UserPreferences>) => {
      return store.updatePreferences(updates);
    },
  );

  // --- System Checks ---

  ipcMain.handle('system:check-gh-auth', async () => {
    try {
      const { stdout, stderr } = await execFileAsync('gh', [
        'auth',
        'status',
      ]);
      const output = stdout + stderr;
      const match = output.match(/account (\S+)/);
      return { authenticated: true, username: match?.[1] ?? '' };
    } catch {
      return { authenticated: false, username: '' };
    }
  });

  ipcMain.handle('system:check-claude', async () => {
    try {
      const { stdout, stderr } = await execFileAsync('claude', ['--version']);
      return { installed: true, version: (stdout || stderr).trim() };
    } catch {
      return { installed: false, version: '' };
    }
  });

  // --- GitHub Connection ---

  ipcMain.handle('github:check-auth', async () => {
    // Check if gh CLI is installed
    let ghInstalled = false;
    try {
      await execFileAsync('gh', ['--version'], { timeout: 5000 });
      ghInstalled = true;
    } catch {
      return { authenticated: false, username: '', ghInstalled: false };
    }

    // Check auth status
    try {
      const { stdout, stderr } = await execFileAsync('gh', [
        'auth', 'status', '--hostname', 'github.com',
      ], { timeout: 10000 });
      const output = stdout + stderr;
      const match = output.match(/account (\S+)/);
      return { authenticated: true, username: match?.[1] ?? '', ghInstalled };
    } catch {
      return { authenticated: false, username: '', ghInstalled };
    }
  });

  ipcMain.handle('github:login-start', async () => {
    return new Promise<{ code: string } | { error: string }>((resolve) => {
      const child = spawn('gh', [
        'auth', 'login',
        '--web',
        '--hostname', 'github.com',
        '--git-protocol', 'https',
      ]);

      let output = '';
      let resolved = false;

      function handleData(data: Buffer) {
        output += data.toString();
        // Look for the one-time code: "First copy your one-time code: XXXX-XXXX"
        const codeMatch = output.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i);
        if (codeMatch && !resolved) {
          resolved = true;
          // Send Enter to proceed (opens browser)
          child.stdin.write('\n');
          resolve({ code: codeMatch[1] });
        }
      }

      child.stdout.on('data', handleData);
      child.stderr.on('data', handleData);

      child.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          resolve({ error: err.message });
        }
      });

      // Timeout after 15 seconds if we never get a code
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          child.kill();
          resolve({ error: 'Timed out waiting for device code' });
        }
      }, 15000);
    });
  });

  ipcMain.handle('github:logout', async () => {
    try {
      await execFileAsync('gh', [
        'auth', 'logout', '--hostname', 'github.com',
      ], { timeout: 10000, env: { ...process.env, GH_PROMPT_DISABLED: '1' } });
    } catch {
      // gh auth logout may fail if not logged in, that's fine
    }
  });

  ipcMain.handle('github:repo-count', async () => {
    try {
      const { stdout: countOut } = await execFileAsync('gh', [
        'api', 'user', '--jq', '.public_repos + .total_private_repos',
      ], { timeout: 10000 });
      const count = parseInt(countOut.trim(), 10);
      return isNaN(count) ? 0 : count;
    } catch {
      return 0;
    }
  });

  // --- Data ---

  ipcMain.handle('data:export', async () => {
    const projects = store.getAllProjects();
    const result = await dialog.showSaveDialog({
      title: 'Export Projects',
      defaultPath: 'claude-forge-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return null;
    await fs.writeFile(
      result.filePath,
      JSON.stringify(projects, null, 2),
      'utf-8',
    );
    return result.filePath;
  });

  ipcMain.handle('data:import', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Import Projects',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return 0;
    const content = await fs.readFile(result.filePaths[0], 'utf-8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed))
      throw new Error('Invalid format: expected an array of projects');
    return store.importProjects(parsed);
  });

  ipcMain.handle('data:reset', () => {
    store.resetAll();
  });
}
