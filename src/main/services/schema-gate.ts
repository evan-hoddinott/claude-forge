/**
 * schema-gate.ts
 * Role-based tool access control for AI agents.
 * An agent's tool schema is filtered at construction time —
 * unauthorized tools simply don't exist in the agent's reality.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AgentType,
  AgentRole,
  SecurityEvent,
  RoleDefinitions,
  SchemaGateValidation,
  ToolDefinition,
  SchemaGateState,
  ForgeManifest,
} from '../../shared/types';

// ─── Tool catalog ────────────────────────────────────────────────────────────

export const ALL_TOOLS: ToolDefinition[] = [
  { name: 'readFile',           description: 'Read the contents of a file' },
  { name: 'writeFile',          description: 'Write content to a file' },
  { name: 'createFile',         description: 'Create a new file' },
  { name: 'deleteFile',         description: 'Delete a file' },
  { name: 'listDirectory',      description: 'List files in a directory' },
  { name: 'searchFiles',        description: 'Search for files by name pattern' },
  { name: 'searchFileContents', description: 'Search file contents for a pattern' },
  { name: 'runCommand',         description: 'Execute a shell command' },
  { name: 'gitAdd',             description: 'Stage files for commit' },
  { name: 'gitCommit',          description: 'Commit staged changes' },
  { name: 'createTask',         description: 'Create a task on the blackboard' },
  { name: 'assignTask',         description: 'Assign a task to an agent' },
  { name: 'postArtifact',       description: 'Post an artifact to the blackboard' },
  { name: 'sendMailbox',        description: 'Send a message to an agent mailbox' },
  { name: 'spawnSubagent',      description: 'Spawn a sub-agent for a subtask' },
];

// ─── Role definitions ────────────────────────────────────────────────────────

export const ROLE_DEFINITIONS: RoleDefinitions = {
  lead: {
    displayName: 'Team Lead',
    description: 'Plans, delegates, coordinates. Full visibility, limited execution.',
    capabilities: ['read', 'analyze', 'plan', 'delegate', 'blackboard-write', 'spawn-agent'],
    tools: ['readFile', 'listDirectory', 'searchFiles', 'createTask', 'assignTask', 'postArtifact', 'sendMailbox', 'spawnSubagent'],
    restrictions: ['Cannot write to source files directly', 'Must delegate to engineers'],
    modelTier: 'frontier',
  },
  engineer: {
    displayName: 'Engineer',
    description: 'Writes code, creates files, runs commands.',
    capabilities: ['read', 'write', 'execute', 'git-commit'],
    tools: ['readFile', 'writeFile', 'createFile', 'deleteFile', 'listDirectory', 'runCommand', 'gitAdd', 'gitCommit', 'searchFiles', 'postArtifact'],
    restrictions: ['Cannot force-push', 'Cannot modify .forge/ directly', 'Cannot delete git history'],
    modelTier: 'performance',
  },
  reviewer: {
    displayName: 'Code Reviewer',
    description: 'Reads code, posts reviews, cannot modify files.',
    capabilities: ['read', 'analyze'],
    tools: ['readFile', 'listDirectory', 'searchFiles', 'searchFileContents', 'postArtifact', 'sendMailbox'],
    restrictions: ['Cannot write files', 'Cannot execute commands', 'Read-only access'],
    modelTier: 'efficient',
  },
  tester: {
    displayName: 'Test Engineer',
    description: 'Writes and runs tests only. Cannot modify source code.',
    capabilities: ['read', 'write-tests', 'execute-tests'],
    tools: ['readFile', 'listDirectory', 'searchFiles', 'writeFile', 'runCommand'],
    restrictions: ['Can only write test files', 'Can only run test commands'],
    fileRestrictions: {
      writeAllowed: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/test/**', '**/tests/**', '**/__tests__/**'],
      writeBlocked: [],
    },
    commandRestrictions: {
      allowed: ['npm test', 'npm run test', 'npx vitest', 'npx jest'],
      blocked: ['rm', 'npm install', 'git push'],
    },
    modelTier: 'efficient',
  },
  documenter: {
    displayName: 'Documentation Writer',
    description: 'Writes docs, READMEs, comments. Cannot modify logic.',
    capabilities: ['read', 'write-docs'],
    tools: ['readFile', 'listDirectory', 'writeFile', 'searchFiles'],
    restrictions: ['Can only write documentation files'],
    fileRestrictions: {
      writeAllowed: ['**/*.md', 'docs/**', '**/README*', '**/CHANGELOG*', '**/*.jsdoc'],
      writeBlocked: [],
    },
    modelTier: 'efficient',
  },
};

// ─── Glob matching ────────────────────────────────────────────────────────────

function wildcardMatch(str: string, pattern: string): boolean {
  if (pattern === '*') return true;
  const regex = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return regex.test(str);
}

function matchParts(sParts: string[], pParts: string[]): boolean {
  let si = 0;
  let pi = 0;
  while (pi < pParts.length) {
    if (pParts[pi] === '**') {
      pi++;
      if (pi === pParts.length) return true;
      while (si < sParts.length) {
        if (matchParts(sParts.slice(si), pParts.slice(pi))) return true;
        si++;
      }
      return false;
    }
    if (si >= sParts.length) return false;
    if (!wildcardMatch(sParts[si], pParts[pi])) return false;
    si++;
    pi++;
  }
  return si === sParts.length;
}

function globMatchSingle(str: string, pattern: string): boolean {
  const s = str.replace(/\\/g, '/');
  const p = pattern.replace(/\\/g, '/');

  if (p.startsWith('**/')) {
    const rest = p.slice(3);
    if (globMatchSingle(s, rest)) return true;
    const slash = s.indexOf('/');
    return slash !== -1 && globMatchSingle(s.slice(slash + 1), pattern);
  }

  if (p === '**') return true;

  if (p.includes('/')) {
    return matchParts(s.split('/'), p.split('/'));
  }

  // Pattern has no slash — match against basename
  const base = s.includes('/') ? s.slice(s.lastIndexOf('/') + 1) : s;
  return wildcardMatch(base, p);
}

