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
import * as contextGenerator from './services/context-generator';
import {
  validateString,
  isValidAgentType,
  isValidUrl,
  sanitizeErrorMessage,
  validatePath,
} from './utils/sanitize';

const execFileAsync = promisify(execFile);

// --- Rate limiting ---
let activeGitOps = new Set<string>();
let activeInstalls = 0;

function safeError(err: unknown): string {
  if (err instanceof Error) {
    return sanitizeErrorMessage(err.message);
  }
  return 'An unexpected error occurred';
}

export function registerIpcHandlers(): void {
  // --- Projects ---

  ipcMain.handle('projects:list', () => {
    return store.getAllProjects();
  });

  ipcMain.handle('projects:get', (_, id: unknown) => {
    const validId = validateString(id, 'id');
    return store.getProjectById(validId);
  });

  ipcMain.handle('projects:create', async (_, input: unknown) => {
    if (!input || typeof input !== 'object') throw new Error('Invalid input');
    try {
      return await projectService.createProject(input as CreateProjectInput);
    } catch (err) {
      throw new Error(safeError(err));
    }
  });

  ipcMain.handle(
    'projects:update',
    (_, id: unknown, updates: unknown) => {
      const validId = validateString(id, 'id');
      if (!updates || typeof updates !== 'object') throw new Error('Invalid updates');
      try {
        return store.updateProject(validId, updates as Partial<Project>);
      } catch (err) {
        throw new Error(safeError(err));
      }
    },
  );

  ipcMain.handle(
    'projects:delete',
    async (_, id: unknown, deleteFromDisk?: unknown) => {
      const validId = validateString(id, 'id');
      return projectService.deleteProject(validId, deleteFromDisk === true);
    },
  );

  // --- GitHub ---

  ipcMain.handle(
    'github:create-repo',
    async (_, name: unknown, isPrivate: unknown, description: unknown, projectPath: unknown) => {
      const validName = validateString(name, 'name', 100);
      const validDesc = validateString(description, 'description', 500);
      const validPath = validateString(projectPath, 'projectPath');
      try {
        return await githubService.createRepo(validName, isPrivate === true, validDesc, validPath);
      } catch (err) {
        throw new Error(safeError(err));
      }
    },
  );

  ipcMain.handle('github:list-repos', async () => {
    return githubService.listRepos();
  });

  ipcMain.handle(
    'github:link-repo',
    async (_, projectPath: unknown, repoUrl: unknown) => {
      const validPath = validateString(projectPath, 'projectPath');
      const validUrl = validateString(repoUrl, 'repoUrl', 500);
      try {
        return await githubService.linkExistingRepo(validPath, validUrl);
      } catch (err) {
        throw new Error(safeError(err));
      }
    },
  );

  // --- Agent (unified for Claude, Gemini, Codex) ---

  ipcMain.handle('agent:start', async (_, projectId: unknown, agentType: unknown) => {
    const validId = validateString(projectId, 'projectId');
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');

    const project = store.getProjectById(validId);
    if (!project) throw new Error('Project not found');

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
      validId,
      project.path,
      project.name,
      project.inputs,
    );

    store.updateProject(validId, {
      lastClaudeSession: new Date().toISOString(),
      status: 'in-progress',
    });
  });

  ipcMain.handle('agent:status', async (_, projectId: unknown) => {
    const validId = validateString(projectId, 'projectId');
    const project = store.getProjectById(validId);
    if (!project) return { running: false, hasHistory: false };
    return agentService.getStatus(validId, project.path);
  });

  ipcMain.handle('agent:check-full-status', async (_, agentType: unknown): Promise<AgentStatus> => {
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');

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

  ipcMain.handle('agent:install', async (event, agentType: unknown) => {
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');
    if (activeInstalls >= 1) throw new Error('An install is already in progress');

    const config = AGENTS[agentType];
    const win = BrowserWindow.fromWebContents(event.sender);
    activeInstalls++;

    try {
      return await new Promise<{ success: boolean; error?: string }>((resolve) => {
        // Use execFile-style args without shell: true
        const child = spawn('npm', ['install', '-g', config.npmPackage], {
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
          activeInstalls--;
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: sanitizeErrorMessage(errorOutput.slice(-500)) });
          }
        });

        child.on('error', (err) => {
          activeInstalls--;
          resolve({ success: false, error: sanitizeErrorMessage(err.message) });
        });
      });
    } catch {
      activeInstalls--;
      return { success: false, error: 'Install failed' };
    }
  });

  ipcMain.handle('agent:update', async (event, agentType: unknown) => {
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');
    if (activeInstalls >= 1) throw new Error('An install/update is already in progress');

    const config = AGENTS[agentType];
    const win = BrowserWindow.fromWebContents(event.sender);
    activeInstalls++;

    try {
      return await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const child = spawn('npm', ['install', '-g', `${config.npmPackage}@latest`], {
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
          activeInstalls--;
          if (code === 0) {
            resolve({ success: true });
          } else {
            resolve({ success: false, error: sanitizeErrorMessage(errorOutput.slice(-500)) });
          }
        });

        child.on('error', (err) => {
          activeInstalls--;
          resolve({ success: false, error: sanitizeErrorMessage(err.message) });
        });
      });
    } catch {
      activeInstalls--;
      return { success: false, error: 'Update failed' };
    }
  });

  ipcMain.handle('agent:login', async (_, agentType: unknown) => {
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');

    const config = AGENTS[agentType];
    return new Promise<{ success: boolean }>((resolve) => {
      const child = spawn(config.loginCommand, [], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      resolve({ success: true });
    });
  });

  // --- File System Checks ---

  ipcMain.handle('system:check-path-exists', async (_, targetPath: unknown) => {
    const validPath = validateString(targetPath, 'path');
    try {
      const entries = await fs.readdir(validPath);
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

  ipcMain.handle('system:open-in-terminal', async (_, dirPath: unknown) => {
    const validPath = validateString(dirPath, 'dirPath');
    if (process.platform === 'darwin') {
      await execFileAsync('open', ['-a', 'Terminal', validPath]);
    } else if (process.platform === 'win32') {
      await execFileAsync('cmd', ['/c', 'start', 'cmd', '/k', 'cd', '/d', validPath]);
    } else {
      spawn('x-terminal-emulator', [], {
        cwd: validPath,
        detached: true,
      }).unref();
    }
  });

  ipcMain.handle('system:open-in-editor', async (_, dirPath: unknown) => {
    const validPath = validateString(dirPath, 'dirPath');
    try {
      await execFileAsync('code', [validPath]);
    } catch {
      await shell.openPath(validPath);
    }
  });

  ipcMain.handle('system:open-external', async (_, url: unknown) => {
    const validUrl = validateString(url, 'url', 2000);
    if (!isValidUrl(validUrl)) {
      throw new Error('Invalid URL: only http and https URLs are allowed');
    }
    await shell.openExternal(validUrl);
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
    (_, updates: unknown) => {
      if (!updates || typeof updates !== 'object') throw new Error('Invalid updates');
      return store.updatePreferences(updates as Partial<import('../shared/types').UserPreferences>);
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
          resolve({ error: sanitizeErrorMessage(err.message) });
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
  // All file operations require a project path for path validation.
  // We look up the project to get its root path for validation.

  function getProjectPathForFile(filePath: string): string | null {
    const projects = store.getAllProjects();
    for (const p of projects) {
      const root = path.resolve(p.path);
      const resolved = path.resolve(filePath);
      if (resolved === root || resolved.startsWith(root + path.sep)) {
        return root;
      }
    }
    return null;
  }

  ipcMain.handle('files:tree', async (_, projectPath: unknown) => {
    const validPath = validateString(projectPath, 'projectPath');
    return fileService.buildFileTree(validPath);
  });

  ipcMain.handle('files:read', async (_, filePath: unknown) => {
    const validPath = validateString(filePath, 'filePath');
    const projectRoot = getProjectPathForFile(validPath);
    if (!projectRoot) throw new Error('File is not within any known project');
    return fileService.readFile(validPath, projectRoot);
  });

  ipcMain.handle('files:git-status', async (_, projectPath: unknown) => {
    const validPath = validateString(projectPath, 'projectPath');
    const statusMap = await fileService.getGitStatus(validPath);
    return Object.fromEntries(statusMap);
  });

  ipcMain.handle('files:search-names', async (_, projectPath: unknown, query: unknown) => {
    const validPath = validateString(projectPath, 'projectPath');
    const validQuery = validateString(query, 'query', 500);
    return fileService.searchFileNames(validPath, validQuery);
  });

  ipcMain.handle('files:search-contents', async (_, projectPath: unknown, query: unknown) => {
    const validPath = validateString(projectPath, 'projectPath');
    const validQuery = validateString(query, 'query', 500);
    return fileService.searchFileContents(validPath, validQuery);
  });

  ipcMain.handle('files:open-vscode', async (_, filePath: unknown, lineNumber?: unknown) => {
    const validPath = validateString(filePath, 'filePath');
    const projectRoot = getProjectPathForFile(validPath);
    if (!projectRoot) throw new Error('File is not within any known project');
    const validLine = typeof lineNumber === 'number' ? lineNumber : undefined;
    return fileService.openInVSCode(validPath, projectRoot, validLine);
  });

  ipcMain.handle('files:open-folder-vscode', async (_, folderPath: unknown) => {
    const validPath = validateString(folderPath, 'folderPath');
    return fileService.openFolderInVSCode(validPath);
  });

  ipcMain.handle('files:open-default-editor', async (_, filePath: unknown) => {
    const validPath = validateString(filePath, 'filePath');
    const projectRoot = getProjectPathForFile(validPath);
    if (!projectRoot) throw new Error('File is not within any known project');
    return fileService.openInDefaultEditor(validPath, projectRoot);
  });

  ipcMain.handle('files:open-terminal', async (_, filePath: unknown) => {
    const validPath = validateString(filePath, 'filePath');
    const projectRoot = getProjectPathForFile(validPath);
    if (!projectRoot) throw new Error('File is not within any known project');
    return fileService.openInTerminal(validPath, projectRoot);
  });

  ipcMain.handle('files:watch', async (event, projectPath: unknown) => {
    const validPath = validateString(projectPath, 'projectPath');
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) fileService.watchProject(validPath, win);
  });

  ipcMain.handle('files:unwatch', async (_, projectPath: unknown) => {
    const validPath = validateString(projectPath, 'projectPath');
    fileService.unwatchProject(validPath);
  });

  ipcMain.handle('files:save', async (_, filePath: unknown, content: unknown) => {
    const validPath = validateString(filePath, 'filePath');
    const validContent = validateString(content, 'content', 10 * 1024 * 1024); // 10MB max
    const projectRoot = getProjectPathForFile(validPath);
    if (!projectRoot) throw new Error('File is not within any known project');
    return fileService.saveFile(validPath, validContent, projectRoot);
  });

  // --- Context file regeneration ---

  ipcMain.handle('files:regenerate-context', async (_, projectId: unknown, agentType: unknown) => {
    const validId = validateString(projectId, 'projectId');
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');
    const project = store.getProjectById(validId);
    if (!project) throw new Error('Project not found');
    await contextGenerator.writeContextFile(project, agentType);
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
    // Limit import file size
    if (content.length > 10 * 1024 * 1024) throw new Error('Import file too large');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed))
      throw new Error('Invalid format: expected an array of projects');
    return store.importProjects(parsed);
  });

  ipcMain.handle('data:reset', () => {
    store.resetAll();
  });

  // --- Encryption Status ---

  ipcMain.handle('system:encryption-status', () => {
    return store.getEncryptionStatus();
  });
}
