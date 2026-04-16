/**
 * shadow-git-service.ts
 *
 * Enhanced git snapshot layer with:
 *   1. Automatic checkpointing — lightweight git commits before/after significant actions
 *   2. Diff parsing — parse `git diff` into structured DiffChunk objects
 *   3. Selective staging — apply only user-accepted hunks via git apply --cached
 *   4. Revert with memory injection — revert to a snapshot and tell all active
 *      agents what was reverted so they don't repeat the same approach
 *
 * Tags use the prefix "forge-shadow-" to avoid colliding with time-machine tags.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { v4 as uuidv4 } from 'uuid';
import type { AgentType } from '../../shared/types';
import { runExecFile } from '../utils/run-command';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShadowSnapshot {
  id: string;
  label: string;
  gitTag: string;
  timestamp: string; // ISO date
}

export interface DiffChunk {
  id: string;          // stable uuid for accept/reject tracking
  filePath: string;    // relative path, e.g. "src/utils.ts"
  fileHeader: string;  // "diff --git a/src/utils.ts b/src/utils.ts\nindex ...\n--- a/...\n+++ b/..."
  hunkHeader: string;  // "@@ -15,4 +15,8 @@ function validateEmail()"
  hunk: string;        // full hunk text including the @@ header line
  linesAdded: number;
  linesRemoved: number;
}

export interface FileDiff {
  filePath: string;
  chunks: DiffChunk[];
  linesAdded: number;
  linesRemoved: number;
  isNew: boolean;
  isDeleted: boolean;
}

interface ParsedHunkHeader {
  minusStart: number;
  minusCount: number;
  plusStart: number;
  plusCount: number;
  contextSuffix: string; // everything after the @@ ... @@ part
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

const SHADOW_TAG_PREFIX = 'forge-shadow-';

async function git(projectPath: string, args: string[]): Promise<string> {
  const result = await runExecFile('git', args, { cwd: projectPath, timeout: 30000 });
  return result.stdout;
}

async function gitSilent(projectPath: string, args: string[]): Promise<string> {
  try {
    return await git(projectPath, args);
  } catch {
    return '';
  }
}

// ─── Snapshot (checkpointing) ────────────────────────────────────────────────

/**
 * Create a lightweight checkpoint commit + tag. Safe to call frequently —
 * skips the commit if there are no pending changes.
 */