function matchesGlob(filePath: string, patterns: string[]): boolean {
  return patterns.some(p => globMatchSingle(filePath, p));
}

// ─── Forge path helpers ───────────────────────────────────────────────────────

function forgePath(projectPath: string, ...parts: string[]): string {
  return path.join(projectPath, '.forge', ...parts);
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function buildToolSchema(role: AgentRole): ToolDefinition[] {
  const roleDef = ROLE_DEFINITIONS[role];
  if (!roleDef) return [];
  return ALL_TOOLS.filter(tool => roleDef.tools.includes(tool.name));
}

export async function validateToolCall(
  projectPath: string,
  agent: AgentType,
  role: AgentRole,
  toolName: string,
  args: Record<string, unknown>,
): Promise<SchemaGateValidation> {
  const roleDef = ROLE_DEFINITIONS[role];
  if (!roleDef) {
    return { allowed: false, reason: `Unknown role: ${role}` };
  }

  // Primary schema gate: is this tool in the role's schema at all?
  if (!roleDef.tools.includes(toolName)) {
    await logSecurityEvent(projectPath, agent, 'blocked-tool', `${toolName} (not in ${role} schema)`, role);
    return { allowed: false, reason: `Role "${role}" does not have access to tool "${toolName}"` };
  }

  // File restriction check for write operations
  if (toolName === 'writeFile' || toolName === 'createFile') {
    const filePath = typeof args.path === 'string' ? args.path
      : typeof args.filePath === 'string' ? args.filePath
      : null;

    if (filePath && roleDef.fileRestrictions) {
      if (!matchesGlob(filePath, roleDef.fileRestrictions.writeAllowed)) {
        await logSecurityEvent(projectPath, agent, 'blocked-file-write', filePath, role);
        return { allowed: false, reason: `Role "${role}" cannot write to "${filePath}"` };
      }
    }

    // Spatial partition check
    if (filePath) {
      const registry = await readJson<{ agents: Record<string, { spatialPartition?: string }> }>(
        forgePath(projectPath, 'agents', 'registry.json'),
      );
      const partition = registry?.agents?.[agent]?.spatialPartition;
      if (partition && !matchesGlob(filePath, [partition])) {
        await logSecurityEvent(projectPath, agent, 'blocked-file-write',
          `${filePath} (outside partition: ${partition})`, role);
        return { allowed: false, reason: `Agent "${agent}" cannot write outside its partition "${partition}"` };
      }
    }
  }

  // Command restriction check
  if (toolName === 'runCommand' && roleDef.commandRestrictions) {
    const command = typeof args.command === 'string' ? args.command : '';
    if (roleDef.commandRestrictions.blocked.some(b => command.startsWith(b))) {
      await logSecurityEvent(projectPath, agent, 'blocked-command', command, role);
      return { allowed: false, reason: `Role "${role}" cannot execute "${command}"` };
    }
    if (roleDef.commandRestrictions.allowed.length > 0) {
      const permitted = roleDef.commandRestrictions.allowed.some(a => command.startsWith(a));
      if (!permitted) {
        await logSecurityEvent(projectPath, agent, 'blocked-command', command, role);
        return { allowed: false, reason: `Role "${role}" cannot execute "${command}" — not in allowed list` };
      }
    }
  }

  await logSecurityEvent(projectPath, agent, 'allowed', toolName, role);
  return { allowed: true };
}

export async function logSecurityEvent(
  projectPath: string,
  agent: AgentType,
  event: SecurityEvent['event'],
  detail: string,
  role?: AgentRole,
): Promise<void> {
  const entry: SecurityEvent = { timestamp: new Date().toISOString(), agent, event, detail, role };
  const logPath = forgePath(projectPath, 'security', 'audit-log.jsonl');
  try {
    await fs.appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // If .forge/security/ doesn't exist yet, skip — not worth crashing over
  }
}

export async function getAuditLog(projectPath: string, limit = 50): Promise<SecurityEvent[]> {
  const logPath = forgePath(projectPath, 'security', 'audit-log.jsonl');
  try {
    const raw = await fs.readFile(logPath, 'utf8');
    const events = raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => { try { return JSON.parse(line) as SecurityEvent; } catch { return null; } })
      .filter((e): e is SecurityEvent => e !== null);
    return events.slice(-limit).reverse();
  } catch {
    return [];
  }
}

