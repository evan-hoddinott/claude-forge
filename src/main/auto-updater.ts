import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, ipcMain } from 'electron';
import log from 'electron-log';

export interface UpdateStatus {
  status: 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error';
  version?: string;
  currentVersion?: string;
  releaseNotes?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

let mainWindow: BrowserWindow | null = null;

function sendStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send('update-status', status);
}

/**
 * Initializes the auto-updater for production builds.
 * Sends update lifecycle events to the renderer via IPC.
 */
export function initAutoUpdater(win: BrowserWindow): void {
  mainWindow = win;

  // Configure
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // --- Event handlers ---

  autoUpdater.on('checking-for-update', () => {
    sendStatus({ status: 'checking' });
  });

  autoUpdater.on('update-available', (info) => {
    sendStatus({
      status: 'available',
      version: info.version,
      currentVersion: app.getVersion(),
      releaseNotes: typeof info.releaseNotes === 'string'
        ? info.releaseNotes
        : Array.isArray(info.releaseNotes)
          ? info.releaseNotes.map((n) => n.note).join('\n')
          : undefined,
    });
  });

  autoUpdater.on('update-not-available', () => {
    sendStatus({ status: 'up-to-date', currentVersion: app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({
      status: 'downloading',
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({
      status: 'ready',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
    sendStatus({
      status: 'error',
      message: err.message,
    });
  });

  // --- IPC handlers ---

  ipcMain.handle('updater:check-now', async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (err) {
      log.error('Manual update check failed:', err);
    }
  });

  ipcMain.handle('updater:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      log.error('Update download failed:', err);
    }
  });

  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('updater:get-version', () => {
    return app.getVersion();
  });

  // --- Auto-check schedule ---
  // Disabled until the GitHub repo is public and has published releases.
  // Uncomment the blocks below once releases are available.
  //
  // // Check after a 10-second delay so the app loads first
  // setTimeout(() => {
  //   autoUpdater.checkForUpdates().catch((err) => {
  //     log.error('Startup update check failed:', err);
  //   });
  // }, 10_000);
  //
  // // Check every 4 hours
  // setInterval(() => {
  //   autoUpdater.checkForUpdates().catch((err) => {
  //     log.error('Periodic update check failed:', err);
  //   });
  // }, 4 * 60 * 60 * 1000);
}