export async function snapshot(
  projectPath: string,
  label: string,
): Promise<ShadowSnapshot | null> {
  try {
    const status = await gitSilent(projectPath, ['status', '--porcelain']);
    if (status.trim()) {
      await git(projectPath, ['add', '-A']);
      await git(projectPath, [
        'commit',
        '-m',
        `[forge-shadow] ${label}`,
        '--allow-empty',
      ]);
    }

    const id = uuidv4();
    const tag = `${SHADOW_TAG_PREFIX}${Date.now()}-${id.slice(0, 8)}`;
    await git(projectPath, ['tag', '-a', tag, '-m', label]);

    return {
      id,
      label,
      gitTag: tag,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

/**
 * Revert to a shadow snapshot. Appends a "do not repeat" notice to every
 * active agent's memory.md file so they avoid the same approach.
 */
export async function revertToSnapshot(
  projectPath: string,
  gitTag: string,
  label: string,
  activeAgents: AgentType[],
): Promise<void> {
  await git(projectPath, ['reset', '--hard', gitTag]);
  await injectRevertMemory(projectPath, label, activeAgents);
}

async function injectRevertMemory(
  projectPath: string,
  label: string,
  activeAgents: AgentType[],
): Promise<void> {
  const notice =
    `\n## ⚠️ Reverted Changes (${new Date().toISOString()})\n` +
    `The following approach was reverted:\n- ${label}\n` +
    `Do NOT repeat this approach. Try a different strategy.\n`;

  for (const agent of activeAgents) {
    const memPath = path.join(projectPath, '.forge', 'agents', agent, 'memory.md');
    try {
      await fs.access(memPath);
      await fs.appendFile(memPath, notice, 'utf8');
    } catch {
      // Memory file doesn't exist — skip
    }
  }

  // Also append to context files so agent gets it on next read
  const contextFiles = ['CLAUDE.md', 'GEMINI.md', 'codex.md'];
  for (const file of contextFiles) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
      await fs.appendFile(filePath, notice, 'utf8');
    } catch {
      // Context file doesn't exist — skip
    }
  }
}

// ─── Diff parsing ─────────────────────────────────────────────────────────────

/**
 * Parse `git diff HEAD` into structured FileDiff objects with individual DiffChunks.
 */
export async function getDiffChunks(projectPath: string): Promise<FileDiff[]> {
  let rawDiff: string;
  try {
    rawDiff = await git(projectPath, ['diff', 'HEAD']);
    if (!rawDiff.trim()) {
      // Also check staged changes
      rawDiff = await gitSilent(projectPath, ['diff', '--cached', 'HEAD']);
    }
  } catch {
    return [];
  }

  if (!rawDiff.trim()) return [];
  return parseDiff(rawDiff);
}

function parseHunkHeader(header: string): ParsedHunkHeader {
  // @@ -a,b +c,d @@ optional context
  const match = header.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
  if (!match) {
    return { minusStart: 1, minusCount: 1, plusStart: 1, plusCount: 1, contextSuffix: '' };
  }
  return {
    minusStart: parseInt(match[1], 10),
    minusCount: match[2] !== undefined ? parseInt(match[2], 10) : 1,
    plusStart: parseInt(match[3], 10),
    plusCount: match[4] !== undefined ? parseInt(match[4], 10) : 1,
    contextSuffix: match[5] ?? '',
  };
}

function parseDiff(rawDiff: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = rawDiff.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Start of a new file diff
    if (!line.startsWith('diff --git ')) {
      i++;
      continue;
    }

    // Collect the file header block (diff --git, index, ---, +++)
    const fileHeaderLines: string[] = [];
    let filePath = '';
    let isNew = false;
    let isDeleted = false;

    while (i < lines.length && !lines[i].startsWith('@@ ')) {
      const l = lines[i];
      fileHeaderLines.push(l);

      if (l.startsWith('+++ b/')) {
        filePath = l.slice(6);
      } else if (l === '+++ /dev/null') {
        isDeleted = true;
      } else if (l.startsWith('+++ ') && !filePath) {
        filePath = l.slice(4);
      }
      if (l.startsWith('--- /dev/null')) {
        isNew = true;
      }
      if (l.startsWith('new file mode')) {
        isNew = true;
      }
      if (l.startsWith('deleted file mode')) {
        isDeleted = true;
      }
      // Stop collecting header if next file starts
      if (i + 1 < lines.length && lines[i + 1].startsWith('diff --git ')) {
        i++;
        break;
      }
      i++;
    }

    if (!filePath) {
      // Could not parse file path from header — extract from diff --git line
      const m = fileHeaderLines[0]?.match(/^diff --git a\/(.*) b\//);
      if (m) filePath = m[1];
    }

    const fileHeader = fileHeaderLines.join('\n');
    const chunks: DiffChunk[] = [];
    let fileLinesAdded = 0;
    let fileLinesRemoved = 0;

    // Collect hunks for this file
    while (i < lines.length && !lines[i].startsWith('diff --git ')) {
      if (!lines[i].startsWith('@@ ')) {
        i++;
        continue;
      }

      const hunkHeaderLine = lines[i];
      const hunkLines: string[] = [hunkHeaderLine];
      i++;

      while (
        i < lines.length &&
        !lines[i].startsWith('@@ ') &&
        !lines[i].startsWith('diff --git ')
      ) {
        hunkLines.push(lines[i]);
        i++;
      }

      const hunkText = hunkLines.join('\n');
      const { minusCount, plusCount } = parseHunkHeader(hunkHeaderLine);

      // Count added/removed lines
      let added = 0;
      let removed = 0;
      for (const hl of hunkLines.slice(1)) {
        if (hl.startsWith('+')) added++;
        else if (hl.startsWith('-')) removed++;
      }

      // Sanity-check against header counts (use actual counts if they differ)
      void minusCount;
      void plusCount;

      chunks.push({
        id: uuidv4(),
        filePath,
        fileHeader,
        hunkHeader: hunkHeaderLine,
        hunk: hunkText,
        linesAdded: added,
        linesRemoved: removed,
      });

      fileLinesAdded += added;
      fileLinesRemoved += removed;
    }

    if (chunks.length > 0 || fileHeader) {
      files.push({
        filePath,
        chunks,
        linesAdded: fileLinesAdded,
        linesRemoved: fileLinesRemoved,
        isNew,
        isDeleted,
      });
    }
  }

  return files;
}

// ─── Selective staging ────────────────────────────────────────────────────────

/**
 * Apply only the accepted hunks to the git index (staging area), leaving
 * the working tree untouched. Then commit the staged result.
 *
 * Algorithm:
 *   1. Build a unified diff patch containing only the accepted chunks
 *   2. Adjust `+` offsets for hunks where preceding rejected hunks would have
 *      shifted line numbers
 *   3. `git apply --cached <patchfile>` to stage without touching working tree
 *   4. `git commit -m <message>` to commit
 */
export async function applyChunks(
  projectPath: string,
  acceptedChunkIds: string[],
  commitMessage: string,
): Promise<void> {
  const acceptedIds = new Set(acceptedChunkIds);

  // Re-parse the current diff to get fresh chunks with fileHeader info
  const fileDiffs = await getDiffChunks(projectPath);
  if (fileDiffs.length === 0) throw new Error('No changes to stage');

  // Build patch content
  const patchLines: string[] = [];

  for (const fileDiff of fileDiffs) {
    const accepted = fileDiff.chunks.filter((c) => acceptedIds.has(c.id));
    if (accepted.length === 0) continue;

    // File header
    patchLines.push(fileDiff.chunks[0].fileHeader);

    // Adjust + offsets for accepted hunks relative to HEAD
    // (rejected preceding hunks didn't add their lines, so + offset needs reduction)
    const adjustedHunks = recalcPlusOffsets(fileDiff.chunks, acceptedIds);
    patchLines.push(...adjustedHunks);
  }

  if (patchLines.length === 0) {
    throw new Error('No accepted chunks to apply');
  }

  const patchContent = patchLines.join('\n') + '\n';

  // Write patch to a temp file
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'forge-patch-'));
  const patchFile = path.join(tmpDir, 'accepted.patch');

  try {
    await fs.writeFile(patchFile, patchContent, 'utf8');

    // Apply to index only (--cached = stage without touching working tree)
    await git(projectPath, [
      'apply',
      '--cached',
      '--whitespace=nowarn',
      patchFile,
    ]);

    // Commit staged changes
    const msg = commitMessage.trim() || 'Selective staging commit';
    await git(projectPath, ['commit', '-m', msg]);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Recalculate the `+` line offsets for accepted hunks, accounting for
 * rejected hunks that would have shifted the line numbers.
 *
 * For each REJECTED hunk, its delta (plusCount - minusCount) would have been
 * added to all subsequent hunks' `+` offsets. Since we're not applying those
 * rejected hunks, we subtract the accumulated delta from subsequent accepted hunks.
 */
function recalcPlusOffsets(
  chunks: DiffChunk[],
  acceptedIds: Set<string>,
): string[] {
  const output: string[] = [];
  let rejectedDelta = 0;

  for (const chunk of chunks) {
    const { minusStart, minusCount, plusStart, plusCount, contextSuffix } =
      parseHunkHeader(chunk.hunkHeader);

    if (acceptedIds.has(chunk.id)) {
      const newPlusStart = plusStart - rejectedDelta;
      const newHeader = `@@ -${minusStart},${minusCount} +${newPlusStart},${plusCount} @@${contextSuffix}`;
      // Replace just the header line in the hunk text
      const adjustedHunk = chunk.hunk.replace(chunk.hunkHeader, newHeader);
      output.push(adjustedHunk);
    } else {
      // Rejected hunk — accumulate its delta so subsequent + offsets are adjusted
      rejectedDelta += plusCount - minusCount;
    }
  }

  return output;
}
