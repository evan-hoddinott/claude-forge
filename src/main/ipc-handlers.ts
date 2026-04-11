import { ipcMain, dialog, BrowserWindow } from 'electron';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import type { CreateProjectInput, ImportProjectInput, Project, AgentType, AgentStatus, SetupCheckResult, DependencyStatus, VaultEntry, VaultEntryMasked, DeployOptions, VibeExportOptions } from '../shared/types';
import { AGENTS } from '../shared/types';
import * as store from './store';
import * as projectService from './services/project-service';
import * as githubService from './services/github-service';
import * as agentService from './services/agent-service';
import * as environmentService from './services/environment-service';
import * as fileService from './services/file-service';
import * as contextGenerator from './services/context-generator';
import * as projectDetector from './services/project-detector';
import * as chatService from './services/chat-service';
import * as vaultService from './services/vault-service';
import * as deployService from './services/deploy-service';
import * as vibeService from './services/vibe-service';
import * as snapshotService from './services/snapshot-service';
import * as ghostTestService from './services/ghost-test-service';
import * as reasoningMapService from './services/reasoning-map-service';
import {
  validateString,
  isValidAgentType,
  isValidUrl,
  sanitizeErrorMessage,
  validatePath,
} from './utils/sanitize';
import { openUrl } from './utils/open-url';
import {
  runCommand,
  runExecFile,
  spawnCommand,
  detectPackageManager,
  getInstallCommand,
  findTerminalEmulator,
} from './utils/run-command';

// --- Rate limiting ---
let activeGitOps = new Set<string>();
let activeInstalls = 0;

function safeError(err: unknown): string {
  if (err instanceof Error) {
    return sanitizeErrorMessage(err.message);
  }
  return 'An unexpected error occurred';
}

/**
 * Get the effective home directory for config lookups.
 * On native Windows with WSL, the auth config files live in the WSL home (e.g., /home/user).
 * When the Electron app runs on Windows, we need to access WSL's home via \\wsl.localhost\...
 */
async function getEffectiveHome(): Promise<string> {
  const { getPlatformMode } = await import('./utils/run-command');
  const mode = await getPlatformMode();
  if (mode === 'native-windows-wsl') {
    // Get the WSL home path and convert to Windows UNC path
    try {
      const wslHome = await runCommand('echo $HOME', { timeout: 3000 });
      const env = await environmentService.detectEnvironment();
      return environmentService.wslToWindows(wslHome, env.wslDistro)
        .replace(/\\/g, path.sep === '/' ? '/' : '\\');
    } catch {
      return os.homedir();
    }
  }
  return os.homedir();
}

