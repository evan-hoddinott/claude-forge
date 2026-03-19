import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CreateProjectInput, Project, AgentType, AgentStatus } from '../shared/types';
import { AGENTS } from '../shared/types';
import * as store from './store';
import * as projectService from './services/project-service';
import * as githubService from './services/github-service';
import * as agentService from './services/agent-service';
import * as environmentService from './services/environment-service';
import * as fileService from './services/file-service';

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

  // --- Agent (unified for Claude, Gemini, Codex) ---

  ipcMain.handle('agent:start', async (_, projectId: string, agentType: AgentType) => {
    const project = store.getProjectById(projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);

    // Check if agent CLI is installed before attempting launch
    const config = AGENTS[agentType];
    try {
      await execFileAsync(config.command, ['--version'], { timeout: 5000 });
    } catch {
      throw new Error(
        `${config.displayName} is not installed. Please install it from the sidebar before launching.`,
      );
    }

    agentService.startAgent(
      agentType,
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

  ipcMain.handle('agent:status', async (_, projectId: string) => {
    const project = store.getProjectById(projectId);
    if (!project) return { running: false, hasHistory: false };
    return agentService.getStatus(projectId, project.path);
  });

  ipcMain.handle('agent:check-full-status', async (_, agentType: AgentType): Promise<AgentStatus> => {
    const config = AGENTS[agentType];
    const result: AgentStatus = {
      nodeInstalled: false,
      installed: false,
      version: '',
      latestVersion: '',
      updateAvailable: false,
      authenticated: false,
    };

    // Check Node.js
    try {
      await execFileAsync('node', ['--version'], { timeout: 5000 });
      result.nodeInstalled = true;
    } catch {
      return result;
    }

    // Check if CLI is installed + version
    try {
      const { stdout, stderr } = await execFileAsync(config.command, ['--version'], { timeout: 10000 });
      const versionOutput = (stdout || stderr).trim();
      result.installed = true;
      result.version = versionOutput;
    } catch {
      return result;
    }

    // Check latest version from npm
    try {
      const { stdout } = await execFileAsync('npm', ['view', config.npmPackage, 'version'], { timeout: 10000 });
      result.latestVersion = stdout.trim();
      if (result.version && result.latestVersion) {
        const installedMatch = result.version.match(/(\d+\.\d+\.\d+)/);
        const installed = installedMatch ? installedMatch[1] : '';
        if (installed && installed !== result.latestVersion) {
          result.updateAvailable = true;
        }
      }
    } catch {
      // npm check failed, skip
    }

    // Check authentication
    try {
      const configDir = path.join(os.homedir(), `.${config.command}`);
      await fs.access(configDir);
      const files = await fs.readdir(configDir);
      result.authenticated = files.some(f =>
        f.includes('credentials') || f.includes('auth') || f === '.credentials.json'
      );
    } catch {
      // no config dir
    }

    if (!result.authenticated) {
      try {
        const credPath = path.join(os.homedir(), `.${config.command}.json`);
        await fs.access(credPath);
        result.authenticated = true;
      } catch {
        // not authenticated
      }
    }

    return result;
  });

  ipcMain.handle('agent:check-all-statuses', async () => {
    const types: AgentType[] = ['claude', 'gemini', 'codex'];
    const results: Record<string, AgentStatus> = {};

    // Check node once
    let nodeInstalled = false;
    try {
      await execFileAsync('node', ['--version'], { timeout: 5000 });
      nodeInstalled = true;
    } catch {
      // no node
    }

    for (const agentType of types) {
      const config = AGENTS[agentType];
      const status: AgentStatus = {
        nodeInstalled,
        installed: false,
        version: '',
        latestVersion: '',
        updateAvailable: false,
        authenticated: false,
      };

      if (!nodeInstalled) {
        results[agentType] = status;
        continue;
      }

      try {
        const { stdout, stderr } = await execFileAsync(config.command, ['--version'], { timeout: 10000 });
        status.installed = true;
        status.version = (stdout || stderr).trim();
      } catch {
        results[agentType] = status;
        continue;
      }

      // npm version check (best effort)
      try {
        const { stdout } = await execFileAsync('npm', ['view', config.npmPackage, 'version'], { timeout: 10000 });
        status.latestVersion = stdout.trim();
        if (status.version && status.latestVersion) {
          const m = status.version.match(/(\d+\.\d+\.\d+)/);
          if (m && m[1] !== status.latestVersion) {
            status.updateAvailable = true;
          }
        }
      } catch {
        // skip
      }

      // Auth check
      try {
        const configDir = path.join(os.homedir(), `.${config.command}`);
        await fs.access(configDir);
        const files = await fs.readdir(configDir);
        status.authenticated = files.some(f =>
          f.includes('credentials') || f.includes('auth') || f === '.credentials.json'
        );
      } catch {
        // no config dir
      }
      if (!status.authenticated) {
        try {
          await fs.access(path.join(os.homedir(), `.${config.command}.json`));
          status.authenticated = true;
        } catch {
          // not authenticated
        }
      }

      results[agentType] = status;
    }

    return results as Record<AgentType, AgentStatus>;
  });

  ipcMain.handle('agent:install', async (event, agentType: AgentType) => {
    const config = AGENTS[agentType];
    const win = BrowserWindow.fromWebContents(event.sender);
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const child = spawn('npm', ['install', '-g', config.npmPackage], {
        shell: true,
        env: { ...process.env },
      });

      let errorOutput = '';

      child.stdout.on('data', (data: Buffer) => {
        const line = data.toString();
        win?.webContents.send('agent:install-progress', { line });
      });

      child.stderr.on('data', (data: Buffer) => {
        const line = data.toString();
        errorOutput += line;
        win?.webContents.send('agent:install-progress', { line });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: errorOutput.slice(-500) });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  });

  ipcMain.handle('agent:update', async (event, agentType: AgentType) => {
    const config = AGENTS[agentType];
    const win = BrowserWindow.fromWebContents(event.sender);
    return new Promise<{ success: boolean; error?: string }>((resolve) => {
      const child = spawn('npm', ['install', '-g', `${config.npmPackage}@latest`], {
        shell: true,
        env: { ...process.env },
      });

      let errorOutput = '';

      child.stdout.on('data', (data: Buffer) => {
        win?.webContents.send('agent:install-progress', { line: data.toString() });
      });

      child.stderr.on('data', (data: Buffer) => {
        const line = data.toString();
        errorOutput += line;
        win?.webContents.send('agent:install-progress', { line });
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: errorOutput.slice(-500) });
        }
      });

      child.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  });

  ipcMain.handle('agent:login', async (_, agentType: AgentType) => {
    const config = AGENTS[agentType];
    return new Promise<{ success: boolean }>((resolve) => {
      const child = spawn(config.loginCommand, [], {
        shell: true,
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      resolve({ success: true });
    });
  });

  // --- File System Checks ---

  ipcMain.handle('system:check-path-exists', async (_, targetPath: string) => {
    try {
      const entries = await fs.readdir(targetPath);
      return { exists: true, hasContent: entries.length > 0 };
    } catch {
      return { exists: false, hasContent: false };
    }
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

  // --- GitHub Connection ---

  ipcMain.handle('github:check-auth', async () => {
    let ghInstalled = false;
    try {
      await execFileAsync('gh', ['--version'], { timeout: 5000 });
      ghInstalled = true;
    } catch {
      return { authenticated: false, username: '', ghInstalled: false };
    }

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
        const codeMatch = output.match(/one-time code:\s*([A-Z0-9]{4}-[A-Z0-9]{4})/i);
        if (codeMatch && !resolved) {
          resolved = true;
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
      // may fail if not logged in
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

  // --- Files ---

  ipcMain.handle('files:tree', async (_, projectPath: string) => {
    return fileService.buildFileTree(projectPath);
  });

  ipcMain.handle('files:read', async (_, filePath: string) => {
    return fileService.readFile(filePath);
  });

  ipcMain.handle('files:git-status', async (_, projectPath: string) => {
    const statusMap = await fileService.getGitStatus(projectPath);
    return Object.fromEntries(statusMap);
  });

  ipcMain.handle('files:search-names', async (_, projectPath: string, query: string) => {
    return fileService.searchFileNames(projectPath, query);
  });

  ipcMain.handle('files:search-contents', async (_, projectPath: string, query: string) => {
    return fileService.searchFileContents(projectPath, query);
  });

  ipcMain.handle('files:open-vscode', async (_, filePath: string, lineNumber?: number) => {
    return fileService.openInVSCode(filePath, lineNumber);
  });

  ipcMain.handle('files:open-folder-vscode', async (_, folderPath: string) => {
    return fileService.openFolderInVSCode(folderPath);
  });

  ipcMain.handle('files:open-default-editor', async (_, filePath: string) => {
    return fileService.openInDefaultEditor(filePath);
  });

  ipcMain.handle('files:open-terminal', async (_, filePath: string) => {
    return fileService.openInTerminal(filePath);
  });

  ipcMain.handle('files:watch', async (event, projectPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) fileService.watchProject(projectPath, win);
  });

  ipcMain.handle('files:unwatch', async (_, projectPath: string) => {
    fileService.unwatchProject(projectPath);
  });

  ipcMain.handle('files:save', async (_, filePath: string, content: string) => {
    return fileService.saveFile(filePath, content);
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
