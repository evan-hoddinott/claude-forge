# build-win.ps1 — Build Windows NSIS installer from PowerShell on Windows
# Usage: Open PowerShell, cd to the project root, then run:
#   .\scripts\build-win.ps1
#
# Prerequisites:
#   - Node.js and npm installed on Windows
#   - npm install already run (node_modules present)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Claude Forge - Windows NSIS Build"     -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check node_modules
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
}

# Get version
$version = (node -p "require('./package.json').version")
Write-Host "Version: $version"
Write-Host ""

# Set GH_TOKEN if gh CLI is available (optional, only needed for --publish always)
if (Get-Command gh -ErrorAction SilentlyContinue) {
    $env:GH_TOKEN = (gh auth token 2>$null)
    if ($env:GH_TOKEN) {
        Write-Host "GH_TOKEN set from gh CLI" -ForegroundColor Green
    }
}

# Step 1: Build Vite bundles
Write-Host "Building Vite bundles..." -ForegroundColor Yellow
npm run build:dist
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Vite build failed" -ForegroundColor Red
    exit 1
}
Write-Host "Vite build complete." -ForegroundColor Green
Write-Host ""

# Step 2: Build Windows NSIS installer
Write-Host "Building Windows NSIS installer..." -ForegroundColor Yellow
npx electron-builder --win --publish never
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: electron-builder failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Show results
$setupExe = Get-ChildItem -Path "release" -Filter "Claude-Forge-Setup-*.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($setupExe) {
    $sizeMB = [math]::Round($setupExe.Length / 1MB, 2)
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Build Successful!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  File: $($setupExe.FullName)"
    Write-Host "  Size: $sizeMB MB"
    Write-Host ""
} else {
    Write-Host "WARNING: Setup .exe not found in release/" -ForegroundColor Yellow
    Write-Host "Check release/ directory manually."
}
