import * as path from 'node:path';
import * as fs from 'node:fs/promises';

/**
 * Validates and sanitizes a project name.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * Max 100 characters.
 */
export function sanitizeProjectName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Project name cannot be empty');
  if (trimmed.length > 100) throw new Error('Project name must be 100 characters or fewer');
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(trimmed)) {
    throw new Error('Project name may only contain letters, numbers, hyphens, dots, and underscores, and must start with a letter or number');
  }
  return trimmed;
}

/**
 * Strips shell metacharacters from a description string.
 */
export function sanitizeDescription(desc: string): string {
  // Remove characters that could be interpreted by a shell
  return desc.replace(/[;|&$`\\!<>(){}\[\]]/g, '').trim();
}

/**
 * Validates that a file path resolves within the allowed root directory.
 * Returns the resolved absolute path, or throws if the path is outside the root.
 * Also rejects symlinks that point outside the root.
 */
export async function validatePath(requestedPath: string, allowedRoot: string): Promise<string> {
  const resolved = path.resolve(requestedPath);
  const root = path.resolve(allowedRoot);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Access denied: path outside project directory');
  }

  // Check if it's a symlink pointing outside the project
  try {
    const realPath = await fs.realpath(resolved);
    if (realPath !== root && !realPath.startsWith(root + path.sep)) {
      throw new Error('Access denied: symlink points outside project directory');
    }
  } catch (err) {
    // If file doesn't exist yet (e.g. creating a new file), that's OK
    // as long as the resolved path is within bounds (already checked above)
    if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') {
      return resolved;
    }
    throw err;
  }

  return resolved;
}

/**
 * Synchronous path validation (no symlink check).
 * Use for cases where async is not available.
 */
export function validatePathSync(requestedPath: string, allowedRoot: string): string {
  const resolved = path.resolve(requestedPath);
  const root = path.resolve(allowedRoot);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Access denied: path outside project directory');
  }

  return resolved;
}

/**
 * Escapes special regex characters in a search query so it can be
 * safely used in a RegExp or passed to grep as a fixed string.
 */
export function sanitizeSearchQuery(query: string): string {
  // Remove null bytes
  const clean = query.replace(/\0/g, '');
  // Limit length
  if (clean.length > 500) {
    return clean.substring(0, 500);
  }
  return clean;
}

/**
 * Escapes regex special characters for use in grep -F (fixed string) mode
 * or for building safe RegExp patterns.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validates a GitHub repo name.
 * GitHub allows alphanumeric, hyphens, underscores, and dots.
 * Max 100 characters. Cannot start with a dot.
 */
export function isValidRepoName(name: string): boolean {
  if (!name || name.length > 100) return false;
  if (name.startsWith('.')) return false;
  return /^[a-zA-Z0-9._-]+$/.test(name);
}

/**
 * Validates a URL string (basic check for open-external safety).
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Sanitizes an error message for display to users.
 * Replaces absolute paths with relative/generic references.
 */
export function sanitizeErrorMessage(message: string): string {
  // Replace home directory paths
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  if (homeDir) {
    message = message.split(homeDir).join('~');
  }
  // Remove any remaining absolute paths (Unix)
  message = message.replace(/\/[^\s:'"]+/g, (match) => {
    const basename = path.basename(match);
    return basename || match;
  });
  // Remove Windows absolute paths
  message = message.replace(/[A-Z]:\\[^\s:'"]+/gi, (match) => {
    const basename = path.basename(match);
    return basename || match;
  });
  return message;
}

/**
 * Validates that a value is one of the allowed AgentType values.
 */
export function isValidAgentType(value: unknown): value is 'claude' | 'gemini' | 'codex' | 'copilot' {
  return value === 'claude' || value === 'gemini' || value === 'codex' || value === 'copilot';
}

/**
 * Validates a string argument from IPC.
 */
export function validateString(value: unknown, name: string, maxLength = 1000): string {
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${name}: expected string`);
  }
  if (value.length > maxLength) {
    throw new Error(`Invalid ${name}: too long (max ${maxLength} characters)`);
  }
  return value;
}
