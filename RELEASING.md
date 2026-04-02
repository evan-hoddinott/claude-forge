# Releasing Claude Forge

## Quick release (one command)

```bash
# Bug fix release (1.0.0 -> 1.0.1)
npm run release:patch

# New feature release (1.0.0 -> 1.1.0)
npm run release:minor

# Major release (1.0.0 -> 2.0.0)
npm run release:major
```

## What happens automatically

1. Version number bumps in package.json
2. Git commit + tag created
3. Installers built for Windows, Linux, macOS
4. Everything uploaded to GitHub Releases
5. Users' apps detect the update and show a notification
6. Users click "Download" then "Restart" to update

## Manual steps (if one-command fails)

```bash
# 1. Bump version
npm version patch  # or minor/major

# 2. Push the tag
git push origin master --tags

# 3. Build specific platform
npm run publish:win    # Windows only
npm run publish:linux  # Linux only
npm run publish:mac    # macOS only
npm run publish:all    # All platforms

# 4. Check it worked
gh release list
```

## Build locally without publishing

```bash
npm run dist:linux   # Linux AppImage + .deb
npm run dist:win     # Windows NSIS installer
npm run dist:mac     # macOS .dmg
npm run dist:all     # All platforms
```

## Smart build script

```bash
npm run ship
# Builds all platforms, skips those missing dependencies (Wine, macOS)
```

## Requirements

- **GH_TOKEN** set: `export GH_TOKEN=$(gh auth token)`
- **Wine** installed for Windows builds from WSL: `sudo apt install wine64`
- **macOS** `.dmg` requires building on a Mac
- Linux builds work natively in WSL

## How users get updates

- App checks GitHub Releases on launch + every 4 hours
- Shows a non-blocking banner when update available
- User clicks Download -> Restart -> done
- **.AppImage** (Linux): auto-updates by replacing the file
- **.exe** (Windows): auto-updates via NSIS
- **.deb** (Linux): does NOT auto-update, user must re-download
- **.dmg** (macOS): auto-updates via Squirrel.Mac
