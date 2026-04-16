/**
 * stale-read-guard.ts
 *
 * Prevents concurrent agent file overwrites by maintaining a per-agent hash
 * registry of every file state when it was last read.
 *
 * Before any agent writes to a file:
 *   1. Compute the current file hash
 *   2. Compare with the hash recorded when the agent last read the file
 *   3. If they differ → STALE READ detected → block the write
 *
 * Registry stored at: .forge/snapshots/hashes/file-reads.json
 */

import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AgentType } from '../../shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WriteValidation {
  allowed: boolean;
  reason?: 'stale-read' | 'file-never-read';
  message?: string;
  lastReadHash?: string;
  currentHash?: string;
  lastReadAt?: string;
}

interface FileReadEntry {
  hash: string;
  readAt: string; // ISO date
}

/** Registry shape: { [agentType]: { [relFilePath]: FileReadEntry } } */
type HashRegistry = Record<string, Record<string, FileReadEntry>>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function registryPath(projectPath: string): string {
  return path.join(projectPath, '.forge', 'snapshots', 'hashes', 'file-reads.json');
}

async function readRegistry(projectPath: string): Promise<HashRegistry> {
  try {
    const raw = await fs.readFile(registryPath(projectPath), 'utf8');
    return JSON.parse(raw) as HashRegistry;
  } catch {
    return {};
  }
}

async function writeRegistry(projectPath: string, registry: HashRegistry): Promise<void> {
  const dir = path.dirname(registryPath(projectPath));
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(registryPath(projectPath), JSON.stringify(registry, null, 2), 'utf8');
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function toRelPath(projectPath: string, filePath: string): string {
  return path.relative(projectPath, path.resolve(filePath));
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record that an agent has just read a file. Stores the file's current hash
 * so we can detect if another agent modifies it before this agent writes.
 */
export async function recordRead(
  projectPath: string,
  agent: AgentType,
  filePath: string,
): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const hash = computeHash(content);
    const registry = await readRegistry(projectPath);
    if (!registry[agent]) registry[agent] = {};
    registry[agent][toRelPath(projectPath, filePath)] = {
      hash,
      readAt: new Date().toISOString(),
    };
    await writeRegistry(projectPath, registry);
  } catch {
    // Silently ignore — file may not exist yet, or .forge/ may not be initialized
  }
}

/**
 * Validate whether an agent is safe to write to a file.
 * Returns { allowed: true } if safe, or { allowed: false, reason, ... } if stale.
 */
export async function validateWrite(
  projectPath: string,
  agent: AgentType,
  filePath: string,
): Promise<WriteValidation> {
  try {
    const rel = toRelPath(projectPath, filePath);
    const registry = await readRegistry(projectPath);
    const agentReads = registry[agent] ?? {};
    const lastRead = agentReads[rel];

    let currentContent: string;
    try {
      currentContent = await fs.readFile(filePath, 'utf8');
    } catch {
      // File doesn't exist yet — safe to create
      return { allowed: true };
    }

    const currentHash = computeHash(currentContent);

    if (!lastRead) {
      return {
        allowed: false,
        reason: 'file-never-read',
        message: 'You must read this file before modifying it.',
        currentHash,
      };
    }

    if (lastRead.hash !== currentHash) {
      return {
        allowed: false,
        reason: 'stale-read',
        message:
          'This file was modified by another agent or the user since you last read it. ' +
          'Re-read the file and merge your changes with the current version.',
        lastReadHash: lastRead.hash,
        currentHash,
        lastReadAt: lastRead.readAt,
      };
    }

    return { allowed: true };
  } catch {
    // Fail open — if the guard itself errors, allow the write
    return { allowed: true };
  }
}

/**
 * Record that an agent successfully wrote a file.
 * Updates the agent's own hash and invalidates all other agents' reads
 * for this file (forcing them to re-read before they can write).
 */
export async function recordWrite(
  projectPath: string,
  agent: AgentType,
  filePath: string,
): Promise<void> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const hash = computeHash(content);
    const rel = toRelPath(projectPath, filePath);
    const registry = await readRegistry(projectPath);

    // Update writing agent's hash
    if (!registry[agent]) registry[agent] = {};
    registry[agent][rel] = { hash, readAt: new Date().toISOString() };

    // Invalidate other agents — delete their entries so they must re-read
    for (const otherAgent of Object.keys(registry)) {
      if (otherAgent !== agent && registry[otherAgent]?.[rel]) {
        delete registry[otherAgent][rel];
      }
    }

    await writeRegistry(projectPath, registry);
  } catch {
    // Ignore errors — guard is best-effort
  }
}

/**
 * Return the full registry for display in the UI.
 */
export async function getRegistry(
  projectPath: string,
): Promise<HashRegistry> {
  return readRegistry(projectPath);
}

/**
 * Clear all read records for a given agent (e.g., after a session ends).
 */
export async function clearAgent(
  projectPath: string,
  agent: AgentType,
): Promise<void> {
  try {
    const registry = await readRegistry(projectPath);
    delete registry[agent];
    await writeRegistry(projectPath, registry);
  } catch {
    // ignore
  }
}
