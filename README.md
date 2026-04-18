# Caboo

Caboo is a multi-agent AI coding orchestrator.

Tagline: `Your AI coding crew`

Caboo helps you manage software projects, generate agent context files, coordinate multiple AI coding agents, review work, export bundles and snapshots, and ship from a retro-styled Electron desktop app.

## Highlights

- Caboo Skills and Caboo Hub for reusable skills, templates, and playbooks
- Multi-agent workflows across Claude Code, Gemini CLI, OpenAI Codex, GitHub Copilot, and local models
- `.caboo/` orchestration state with blackboard, conductor, snapshots, security, and agent memory
- GitHub integration, snapshot export/import, vibe bundles, reasoning maps, and battle mode

## Development

```bash
npm install
npm run start
```

Useful scripts:

- `npm run start`: launch the app in development
- `npm run build:dist`: build production bundles
- `npm run dist:win`, `npm run dist:linux`, `npm run dist:mac`: build platform artifacts
- `npm run ship`: build and publish release artifacts

## Release Note

The application brand is now `Caboo`, but the GitHub repository remains `evan-hoddinott/claude-forge` until the repo rename is handled separately.
