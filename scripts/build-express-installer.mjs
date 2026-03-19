#!/usr/bin/env node

/**
 * Build Express Installer for Claude Forge
 *
 * Downloads bundled dependencies (Node.js LTS, Git, GitHub CLI) and packages
 * them alongside the Electron app for a single-file installer experience.
 *
 * Usage:
 *   node scripts/build-express-installer.mjs --platform=win
 *   node scripts/build-express-installer.mjs --platform=linux
 *
 * The express installer:
 *   1. Detects what's already installed on the user's system
 *   2. Only installs what's MISSING
 *   3. Shows a checklist during install with progress
 *   4. On Windows, optionally offers WSL setup
 */

import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as https from 'node:https';
import { pipeline } from 'node:stream/promises';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEPS = {
  node: {
    name: 'Node.js',
    version: '20.18.1', // LTS
    win: {
      url: 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-x64.msi',
      filename: 'node-v20.18.1-x64.msi',
    },
    linux: {
      url: 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.xz',
      filename: 'node-v20.18.1-linux-x64.tar.xz',
    },
  },
  git: {
    name: 'Git',
    version: '2.47.1',
    win: {
      url: 'https://github.com/git-for-windows/git/releases/download/v2.47.1.windows.1/Git-2.47.1-64-bit.exe',
      filename: 'Git-2.47.1-64-bit.exe',
    },
    linux: {
      // On Linux, we install via package manager — no binary to bundle
      url: null,
      filename: null,
    },
  },
  gh: {
    name: 'GitHub CLI',
    version: '2.63.2',
    win: {
      url: 'https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_windows_amd64.msi',
      filename: 'gh_2.63.2_windows_amd64.msi',
    },
    linux: {
      url: 'https://github.com/cli/cli/releases/download/v2.63.2/gh_2.63.2_linux_amd64.deb',
      filename: 'gh_2.63.2_linux_amd64.deb',
    },
  },
};

const BUNDLE_DIR = path.resolve('dist/express-bundle');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--(\w+)=(.+)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

/**
 * Download a file with redirect following.
 */