export async function getState(projectPath: string): Promise<SchemaGateState> {
  const manifest = await readJson<ForgeManifest>(forgePath(projectPath, 'manifest.json'));
  const registry = await readJson<{ agents: Record<string, { role: AgentRole; lastActive: string; spatialPartition?: string }> }>(
    forgePath(projectPath, 'agents', 'registry.json'),
  );

  const enabled = manifest?.schemaGatingEnabled ?? false;
  const assignments = Object.entries(registry?.agents ?? {}).map(([agentType, entry]) => ({
    agent: agentType as AgentType,
    role: entry.role,
    spatialPartition: entry.spatialPartition,
    assignedAt: entry.lastActive,
  }));

  return { enabled, assignments };
}

export async function assignRole(
  projectPath: string,
  agent: AgentType,
  role: AgentRole,
  spatialPartition?: string,
): Promise<void> {
  const regPath = forgePath(projectPath, 'agents', 'registry.json');
  const registry = (await readJson<{ agents: Record<string, Record<string, unknown>> }>(regPath)) ?? { agents: {} };
  const roleDef = ROLE_DEFINITIONS[role];

  if (!registry.agents[agent]) {
    registry.agents[agent] = {
      type: agent,
      role,
      status: 'idle',
      lastActive: new Date().toISOString(),
      sessionsCompleted: 0,
      tokensConsumed: 0,
      filesOwned: [],
      capabilities: roleDef?.capabilities ?? [],
      restrictions: roleDef?.restrictions ?? [],
    };
  } else {
    registry.agents[agent].role = role;
    registry.agents[agent].lastActive = new Date().toISOString();
    registry.agents[agent].capabilities = roleDef?.capabilities ?? [];
    registry.agents[agent].restrictions = roleDef?.restrictions ?? [];
  }

  if (spatialPartition !== undefined) {
    registry.agents[agent].spatialPartition = spatialPartition;
  }

  await writeJson(regPath, registry);
  await logSecurityEvent(
    projectPath, agent, 'allowed',
    `Role assigned: ${role}${spatialPartition ? ` (partition: ${spatialPartition})` : ''}`,
  );
}

export async function enable(projectPath: string): Promise<void> {
  const p = forgePath(projectPath, 'manifest.json');
  const manifest = await readJson<ForgeManifest>(p);
  if (manifest) {
    manifest.schemaGatingEnabled = true;
    await writeJson(p, manifest);
  }
}

export async function disable(projectPath: string): Promise<void> {
  const p = forgePath(projectPath, 'manifest.json');
  const manifest = await readJson<ForgeManifest>(p);
  if (manifest) {
    manifest.schemaGatingEnabled = false;
    await writeJson(p, manifest);
  }
}

export function getRoleDefinitions(): RoleDefinitions {
  return ROLE_DEFINITIONS;
}
