import { exec } from 'node:child_process';
import { platform } from 'node:os';
import { existsSync, readFileSync } from 'node:fs';

let _isWSL: boolean | null = null;

function isWSL(): boolean {
  if (_isWSL === null) {
    try {
      _isWSL =
        existsSync('/proc/version') &&
        readFileSync('/proc/version', 'utf8').toLowerCase().includes('microsoft');
    } catch {
      _isWSL = false;
    }
  }
  return _isWSL;
}

export function openUrl(url: string): void {
  if (isWSL()) {
    // WSL: use cmd.exe to open URL in Windows default browser
    exec(`cmd.exe /c start "" "${url.replace(/&/g, '^&')}"`);
  } else if (platform() === 'win32') {
    exec(`start "" "${url}"`);
  } else if (platform() === 'darwin') {
    exec(`open "${url}"`);
  } else {
    // Native Linux
    exec(`xdg-open "${url}"`);
  }
}
