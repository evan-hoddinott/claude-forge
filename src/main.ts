import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './main/ipc-handlers';
import { init as initRunCommand } from './main/utils/run-command';

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
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // --- Content Security Policy ---
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self'",
            "img-src 'self' https://github.com https://avatars.githubusercontent.com data:",
            "connect-src 'self' https://registry.npmjs.org",
          ].join('; '),
        ],
      },
    });
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

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (MAIN_WINDOW_VITE_DEV_SERVER_URL && url.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL)) {
      return; // Allow dev server navigation
    }
    event.preventDefault();
  });

  // Prevent new windows from being opened
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  // Initialize auto-updater in production builds only
  if (app.isPackaged) {
    import('./main/auto-updater').then(({ initAutoUpdater }) => {
      initAutoUpdater(mainWindow);
    }).catch((err) => {
      console.error('Auto-updater init failed:', err);
    });
  }
};

app.on('ready', async () => {
  // Initialize platform detection before anything else —
  // spawnCommand reads _platformMode synchronously, so it must be cached first
  await initRunCommand();
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