function download(url, dest) {
  return new Promise((resolve, reject) => {
    function doGet(targetUrl, redirectCount = 0) {
      if (redirectCount > 5) {
        reject(new Error('Too many redirects'));
        return;
      }
      https.get(targetUrl, (res) => {
        // Follow redirects
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doGet(res.headers.location, redirectCount + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
      }).on('error', reject);
    }
    doGet(url);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ---------------------------------------------------------------------------
// Windows NSIS install script generation
// ---------------------------------------------------------------------------

function generateNsisScript() {
  return `; Claude Forge Express Installer
; Auto-generated — do not edit manually.

!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "Claude Forge"
OutFile "ClaudeForge-Express-Setup.exe"
InstallDir "$PROGRAMFILES\\Claude Forge"
RequestExecutionLevel admin

; Modern UI pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

Section "Claude Forge" SecMain
  SetOutPath $INSTDIR
  ; Copy main app files
  File /r "app\\*.*"
SectionEnd

Section "Dependencies" SecDeps
  DetailPrint "Checking installed dependencies..."

  ; Check Node.js
  nsExec::ExecToStack 'node --version'
  Pop $0
  \${If} $0 != 0
    DetailPrint "Installing Node.js..."
    SetOutPath $TEMP
    File "deps\\${DEPS.node.win.filename}"
    ExecWait 'msiexec /i "$TEMP\\${DEPS.node.win.filename}" /qn' $0
    DetailPrint "Node.js installed."
  \${Else}
    DetailPrint "Node.js already installed."
  \${EndIf}

  ; Check Git
  nsExec::ExecToStack 'git --version'
  Pop $0
  \${If} $0 != 0
    DetailPrint "Installing Git..."
    SetOutPath $TEMP
    File "deps\\${DEPS.git.win.filename}"
    ExecWait '"$TEMP\\${DEPS.git.win.filename}" /VERYSILENT /NORESTART' $0
    DetailPrint "Git installed."
  \${Else}
    DetailPrint "Git already installed."
  \${EndIf}

  ; Check GitHub CLI
  nsExec::ExecToStack 'gh --version'
  Pop $0
  \${If} $0 != 0
    DetailPrint "Installing GitHub CLI..."
    SetOutPath $TEMP
    File "deps\\${DEPS.gh.win.filename}"
    ExecWait 'msiexec /i "$TEMP\\${DEPS.gh.win.filename}" /qn' $0
    DetailPrint "GitHub CLI installed."
  \${Else}
    DetailPrint "GitHub CLI already installed."
  \${EndIf}
SectionEnd
`;
}

// ---------------------------------------------------------------------------
// Linux install script generation
// ---------------------------------------------------------------------------

function generateLinuxInstallScript() {
  return `#!/bin/bash
# Claude Forge Express Installer — First-Launch Dependency Setup
# This script is run on first launch if dependencies are missing.

set -e

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
DEPS_DIR="$SCRIPT_DIR/deps"

echo "========================================"
echo "  Claude Forge — Dependency Setup"
echo "========================================"
echo ""

install_count=0
skip_count=0

# Check Node.js
if command -v node &>/dev/null; then
  echo "[OK] Node.js $(node --version) already installed"
  ((skip_count++))
else
  echo "[INSTALL] Node.js not found"
  if [ -f /etc/debian_version ]; then
    echo "  Installing via apt..."
    sudo apt-get update -qq && sudo apt-get install -y -qq nodejs npm
  elif [ -f /etc/fedora-release ]; then
    echo "  Installing via dnf..."
    sudo dnf install -y nodejs npm
  else
    echo "  Please install Node.js manually: https://nodejs.org"
  fi
  ((install_count++))
fi

# Check Git
if command -v git &>/dev/null; then
  echo "[OK] Git $(git --version | head -1) already installed"
  ((skip_count++))
else
  echo "[INSTALL] Git not found"
  if [ -f /etc/debian_version ]; then
    sudo apt-get install -y -qq git
  elif [ -f /etc/fedora-release ]; then
    sudo dnf install -y git
  else
    echo "  Please install Git manually: https://git-scm.com"
  fi
  ((install_count++))
fi

# Check GitHub CLI
if command -v gh &>/dev/null; then
  echo "[OK] GitHub CLI $(gh --version | head -1) already installed"
  ((skip_count++))
else
  echo "[INSTALL] GitHub CLI not found"
  if [ -f "$DEPS_DIR/${DEPS.gh.linux.filename}" ]; then
    echo "  Installing from bundled .deb..."
    sudo dpkg -i "$DEPS_DIR/${DEPS.gh.linux.filename}" || sudo apt-get install -f -y
  elif [ -f /etc/debian_version ]; then
    echo "  Installing via apt..."
    sudo apt-get install -y -qq gh || echo "  gh not in apt repos — install from https://cli.github.com"
  else
    echo "  Please install GitHub CLI: https://cli.github.com"
  fi
  ((install_count++))
fi

echo ""
echo "Setup complete: $install_count installed, $skip_count already present."
echo "Starting Claude Forge..."
`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();
  const platform = args.platform || 'win';

  if (!['win', 'linux'].includes(platform)) {
    console.error('Usage: node scripts/build-express-installer.mjs --platform=win|linux');
    process.exit(1);
  }

  console.log(`\nBuilding Express installer for ${platform}...\n`);

  // Create bundle directories
  const depsDir = path.join(BUNDLE_DIR, 'deps');
  fs.mkdirSync(depsDir, { recursive: true });

  // Download dependencies
  for (const [key, dep] of Object.entries(DEPS)) {
    const platInfo = dep[platform];
    if (!platInfo?.url) {
      console.log(`  [skip] ${dep.name} — installed via package manager on ${platform}`);
      continue;
    }

    const destPath = path.join(depsDir, platInfo.filename);

    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      console.log(`  [cached] ${dep.name} v${dep.version} (${formatSize(stat.size)})`);
      continue;
    }

    console.log(`  [download] ${dep.name} v${dep.version}...`);
    console.log(`    URL: ${platInfo.url}`);

    try {
      await download(platInfo.url, destPath);
      const stat = fs.statSync(destPath);
      console.log(`    Done (${formatSize(stat.size)})`);
    } catch (err) {
      console.error(`    FAILED: ${err.message}`);
      console.error(`    You can manually download from: ${platInfo.url}`);
      console.error(`    Place the file at: ${destPath}`);
    }
  }

  // Generate platform-specific install scripts
  if (platform === 'win') {
    const nsisScript = generateNsisScript();
    const nsisPath = path.join(BUNDLE_DIR, 'installer.nsi');
    fs.writeFileSync(nsisPath, nsisScript, 'utf-8');
    console.log(`\n  Generated NSIS script: ${nsisPath}`);
    console.log('  To build the Windows installer:');
    console.log('    1. Run "npm run build:dist" to build the app');
    console.log('    2. Copy the built app to dist/express-bundle/app/');
    console.log('    3. Compile with: makensis dist/express-bundle/installer.nsi');
  } else {
    const script = generateLinuxInstallScript();
    const scriptPath = path.join(BUNDLE_DIR, 'install-deps.sh');
    fs.writeFileSync(scriptPath, script, { mode: 0o755 });
    console.log(`\n  Generated install script: ${scriptPath}`);
    console.log('  This script is bundled with the AppImage and runs on first launch.');
  }

  // Calculate total bundle size
  let totalSize = 0;
  for (const file of fs.readdirSync(depsDir)) {
    totalSize += fs.statSync(path.join(depsDir, file)).size;
  }
  console.log(`\n  Total dependency bundle: ${formatSize(totalSize)}`);
  console.log('  Done!\n');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
