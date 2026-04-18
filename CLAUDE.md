# Caboo

## What This Is
Caboo is a multi-agent AI coding orchestrator. Users can view
all their projects in a dashboard, create new projects with flexible inputs,
launch Claude Code / Gemini CLI / OpenAI Codex on them, and connect them to
GitHub repos.

## Tech Stack
- Electron 41 (via electron-forge with Vite plugin)
- React 19 with TypeScript (renderer process)
- Tailwind CSS 4 for styling
- Framer Motion for animations
- Monaco Editor for file preview
- electron-store for local data persistence (encrypted at rest)
- Node.js child_process for spawning AI agent CLIs and GitHub CLI

## Architecture
- src/main/ → Electron main process (Node.js)
  - index.ts: Main entry, creates BrowserWindow
  - ipc-handlers.ts: All IPC handler registrations
  - preload.ts: contextBridge API exposure
  - services/: Business logic (project CRUD, GitHub ops, Claude Code launcher)
  - store.ts: electron-store wrapper
- src/renderer/ → React frontend
  - App.tsx: Root component with routing
  - pages/: Dashboard, ProjectDetail, Settings
  - components/: Reusable UI (Sidebar, ProjectCard, NewProjectWizard, CommandPalette)
  - hooks/: useAPI, useProjects, useGitHub
  - styles/: Global CSS, Tailwind config
- src/shared/ → Shared TypeScript types (Project, ProjectInput, etc.)

## Design Direction
Refined dark theme inspired by Linear/Raycast. Glassmorphism cards,
smooth staggered animations, distinctive typography (not Inter/Roboto),
custom frameless titlebar, command palette (Cmd+K).

## Key Features
- Multi-agent support: Claude Code, Gemini CLI, OpenAI Codex
- Flexible project inputs (users add any key-value inputs they want)
- GitHub integration: create new repo OR link existing, user chooses each time
- Launch agents in external terminal for any project
- Context file auto-generation (CLAUDE.md, GEMINI.md, codex.md) from project inputs
- Full file explorer with Monaco preview, git status, search
- Command palette (Cmd/Ctrl+K), keyboard shortcuts, context menus
- Setup wizard with dependency checking and interactive onboarding tutorial
- Simple Mode / Developer Mode toggle for terminology
- Data import/export, encrypted local storage
- Custom frameless titlebar, dark theme (Linear/Raycast inspired)
- WSL2 support with platform-specific path handling

## Commands
- npm run start → Development with hot reload
- npm run package → Package without installers (for testing)
- npm run make → Production build with platform installers
- npm run make:win / make:linux → electron-builder platform builds
- npm run lint → Lint
- npm run icons → Regenerate icon assets from SVG

## Coding Standards
- TypeScript strict mode everywhere
- Functional React components with hooks only
- Tailwind CSS utility classes (no CSS modules, no styled-components)
- Framer Motion for all animations
- All IPC calls go through typed hooks (useAPI pattern)
- Error boundaries around major page sections

## Version 1.0.0
Completed features for initial release:
- Dashboard with project cards, search, and empty state
- New Project wizard with template selection and multi-step flow
- Project detail page with Overview, File Explorer, Settings, and Agents tabs
- Full file explorer: tree view, flat view, search, Monaco preview, git status
- Context file regeneration from file explorer
- Sidebar with project navigation and agent connection status
- Settings page: experience mode, general, environment, GitHub, agents, file explorer, accessibility, data
- Setup wizard checking Node.js, Git, and GitHub CLI
- Interactive 5-step onboarding tutorial
- Command palette with fuzzy search
- Agent install/update/login from sidebar and settings
- Auto-updater for production builds
- Electron security hardening (fuses, CSP, sandbox, path validation)