export function registerIpcHandlers(): void {
  // --- Setup Assistant ---

  ipcMain.handle('setup:check-dependencies', async (): Promise<SetupCheckResult> => {
    const deps: DependencyStatus[] = [];

    // Detect package manager for distro-aware install commands
    const pm = await detectPackageManager();

    // Check Node.js — via runCommand so it finds tools inside WSL on Windows
    try {
      const version = await runCommand('node --version', { timeout: 5000 });
      deps.push({
        name: 'Node.js',
        command: 'node',
        installed: true,
        version,
        description: 'JavaScript runtime required to run AI coding agents.',
        installUrl: 'https://nodejs.org/',
        linuxInstallCommand: getInstallCommand('nodejs', pm),
      });
    } catch {
      deps.push({
        name: 'Node.js',
        command: 'node',
        installed: false,
        version: '',
        description: 'JavaScript runtime required to run AI coding agents.',
        installUrl: 'https://nodejs.org/',
        linuxInstallCommand: getInstallCommand('nodejs', pm),
      });
    }

    // Check Git
    try {
      const version = await runCommand('git --version', { timeout: 5000 });
      deps.push({
        name: 'Git',
        command: 'git',
        installed: true,
        version,
        description: 'Version control system for tracking code changes.',
        installUrl: 'https://git-scm.com/',
        linuxInstallCommand: getInstallCommand('git', pm),
      });
    } catch {
      deps.push({
        name: 'Git',
        command: 'git',
        installed: false,
        version: '',
        description: 'Version control system for tracking code changes.',
        installUrl: 'https://git-scm.com/',
        linuxInstallCommand: getInstallCommand('git', pm),
      });
    }

    // Check GitHub CLI (optional)
    try {
      const output = await runCommand('gh --version', { timeout: 5000 });
      const firstLine = output.split('\n')[0];
      deps.push({
        name: 'GitHub CLI',
        command: 'gh',
        installed: true,
        version: firstLine,
        description: 'Command-line tool for GitHub repo management and authentication.',
        installUrl: 'https://cli.github.com/',
        linuxInstallCommand: getInstallCommand('gh', pm),
      });
    } catch {
      deps.push({
        name: 'GitHub CLI',
        command: 'gh',
        installed: false,
        version: '',
        description: 'Command-line tool for GitHub repo management and authentication.',
        installUrl: 'https://cli.github.com/',
        linuxInstallCommand: getInstallCommand('gh', pm),
      });
    }

    // Detect platform
    const env = await environmentService.detectEnvironment();

    return {
      dependencies: deps,
      platform: env.platform,
      wslAvailable: env.wslAvailable,
    };
  });

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

  ipcMain.handle('projects:scan-folder', async (_, folderPath: unknown) => {
    const validPath = validateString(String(folderPath), 'folderPath');
    return projectDetector.detectProject(validPath);
  });

  ipcMain.handle('projects:import', async (_, input: unknown) => {
    const data = input as ImportProjectInput;
    if (!data?.name || !data?.path) throw new Error('name and path are required');
    const safePath = validateString(data.path, 'path');
    return projectService.importProject({ ...data, path: safePath });
  });

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
      await runCommand(config.versionCommand, { timeout: 5000 });
    } catch {
      throw new Error(
        `${config.displayName} is not installed. Please install it from the sidebar before launching.`,
      );
    }

    await agentService.startAgent(
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

    // Register exit callback for agent attribution tracking
    agentService.registerExitCallback(validId, agentType as import('../shared/types').AgentType, async (projPath, agType) => {
      try {
        const diff = await runCommand('git diff --name-only HEAD', { cwd: projPath, timeout: 5000 });
        const files = diff.split('\n').filter(Boolean);
        if (files.length > 0) {
          store.updateFileAttribution(validId, files, agType);
        }
      } catch {
        // not a git repo or no changes — ignore
      }
      const win = BrowserWindow.getAllWindows()[0];
      if (win && !win.isDestroyed()) {
        win.webContents.send('reasoningmap:files-changed', { projectId: validId });
      }
    });

    // Start auto-trigger: watch for file changes after the agent session,
    // then silently run a ghost test when editing stops.
    const gtSettings = store.getGhostTestSettings(validId);
    if (gtSettings.enabled) {
      ghostTestService.startAutoTrigger(
        validId,
        project.path,
        agentType as import('../shared/types').AgentType,
        gtSettings,
        (result) => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win && !win.isDestroyed()) {
            win.webContents.send('ghost-test:auto-result', { projectId: validId, result });
          }
        },
        (message) => {
          const win = BrowserWindow.getAllWindows()[0];
          if (win && !win.isDestroyed()) {
            win.webContents.send('ghost-test:progress', { projectId: validId, message });
          }
        },
      ).catch(() => {/* ignore watcher init errors */});
    }
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

    // Copilot installs as a gh extension — special path
    if (agentType === 'copilot') {
      result.nodeInstalled = true; // not Node-based
      try {
        const versionOutput = await runCommand('gh copilot --version', { timeout: 10000 });
        result.installed = true;
        result.version = versionOutput;
      } catch {
        return result;
      }
      try {
        await runCommand('gh auth status', { timeout: 5000 });
        result.authenticated = true;
      } catch {
        // not authenticated
      }
      return result;
    }

    // Check Node.js — via runCommand for cross-platform support
    try {
      await runCommand('node --version', { timeout: 5000 });
      result.nodeInstalled = true;
    } catch {
      return result;
    }

    // Check if CLI is installed + version
    try {
      const versionOutput = await runCommand(`${config.command} --version`, { timeout: 10000 });
      result.installed = true;
      result.version = versionOutput;
    } catch {
      return result;
    }

    // Check latest version from npm
    try {
      const latestVer = await runCommand(`npm view ${config.npmPackage} version`, { timeout: 10000 });
      result.latestVersion = latestVer;
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

    // Check authentication — check config dirs in the appropriate home
    try {
      const homeDir = await getEffectiveHome();
      const configDir = path.join(homeDir, `.${config.command}`);
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
        const homeDir = await getEffectiveHome();
        const credPath = path.join(homeDir, `.${config.command}.json`);
        await fs.access(credPath);
        result.authenticated = true;
      } catch {
        // not authenticated
      }
    }

    return result;
  });

  ipcMain.handle('agent:check-all-statuses', async () => {
    const types: AgentType[] = ['claude', 'gemini', 'codex', 'copilot'];
    const results: Record<string, AgentStatus> = {};

    // Check node once — via runCommand for cross-platform support
    let nodeInstalled = false;
    try {
      await runCommand('node --version', { timeout: 5000 });
      nodeInstalled = true;
    } catch {
      // no node
    }

    const homeDir = await getEffectiveHome();

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

      // Copilot uses gh CLI extension — special handling
      if (agentType === 'copilot') {
        try {
          const versionOutput = await runCommand('gh copilot --version', { timeout: 10000 });
          status.installed = true;
          status.version = versionOutput;
        } catch {
          results[agentType] = status;
          continue;
        }
        // Auth for copilot = gh auth status
        try {
          await runCommand('gh auth status', { timeout: 5000 });
          status.authenticated = true;
        } catch {
          // not authenticated
        }
        results[agentType] = status;
        continue;
      }

      if (!nodeInstalled) {
        results[agentType] = status;
        continue;
      }

      try {
        const versionOutput = await runCommand(`${config.command} --version`, { timeout: 10000 });
        status.installed = true;
        status.version = versionOutput;
      } catch {
        results[agentType] = status;
        continue;
      }

      // npm version check (best effort)
      try {
        const latestVer = await runCommand(`npm view ${config.npmPackage} version`, { timeout: 10000 });
        status.latestVersion = latestVer;
        if (status.version && status.latestVersion) {
          const m = status.version.match(/(\d+\.\d+\.\d+)/);
          if (m && m[1] !== status.latestVersion) {
            status.updateAvailable = true;
          }
        }
      } catch {
        // skip
      }

      // Auth check — use effective home (WSL home on Windows+WSL)
      try {
        const configDir = path.join(homeDir, `.${config.command}`);
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
          await fs.access(path.join(homeDir, `.${config.command}.json`));
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

    // GitHub Copilot installs via gh extension
    if (config.installMethod === 'gh-extension') {
      try {
        return await new Promise<{ success: boolean; error?: string }>((resolve) => {
          const child = spawnCommand('gh', ['extension', 'install', 'github/gh-copilot'], {
            env: { ...process.env },
          });
          let errorOutput = '';
          child.stdout?.on('data', (data: Buffer) => {
            win?.webContents.send('agent:install-progress', { line: data.toString() });
          });
          child.stderr?.on('data', (data: Buffer) => {
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
    }

    try {
      return await new Promise<{ success: boolean; error?: string }>((resolve) => {
        // Route through WSL on native Windows so npm installs inside WSL
        const child = spawnCommand('npm', ['install', '-g', config.npmPackage], {
          env: { ...process.env },
        });

        let errorOutput = '';

        child.stdout?.on('data', (data: Buffer) => {
          const line = data.toString();
          win?.webContents.send('agent:install-progress', { line });
        });

        child.stderr?.on('data', (data: Buffer) => {
          const line = data.toString();
          errorOutput += line;
          win?.webContents.send('agent:install-progress', { line });
        });

        child.on('close', async (code) => {
          if (code === 0) {
            activeInstalls--;
            resolve({ success: true });
          } else if (
            errorOutput.toLowerCase().includes('eacces') ||
            errorOutput.toLowerCase().includes('permission denied')
          ) {
            // Try ~/.npm-global fallback
            win?.webContents.send('agent:install-progress', {
              line: '\n⚠ Permission error. Setting up ~/.npm-global prefix...\n',
            });
            try {
              await new Promise<void>((res, rej) => {
                const setup = spawnCommand('bash', [
                  '-c',
                  'mkdir -p ~/.npm-global && npm config set prefix ~/.npm-global',
                ], { env: { ...process.env } });
                setup.on('close', (c) => c === 0 ? res() : rej(new Error('Setup failed')));
                setup.on('error', rej);
              });
              // Retry install with the new prefix
              const retry = spawnCommand('npm', ['install', '-g', config.npmPackage], {
                env: { ...process.env, npm_config_prefix: `${os.homedir()}/.npm-global` },
              });
              let retryError = '';
              retry.stdout?.on('data', (d: Buffer) => {
                win?.webContents.send('agent:install-progress', { line: d.toString() });
              });
              retry.stderr?.on('data', (d: Buffer) => {
                retryError += d.toString();
                win?.webContents.send('agent:install-progress', { line: d.toString() });
              });
              retry.on('close', (rc) => {
                activeInstalls--;
                if (rc === 0) {
                  win?.webContents.send('agent:install-progress', {
                    line: '\n✓ Installed to ~/.npm-global. Add to PATH: export PATH=~/.npm-global/bin:$PATH\n  (fish: fish_add_path ~/.npm-global/bin)\n',
                  });
                  resolve({ success: true });
                } else {
                  resolve({ success: false, error: sanitizeErrorMessage(retryError.slice(-500)) });
                }
              });
              retry.on('error', (err) => {
                activeInstalls--;
                resolve({ success: false, error: sanitizeErrorMessage(err.message) });
              });
            } catch {
              activeInstalls--;
              resolve({ success: false, error: sanitizeErrorMessage(errorOutput.slice(-500)) });
            }
          } else {
            activeInstalls--;
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

    // Copilot updates via gh extension upgrade
    if (config.installMethod === 'gh-extension') {
      try {
        return await new Promise<{ success: boolean; error?: string }>((resolve) => {
          const child = spawnCommand('gh', ['extension', 'upgrade', 'copilot'], {
            env: { ...process.env },
          });
          let errorOutput = '';
          child.stdout?.on('data', (d: Buffer) => {
            win?.webContents.send('agent:install-progress', { line: d.toString() });
          });
          child.stderr?.on('data', (d: Buffer) => {
            errorOutput += d.toString();
            win?.webContents.send('agent:install-progress', { line: d.toString() });
          });
          child.on('close', (code) => {
            activeInstalls--;
            if (code === 0) resolve({ success: true });
            else resolve({ success: false, error: sanitizeErrorMessage(errorOutput.slice(-500)) });
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
    }

    try {
      return await new Promise<{ success: boolean; error?: string }>((resolve) => {
        // Route through WSL on native Windows
        const child = spawnCommand('npm', ['install', '-g', `${config.npmPackage}@latest`], {
          env: { ...process.env },
        });

        let errorOutput = '';

        child.stdout?.on('data', (data: Buffer) => {
          win?.webContents.send('agent:install-progress', { line: data.toString() });
        });

        child.stderr?.on('data', (data: Buffer) => {
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
      // Route through WSL on native Windows
      const child = spawnCommand(config.loginCommand, [], {
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
      await runExecFile('open', ['-a', 'Terminal', validPath]);
    } else if (process.platform === 'win32') {
      await runExecFile('cmd', ['/c', 'start', 'cmd', '/k', 'cd', '/d', validPath]);
    } else {
      // Native Linux — detect available terminal emulator
      const terminal = await findTerminalEmulator();
      spawn(terminal, [], {
        cwd: validPath,
        detached: true,
        stdio: 'ignore',
      }).unref();
    }
  });

  ipcMain.handle('system:open-in-editor', async (_, dirPath: unknown) => {
    const validPath = validateString(dirPath, 'dirPath');
    try {
      await runExecFile('code', [validPath]);
    } catch {
      openUrl(`file://${validPath}`);
    }
  });

  ipcMain.handle('system:open-external', async (_, url: unknown) => {
    const validUrl = validateString(url, 'url', 2000);
    if (!isValidUrl(validUrl)) {
      throw new Error('Invalid URL: only http and https URLs are allowed');
    }
    openUrl(validUrl);
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
      const output = await runCommand('gh auth status 2>&1', { timeout: 10000 });
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
      await runCommand('gh --version', { timeout: 5000 });
      ghInstalled = true;
    } catch {
      return { authenticated: false, username: '', ghInstalled: false };
    }

    try {
      const output = await runCommand('gh auth status --hostname github.com 2>&1', { timeout: 10000 });
      const match = output.match(/account (\S+)/);
      return { authenticated: true, username: match?.[1] ?? '', ghInstalled };
    } catch {
      return { authenticated: false, username: '', ghInstalled };
    }
  });

  ipcMain.handle('github:login-start', async () => {
    return new Promise<{ code: string } | { error: string }>((resolve) => {
      // Route gh auth through WSL on native Windows
      const child = spawnCommand('gh', [
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
          child.stdin?.write('\n');
          resolve({ code: codeMatch[1] });
        }
      }

      child.stdout?.on('data', handleData);
      child.stderr?.on('data', handleData);

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
      await runCommand('GH_PROMPT_DISABLED=1 gh auth logout --hostname github.com', { timeout: 10000 });
    } catch {
      // may fail if not logged in
    }
  });

  ipcMain.handle('github:repo-count', async () => {
    try {
      const countOut = await runCommand("gh api user --jq '.public_repos + .total_private_repos'", { timeout: 10000 });
      const count = parseInt(countOut, 10);
      return isNaN(count) ? 0 : count;
    } catch {
      return 0;
    }
  });

  ipcMain.handle('github:clone-repo', async (event, url: unknown, destination: unknown) => {
    const validUrl = validateString(String(url), 'url');
    if (!isValidUrl(validUrl) && !/^git@[\w.-]+:[\w./-]+/.test(validUrl)) {
      throw new Error('Invalid repository URL');
    }
    const validDest = validateString(String(destination), 'destination');
    const win = BrowserWindow.fromWebContents(event.sender);
    await githubService.cloneRepo(validUrl, validDest, (data) => {
      win?.webContents.send('github:clone-progress', data);
    });
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

  // --- Chat ---

  ipcMain.handle('chat:get-providers', () => {
    const apiKeys = {
      openai: store.getApiKey('openai'),
      anthropic: store.getApiKey('anthropic'),
      google: store.getApiKey('google'),
    };
    return chatService.getProviders(apiKeys);
  });

  ipcMain.handle('chat:send', async (event, projectId: unknown, model: unknown, providerId: unknown, messages: unknown) => {
    const validModel = validateString(model, 'model', 200);
    const validProvider = validateString(providerId, 'providerId', 50);
    const validProjectId = projectId === null ? null : validateString(projectId, 'projectId');
    if (!Array.isArray(messages)) throw new Error('Invalid messages');

    const win = BrowserWindow.fromWebContents(event.sender);
    const apiKeys = {
      openai: store.getApiKey('openai'),
      anthropic: store.getApiKey('anthropic'),
      google: store.getApiKey('google'),
    };

    const { v4: uuidv4 } = await import('uuid');
    const messageId = uuidv4();
    let fullContent = '';

    await chatService.sendChatMessage(
      validProvider,
      validModel,
      messages as import('../shared/types').ChatMessage[],
      {
        onToken: (token) => {
          fullContent += token;
          win?.webContents.send('chat:token', { token, done: false, messageId });
        },
        onDone: () => {
          win?.webContents.send('chat:token', { token: '', done: true, messageId });
          // Save completed response to history
          const history = store.getChatHistory(validProjectId);
          const assistantMsg: import('../shared/types').ChatMessage = {
            id: messageId,
            role: 'assistant',
            content: fullContent,
            timestamp: new Date().toISOString(),
            model: validModel,
          };
          store.saveChatHistory(validProjectId, [
            ...(messages as import('../shared/types').ChatMessage[]),
            assistantMsg,
          ]);
        },
        onError: (err) => {
          win?.webContents.send('chat:token', {
            token: `\n\n*Error: ${sanitizeErrorMessage(err.message)}*`,
            done: true,
            messageId,
          });
        },
      },
      apiKeys,
    );
  });

  ipcMain.handle('chat:get-history', (_, projectId: unknown) => {
    const validId = projectId === null ? null : validateString(projectId, 'projectId');
    return store.getChatHistory(validId);
  });

  ipcMain.handle('chat:clear-history', (_, projectId: unknown) => {
    const validId = projectId === null ? null : validateString(projectId, 'projectId');
    store.clearChatHistory(validId);
  });

  ipcMain.handle('chat:set-api-key', (_, providerId: unknown, key: unknown) => {
    const validProvider = validateString(providerId, 'providerId', 50);
    const validKey = validateString(key, 'key', 500);
    store.setApiKey(validProvider, validKey);
  });

  ipcMain.handle('chat:test-connection', async (_, providerId: unknown) => {
    const validProvider = validateString(providerId, 'providerId', 50);
    const apiKeys = {
      openai: store.getApiKey('openai'),
      anthropic: store.getApiKey('anthropic'),
      google: store.getApiKey('google'),
    };
    return chatService.testConnection(validProvider, apiKeys);
  });

  // --- Vault ---

  function maskKey(apiKey: string): string {
    if (!apiKey) return '';
    if (apiKey.length <= 8) return '••••••••';
    return apiKey.slice(0, 4) + '••••••••••••' + apiKey.slice(-4);
  }

  function toMasked(entry: VaultEntry): VaultEntryMasked {
    const { apiKey, ...rest } = entry;
    return { ...rest, maskedKey: maskKey(apiKey), hasKey: !!apiKey };
  }

  ipcMain.handle('vault:list', (): VaultEntryMasked[] => {
    return store.getVaultEntries().map(toMasked);
  });

  ipcMain.handle('vault:save', async (_, input: unknown): Promise<VaultEntryMasked> => {
    if (!input || typeof input !== 'object') throw new Error('Invalid input');
    const data = input as {
      id?: string;
      provider: string;
      displayName: string;
      apiKey: string;
      baseUrl?: string;
    };

    const validProvider = validateString(data.provider, 'provider', 50);
    const validName = validateString(data.displayName, 'displayName', 100);
    const validKey = validateString(data.apiKey, 'apiKey', 500);
    const validBaseUrl = data.baseUrl ? validateString(data.baseUrl, 'baseUrl', 500) : undefined;

    const { v4: uuidv4 } = await import('uuid');

    // If updating, preserve existing metadata
    let existing: VaultEntry | undefined;
    if (data.id) {
      existing = store.getVaultEntries().find((e) => e.id === data.id);
    }

    const entry: VaultEntry = {
      id: data.id ?? uuidv4(),
      provider: validProvider,
      displayName: validName,
      apiKey: validKey,
      baseUrl: validBaseUrl,
      isValid: existing?.isValid ?? null,
      lastTested: existing?.lastTested ?? null,
      models: existing?.models ?? [],
    };

    const saved = store.saveVaultEntry(entry);
    return toMasked(saved);
  });

  ipcMain.handle('vault:delete', (_, id: unknown): void => {
    const validId = validateString(id, 'id');
    store.deleteVaultEntry(validId);
  });

  ipcMain.handle('vault:test', async (_, provider: unknown, apiKey?: unknown, baseUrl?: unknown): Promise<{ success: boolean; error?: string; models?: string[] }> => {
    const validProvider = validateString(provider, 'provider', 50);

    // If apiKey provided directly (for unsaved entries), use it;
    // otherwise look up from vault
    let keyToTest = '';
    if (apiKey && typeof apiKey === 'string') {
      keyToTest = validateString(apiKey, 'apiKey', 500);
    } else {
      const entries = store.getVaultEntries();
      const entry = entries.find((e) => e.provider === validProvider);
      keyToTest = entry?.apiKey ?? store.getApiKey(validProvider) ?? '';
    }

    const validBaseUrl = baseUrl && typeof baseUrl === 'string'
      ? validateString(baseUrl, 'baseUrl', 500)
      : undefined;

    const result = await vaultService.testConnection(validProvider, keyToTest, validBaseUrl);

    // Update isValid / lastTested in vault if entry exists
    const entries = store.getVaultEntries();
    const entry = entries.find((e) => e.provider === validProvider);
    if (entry) {
      store.saveVaultEntry({
        ...entry,
        isValid: result.success,
        lastTested: new Date().toISOString(),
        models: result.models ?? entry.models,
      });
    }

    return result;
  });

  // --- Deploy ---

  ipcMain.handle('deploy:start', async (event, options: unknown): Promise<void> => {
    if (!options || typeof options !== 'object') throw new Error('Invalid options');
    const opts = options as DeployOptions;
    const validPath = validateString(opts.projectPath, 'projectPath');
    const validMessage = validateString(opts.commitMessage || 'Initial commit from Claude Forge', 'commitMessage', 500);

    const win = BrowserWindow.fromWebContents(event.sender);

    const deployOpts: DeployOptions = {
      ...opts,
      projectPath: validPath,
      commitMessage: validMessage,
    };

    // Run deploy in background, streaming progress events
    deployService.deployToGitHub(deployOpts, (stepData) => {
      win?.webContents.send('deploy:progress', stepData);
    }).then((result) => {
      // Update project GitHub URL on success
      if (result.success && result.repoUrl && opts.projectId) {
        try {
          const project = store.getProjectById(opts.projectId);
          if (project) {
            const urlMatch = result.repoUrl.match(/github\.com\/([^/]+\/[^/]+)/);
            store.updateProject(opts.projectId, {
              githubUrl: result.repoUrl,
              githubRepo: urlMatch ? urlMatch[1] : project.githubRepo,
            });
          }
        } catch {
          // Non-fatal
        }
      }
      win?.webContents.send('deploy:done', result);
    }).catch((err) => {
      win?.webContents.send('deploy:done', {
        success: false,
        error: err instanceof Error ? sanitizeErrorMessage(err.message) : 'Deploy failed',
      });
    });
  });

  ipcMain.handle('deploy:force-push', async (_, projectPath: unknown): Promise<{ success: boolean; repoUrl?: string; error?: string }> => {
    const validPath = validateString(projectPath, 'projectPath');
    return deployService.forcePush(validPath);
  });

  // --- Vibe Bundles ---

  ipcMain.handle('vibe:export', async (_, options: unknown) => {
    if (!options || typeof options !== 'object') throw new Error('Invalid options');
    return vibeService.exportVibe(options as VibeExportOptions);
  });

  ipcMain.handle('vibe:pick-and-preview', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open .vibe Bundle',
      filters: [{ name: 'Vibe Bundle', extensions: ['vibe'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const preview = await vibeService.previewVibe(filePath);
    return { filePath, preview };
  });

  ipcMain.handle('vibe:import', async (_, filePath: unknown, mode: unknown, projectPath: unknown, projectId: unknown, projectName: unknown) => {
    const vFilePath = validateString(filePath, 'filePath');
    const vMode = validateString(mode, 'mode') as 'new' | 'merge';
    const vProjectPath = validateString(projectPath, 'projectPath');
    const vProjectId = projectId ? validateString(projectId, 'projectId') : undefined;
    const vProjectName = projectName ? validateString(projectName, 'projectName', 100) : undefined;
    return vibeService.importVibe(vFilePath, vMode, vProjectPath, vProjectId, vProjectName);
  });

  // --- Snapshots ---

  ipcMain.handle('snapshot:export', async (_, options: unknown) => {
    if (!options || typeof options !== 'object') throw new Error('Invalid options');
    const opts = options as import('../shared/types').SnapshotExportOptions;
    const validId = validateString(opts.projectId, 'projectId');
    return snapshotService.exportSnapshot({ ...opts, projectId: validId });
  });

  ipcMain.handle('snapshot:estimate-size', async (_, projectId: unknown, includeSource: unknown, includeGit: unknown) => {
    const validId = validateString(projectId, 'projectId');
    return snapshotService.estimateSize(validId, Boolean(includeSource), Boolean(includeGit));
  });

  ipcMain.handle('snapshot:pick-and-preview', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open .cfsnap Snapshot',
      filters: [{ name: 'Claude Forge Snapshot', extensions: ['cfsnap'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const preview = await snapshotService.previewSnapshot(filePath);
    return { filePath, preview };
  });

  ipcMain.handle('snapshot:import', async (_, filePath: unknown, projectPath: unknown, projectName: unknown) => {
    const vFilePath = validateString(filePath, 'filePath');
    const vProjectPath = validateString(projectPath, 'projectPath');
    const vProjectName = projectName ? validateString(projectName, 'projectName', 100) : undefined;
    return snapshotService.importSnapshot(vFilePath, vProjectPath, vProjectName);
  });

  // --- Ghost Tests ---

  ipcMain.handle('ghost-test:run', async (event, projectId: unknown, projectPath: unknown, agentType: unknown) => {
    const vProjectId = validateString(projectId, 'projectId');
    const vProjectPath = validateString(projectPath, 'projectPath');
    if (!isValidAgentType(agentType)) throw new Error('Invalid agent type');

    const settings = store.getGhostTestSettings(vProjectId);

    let command = settings.customCommand.trim();
    if (!command) {
      command = await ghostTestService.detectTestCommand(vProjectPath);
    }
    if (!command) {
      throw new Error('No test command detected. Set one in Ghost Test settings.');
    }

    const onProgress = (message: string) => {
      event.sender.send('ghost-test:progress', { projectId: vProjectId, message });
    };

    try {
      return await ghostTestService.runGhostTestWithRetry(
        vProjectId,
        vProjectPath,
        command,
        settings,
        agentType as import('../shared/types').AgentType,
        onProgress,
      );
    } catch (err) {
      throw new Error(safeError(err));
    }
  });

  ipcMain.handle('ghost-test:get-history', (_, projectId: unknown) => {
    const vId = validateString(projectId, 'projectId');
    return store.getGhostTestHistory(vId);
  });

  ipcMain.handle('ghost-test:get-settings', (_, projectId: unknown) => {
    const vId = validateString(projectId, 'projectId');
    return store.getGhostTestSettings(vId);
  });

  ipcMain.handle('ghost-test:update-settings', (_, projectId: unknown, settings: unknown) => {
    const vId = validateString(projectId, 'projectId');
    if (!settings || typeof settings !== 'object') throw new Error('Invalid settings');
    return store.saveGhostTestSettings(vId, settings as Partial<import('../shared/types').GhostTestSettings>);
  });

  ipcMain.handle('ghost-test:detect-command', async (_, projectPath: unknown) => {
    const vPath = validateString(projectPath, 'projectPath');
    return ghostTestService.detectTestCommand(vPath);
  });

  ipcMain.handle('ghost-test:get-all-last-results', () => {
    return store.getAllLastGhostTestResults();
  });

  // --- Reasoning Map ---

  ipcMain.handle('reasoningmap:generate', async (_, projectId: unknown, projectPath: unknown) => {
    const vId = validateString(projectId, 'projectId');
    const vPath = validateString(projectPath, 'projectPath');
    const map = await reasoningMapService.generateReasoningMap(vId, vPath);
    store.setReasoningMap(vId, map);
    return map;
  });

  ipcMain.handle('reasoningmap:get', async (_, projectId: unknown) => {
    const vId = validateString(projectId, 'projectId');
    const cached = store.getReasoningMap(vId);
    if (!cached) return null;
    // Check staleness against project path
    const project = store.getProjectById(vId);
    if (project) {
      const stale = await reasoningMapService.isStale(project.path, cached.lastGenerated);
      if (stale) return null; // caller will regenerate
    }
    return cached;
  });

  ipcMain.handle('reasoningmap:get-attribution', (_, projectId: unknown) => {
    const vId = validateString(projectId, 'projectId');
    return store.getFileAttribution(vId);
  });
}
