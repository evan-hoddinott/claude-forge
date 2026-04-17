/**
 * forge-directory.ts
 * Manages the .forge/ orchestration directory for each project.
 * All I/O is node:fs/promises — no external dependencies.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AgentType,
  AgentRole,
  AgentOrchestratorStatus,
  ForgeManifest,
  ForgeRegistry,
  ForgeAgentEntry,
  ForgeState,
} from '../../shared/types';
import { AGENTS } from '../../shared/types';

const FORGE_VERSION = '2.0.0';

const FORGE_GITIGNORE_MARKER = '# Claude Forge — ephemeral orchestration state';
const FORGE_GITIGNORE_RULES = `${FORGE_GITIGNORE_MARKER}
.forge/blackboard/
.forge/snapshots/
.forge/security/audit-log.jsonl
.forge/agents/*/session-log/
`;

function forgePath(projectPath: string, ...parts: string[]): string {
  return path.join(projectPath, '.forge', ...parts);
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function buildDefaultEntry(agentType: AgentType, role: AgentRole): ForgeAgentEntry {
  return {
    type: agentType,
    role,
    status: 'idle',
    lastActive: new Date().toISOString(),
    sessionsCompleted: 0,
    tokensConsumed: 0,
    filesOwned: [],
    capabilities: ['read', 'write', 'execute', 'git'],
    restrictions: [],
  };
}

function buildInitialMemory(agentType: AgentType, projectName: string, seed?: string): string {
  const displayName = AGENTS[agentType]?.displayName ?? agentType;
  const header = `# ${displayName}'s Memory — ${projectName}\n`;
  if (seed && seed.trim()) {
    return `${header}\n${seed.trim()}\n`;
  }
  return (
    `${header}\n` +
    `## Key Decisions\n\n` +
    `## Known Issues\n\n` +
    `## Patterns\n\n` +
    `## What NOT to Do\n`
  );
}

export async function exists(projectPath: string): Promise<boolean> {
  try {
    await fs.access(forgePath(projectPath, 'manifest.json'));
    return true;
  } catch {
    return false;
  }
}

export async function initialize(projectPath: string, agents: AgentType[]): Promise<void> {
  const activeAgents = agents.length > 0 ? agents : (['claude'] as AgentType[]);
  const primaryAgent = activeAgents[0];
  const projectName = path.basename(projectPath);

  // Create directory structure
  const dirs = [
    forgePath(projectPath, 'agents'),
    forgePath(projectPath, 'blackboard', 'artifacts'),
    forgePath(projectPath, 'blackboard', 'mailboxes'),
    forgePath(projectPath, 'snapshots', 'hashes'),
    forgePath(projectPath, 'conductor', 'history'),
    forgePath(projectPath, 'conductor', 'playbooks'),
    forgePath(projectPath, 'security'),
  ];
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  for (const agentType of activeAgents) {
    await fs.mkdir(forgePath(projectPath, 'agents', agentType, 'session-log'), { recursive: true });
  }

  // manifest.json
  const manifest: ForgeManifest = {
    forgeVersion: FORGE_VERSION,
    projectName,
    created: new Date().toISOString(),
    orchestrationMode: 'manual',
    activeAgents,
    primaryAgent,
    blackboardEnabled: true,
    shadowGitEnabled: false,
    schemaGatingEnabled: false,
  };
  await writeJson(forgePath(projectPath, 'manifest.json'), manifest);

  // agents/registry.json
  const registryAgents: Partial<Record<AgentType, ForgeAgentEntry>> = {};
  activeAgents.forEach((agentType, idx) => {
    registryAgents[agentType] = buildDefaultEntry(agentType, idx === 0 ? 'lead' : 'engineer');
  });
  const registry: ForgeRegistry = { agents: registryAgents };
  await writeJson(forgePath(projectPath, 'agents', 'registry.json'), registry);

  // Per-agent files
  for (const agentType of activeAgents) {
    // identity.json
    await writeJson(forgePath(projectPath, 'agents', agentType, 'identity.json'), {
      type: agentType,
      displayName: AGENTS[agentType]?.displayName ?? agentType,
      contextFileName: AGENTS[agentType]?.contextFileName ?? null,
    });

    // memory.md — seed from existing context file if present
    let seed: string | undefined;
    const ctxFileName = AGENTS[agentType]?.contextFileName;
    if (ctxFileName) {
      try {
        seed = await fs.readFile(path.join(projectPath, ctxFileName), 'utf8');
      } catch {
        // no existing context file — that's fine
      }
    }
    const memoryPath = forgePath(projectPath, 'agents', agentType, 'memory.md');
    try {
      await fs.access(memoryPath);
      // already exists — don't overwrite
    } catch {
      await fs.writeFile(memoryPath, buildInitialMemory(agentType, projectName, seed), 'utf8');
    }
  }

  // blackboard/tasks.json
  await writeJson(forgePath(projectPath, 'blackboard', 'tasks.json'), { tasks: [] });

  // blackboard/mailboxes/<agent>.jsonl — one per active agent
  for (const agentType of activeAgents) {
    const mailboxPath = forgePath(projectPath, 'blackboard', 'mailboxes', `${agentType}.jsonl`);
    try {
      await fs.access(mailboxPath);
    } catch {
      await fs.writeFile(mailboxPath, '', 'utf8');
    }
  }

  // security/roles.json — full definitions consumed by schema-gate
  const { ROLE_DEFINITIONS } = await import('./schema-gate');
  await writeJson(forgePath(projectPath, 'security', 'roles.json'), { roles: ROLE_DEFINITIONS });

  // snapshots/index.json
  await writeJson(forgePath(projectPath, 'snapshots', 'index.json'), { snapshots: [] });

  // config.json
  await writeJson(forgePath(projectPath, 'config.json'), {});

  // .gitignore — append forge rules once
  const gitignorePath = path.join(projectPath, '.gitignore');
  let gitignoreContent = '';
  try {
    gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
  } catch { /* file doesn't exist yet */ }
  if (!gitignoreContent.includes(FORGE_GITIGNORE_MARKER)) {
    await fs.appendFile(gitignorePath, `\n${FORGE_GITIGNORE_RULES}`, 'utf8');
  }
}

