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
pkill -f caboo 2>/dev/null || true
pkill -f Caboo 2>/dev/null || true
sleep 1

echo "⚒ Replacing installed AppImage..."
rm -f ~/Applications/Caboo-*.AppImage
cp release/Caboo-*.AppImage ~/Applications/
chmod +x ~/Applications/Caboo-*.AppImage

echo "⚒ Launching new version..."
nohup ~/Applications/Caboo-*.AppImage > /dev/null 2>&1 &
disown

echo ""
echo "✅ Caboo updated and launched!"
