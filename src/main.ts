import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main/ipc-handlers';

if (started) {
  app.quit();
}

// WSL2 compatibility: disable GPU acceleration
const isWSL = process.platform === 'linux' && (
  process.env.WSL_DISTRO_NAME != null || process.env.WSLENV != null
);
if (isWSL || process.env.ELECTRON_DISABLE_GPU) {
  app.disableHardwareAcceleration();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    icon: path.join(__dirname, '../../assets/icons/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // --- Window control IPC ---
  ipcMain.handle('window:minimize', () => mainWindow.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow.close());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Initialize auto-updater in production builds
  if (!MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    import('./main/auto-updater').then(({ initAutoUpdater }) => {
      initAutoUpdater(mainWindow);
    }).catch(() => {
      // Auto-updater not available in dev
    });
  }
};

app.on('ready', () => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
