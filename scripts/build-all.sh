#!/bin/bash
set -e

echo "========================================"
echo "  Caboo - Building all platforms"
echo "========================================"
echo ""

# Check for GH_TOKEN
if [ -z "$GH_TOKEN" ]; then
  echo "ERROR: GH_TOKEN not set."
  echo "Run:   export GH_TOKEN=\$(gh auth token)"
  echo ""
  echo "Or create a Personal Access Token at:"
  echo "  GitHub > Settings > Developer Settings > Personal Access Tokens"
  echo "  (needs 'repo' scope)"
  exit 1
fi

# Get current version
VERSION=$(node -p "require('./package.json').version")
echo "Version: $VERSION"
echo ""

# Build the Vite bundles first
echo "Building Vite bundles..."
npm run build:dist
echo "Vite build complete."
echo ""

# Track results
BUILT=""
SKIPPED=""

# Build Linux (always works in WSL)
echo "--- Linux (AppImage + deb) ---"
npx electron-builder --linux --publish always
BUILT="$BUILT Linux"
echo "Linux build complete."
echo ""

# Build Windows (needs Wine in WSL)
echo "--- Windows (NSIS installer) ---"
if command -v wine64 &> /dev/null; then
  npx electron-builder --win --publish always
  BUILT="$BUILT Windows"
  echo "Windows build complete."
else
  echo "WARNING: Wine not found. Install with: sudo apt install wine64 -y"
  echo "Skipping Windows build."
  echo "Alternative: run 'npm run publish:win' from PowerShell on Windows."
  SKIPPED="$SKIPPED Windows(needs-Wine)"
fi
echo ""

# Build macOS (zip from Linux, dmg only on Mac)
echo "--- macOS ---"
npx electron-builder --mac --x64 --arm64 --publish always 2>&1 || {
  echo "WARNING: macOS build had issues (normal from Linux)."
  echo "For proper .dmg, build on a Mac with: npm run publish:mac"
  SKIPPED="$SKIPPED macOS(needs-Mac)"
}
echo ""

# Summary
echo "========================================"
echo "  Build Summary"
echo "========================================"
echo "  Built:   $BUILT"
[ -n "$SKIPPED" ] && echo "  Skipped: $SKIPPED"
echo ""
echo "Check GitHub Releases:"
echo "  https://github.com/evan-hoddinott/claude-forge/releases"
echo ""
echo "Done!"
