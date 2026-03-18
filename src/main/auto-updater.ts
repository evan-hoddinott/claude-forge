import { autoUpdater } from 'electron-updater';
import { BrowserWindow, dialog } from 'electron';
import log from 'electron-log';

/**
 * Initializes the auto-updater for production builds.
 * Checks for updates on startup and notifies the user when one is available.
 */
export function initAutoUpdater(mainWindow: BrowserWindow): void {
  // Configure logging
  autoUpdater.logger = log;

  // Don't auto-download — let the user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.version}) of Claude Forge is available.`,
        detail: 'Would you like to download it now?',
        buttons: ['Download', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate();
        }
      });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Ready',
        message: 'Update downloaded. The app will restart to apply the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err);
  });

  // Check for updates after a short delay to not block startup
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Update check failed:', err);
    });
  }, 5000);
}
