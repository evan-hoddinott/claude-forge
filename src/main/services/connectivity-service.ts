import type { BrowserWindow } from 'electron';

let lastOnline: boolean | null = null;

export function startConnectivityMonitoring(win: BrowserWindow): void {
  const check = async () => {
    let online = false;
    try {
      const res = await fetch('https://dns.google', {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      });
      online = res.ok;
    } catch {
      online = false;
    }

    if (online !== lastOnline) {
      lastOnline = online;
      if (!win.isDestroyed()) {
        win.webContents.send('connectivity:status', { online });
      }
    }
  };

  check(); // immediate first check
  setInterval(check, 30_000);
}
