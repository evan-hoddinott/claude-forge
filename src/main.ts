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

// Resolve icon path — works in both dev and packaged (ASAR) mode
function getIconPath(): string | undefined {
  if (app.isPackaged) {
    const iconPath = path.join(process.resourcesPath, 'icon.png');
    try {
      require('node:fs').accessSync(iconPath);
      return iconPath;
    } catch {
      return undefined;
    }
  }
  return path.join(__dirname, '../../assets/icons/icon.png');
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0a0f',
    icon: getIconPath(),
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

  // Log renderer load failures for debugging
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error(`Renderer failed to load: ${errorCode} ${errorDescription}`);
  });

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
