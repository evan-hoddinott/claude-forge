# Claude Forge

## What This Is
An Electron desktop app for managing Claude Code projects. Users can view all
their projects in a dashboard, create new projects with flexible inputs, launch
Claude Code on them, and connect them to GitHub repos.

## Tech Stack
- Electron (via electron-forge with Vite plugin)
- React 18 with TypeScript (renderer process)
- Tailwind CSS 4 for styling
- Framer Motion for animations
- electron-store for local data persistence
- Node.js child_process for spawning Claude Code CLI and GitHub CLI

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
- Flexible project inputs (users add any key-value inputs they want)
- GitHub integration: create new repo OR link existing, user chooses each time
- Launch Claude Code in external terminal for any project
- CLAUDE.md auto-generation from project inputs
- Command palette, keyboard shortcuts, context menus

## Commands
- npm run start → Development with hot reload
- npm run make → Production build
- npm run lint → Lint

## Coding Standards
- TypeScript strict mode everywhere
- Functional React components with hooks only
- Tailwind CSS utility classes (no CSS modules, no styled-components)
- Framer Motion for all animations
- All IPC calls go through typed hooks (useAPI pattern)
- Error boundaries around major page sections
- Commit after completing each major feature