export async function getState(projectPath: string): Promise<ForgeState | null> {
  const manifest = await readJson<ForgeManifest>(forgePath(projectPath, 'manifest.json'));
  if (!manifest) return null;

  const registry = (await readJson<ForgeRegistry>(forgePath(projectPath, 'agents', 'registry.json'))) ?? { agents: {} };

  // Count blackboard tasks
  const tasks = await readJson<{ tasks: unknown[] }>(forgePath(projectPath, 'blackboard', 'tasks.json'));
  const blackboardTaskCount = tasks?.tasks?.length ?? 0;

  // Find most recent session log timestamp
  let lastSessionTime: string | null = null;
  for (const agentType of manifest.activeAgents) {
    const logDir = forgePath(projectPath, 'agents', agentType, 'session-log');
    try {
      const entries = await fs.readdir(logDir);
      const sorted = entries.sort().reverse();
      if (sorted.length > 0) {
        const stat = await fs.stat(path.join(logDir, sorted[0]));
        const ts = stat.mtime.toISOString();
        if (!lastSessionTime || ts > lastSessionTime) lastSessionTime = ts;
      }
    } catch {
      // no session log dir — skip
    }
  }

  return { manifest, registry, blackboardTaskCount, lastSessionTime };
}

export async function getAgentMemory(projectPath: string, agent: AgentType): Promise<string> {
  try {
    return await fs.readFile(forgePath(projectPath, 'agents', agent, 'memory.md'), 'utf8');
  } catch {
    return '';
  }
}

export async function appendToMemory(projectPath: string, agent: AgentType, entry: string): Promise<void> {
  const memPath = forgePath(projectPath, 'agents', agent, 'memory.md');
  await fs.appendFile(memPath, `\n\n${entry}`, 'utf8');
}

export async function updateAgentStatus(
  projectPath: string,
  agent: AgentType,
  status: AgentOrchestratorStatus,
): Promise<void> {
  const regPath = forgePath(projectPath, 'agents', 'registry.json');
  const registry = (await readJson<ForgeRegistry>(regPath)) ?? { agents: {} };
  const entry = registry.agents[agent];
  if (entry) {
    entry.status = status;
    entry.lastActive = new Date().toISOString();
  }
  await writeJson(regPath, registry);
}

/**
 * Start a new agent session. Creates a session-log file and marks the agent
 * as 'working'. Returns a session ID that callers pass to endSession.
 *
 * Session ID format: `<agent>-<YYYYMMDDTHHmmss>-<rand4>` — the agent prefix
 * lets endSession locate the log file without a full directory scan.
 */
export async function startSession(
  projectPath: string,
  agent: AgentType,
  task: string,
): Promise<string> {
  const now = new Date();
  // Compact ISO timestamp safe for filenames: 20260416T123045
  const ts = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');
  const rand = Math.random().toString(36).slice(2, 6);
  const sessionId = `${agent}-${ts}-${rand}`;

  const logDir = forgePath(projectPath, 'agents', agent, 'session-log');
  await fs.mkdir(logDir, { recursive: true });

  const logContent =
    `# Session ${sessionId}\n` +
    `**Agent:** ${agent}\n` +
    `**Task:** ${task}\n` +
    `**Started:** ${now.toISOString()}\n` +
    `**Status:** in-progress\n`;

  await fs.writeFile(path.join(logDir, `${sessionId}.md`), logContent, 'utf8');
  await updateAgentStatus(projectPath, agent, 'working');

  return sessionId;
}

/**
 * End an agent session. Updates the session-log file with a summary,
 * appends the summary to the agent's persistent memory, and resets the
 * agent's status to 'idle' while incrementing sessionsCompleted.
 */
export async function endSession(
  projectPath: string,
  sessionId: string,
  summary: string,
): Promise<void> {
  // Agent is the first segment of the session ID (e.g. "claude-20260416T…")
  const agentType = sessionId.split('-')[0] as AgentType;
  const sessionFile = forgePath(projectPath, 'agents', agentType, 'session-log', `${sessionId}.md`);

  try {
    const existing = await fs.readFile(sessionFile, 'utf8');
    const updated =
      existing.replace('**Status:** in-progress', '**Status:** completed') +
      `**Ended:** ${new Date().toISOString()}\n\n## Summary\n${summary}\n`;
    await fs.writeFile(sessionFile, updated, 'utf8');
  } catch {
    // Session file missing — still update registry and memory below
  }

  // Update registry: set idle, increment sessionsCompleted
  const regPath = forgePath(projectPath, 'agents', 'registry.json');
  const registry = (await readJson<ForgeRegistry>(regPath)) ?? { agents: {} };
  const entry = registry.agents[agentType];
  if (entry) {
    entry.status = 'idle';
    entry.lastActive = new Date().toISOString();
    entry.sessionsCompleted += 1;
  }
  await writeJson(regPath, registry);

  // Append summary to persistent memory
  if (summary.trim()) {
    const datePart = new Date().toISOString().split('T')[0];
    await appendToMemory(projectPath, agentType, `## Session ${datePart}\n${summary}`);
  }
}
