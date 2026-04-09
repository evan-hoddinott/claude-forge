#!/bin/bash
set -e
cd ~/Projects/claude-forge

echo "⚒ Pulling latest changes..."
git pull

echo "⚒ Installing dependencies..."
npm install

echo "⚒ Building app..."
npm run build:dist

echo "⚒ Packaging AppImage..."
npx electron-builder --linux --publish never

echo "⚒ Stopping old instance..."
pkill -f claude-forge 2>/dev/null || true
pkill -f Claude-Forge 2>/dev/null || true
sleep 1

echo "⚒ Replacing installed AppImage..."
rm -f ~/Applications/Claude-Forge-*.AppImage
cp release/Claude-Forge-*.AppImage ~/Applications/
chmod +x ~/Applications/Claude-Forge-*.AppImage

echo "⚒ Launching new version..."
nohup ~/Applications/Claude-Forge-*.AppImage > /dev/null 2>&1 &
disown

echo ""
echo "✅ Claude Forge updated and launched!"
