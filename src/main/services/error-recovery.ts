// ---------------------------------------------------------------------------
// Auto-error recovery service
//
// For each error category, defines detection, auto-fix, and user messaging.
// ---------------------------------------------------------------------------

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type ErrorCategory =
  | 'npm_permission'
  | 'npm_not_found'
  | 'npm_eresolve'
  | 'git_not_repo'
  | 'git_remote_exists'
  | 'git_push_failed'
  | 'git_identity'
  | 'gh_not_found'
  | 'gh_auth'
  | 'gh_repo_exists'
  | 'agent_not_found'
  | 'agent_auth'
  | 'agent_timeout'
  | 'fs_no_space'
  | 'fs_permission'
  | 'fs_exists'
  | 'wsl_not_found'
  | 'wsl_no_distro'
  | 'unknown';

export interface RecoveryResult {
  recovered: boolean;
  category: ErrorCategory;
  userMessage: string;
  technicalDetails: string;
  actions: RecoveryAction[];
}

export interface RecoveryAction {
  label: string;
  actionId: string;
  variant: 'primary' | 'secondary';
}

interface ErrorPattern {
  category: ErrorCategory;
  patterns: RegExp[];
  exitCodes?: number[];
  autoFix?: (context: ErrorContext) => Promise<boolean>;
  userMessage: string;
  actions: RecoveryAction[];
}

interface ErrorContext {
  error: string;
  command?: string;
  cwd?: string;
  exitCode?: number;
}

// ---------------------------------------------------------------------------
// Error pattern definitions
// ---------------------------------------------------------------------------

const errorPatterns: ErrorPattern[] = [
  // --- npm / Node ---
  {
    category: 'npm_permission',
    patterns: [/EACCES.*permission denied/i, /EACCES/],
    userMessage: 'We need permission to install this tool.',
    actions: [
      { label: 'Fix Permissions', actionId: 'fix_npm_permissions', variant: 'primary' },
      { label: 'Skip', actionId: 'skip', variant: 'secondary' },
    ],
    autoFix: async (ctx) => {
      if (!ctx.command?.includes('npm')) return false;
      try {
        const retryCmd = ctx.command.replace('npm install', 'npm install --unsafe-perm');
        const parts = retryCmd.split(/\s+/);
        await execFileAsync(parts[0], parts.slice(1), { cwd: ctx.cwd, timeout: 120000 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    category: 'npm_not_found',
    patterns: [/ENOENT.*npm/i, /npm:?\s*command not found/i, /npm is not recognized/i],
    userMessage: "Node.js isn't installed yet.",
    actions: [
      { label: 'Install Node.js', actionId: 'install_nodejs', variant: 'primary' },
      { label: 'Skip', actionId: 'skip', variant: 'secondary' },
    ],
  },
  {
    category: 'npm_eresolve',
    patterns: [/npm ERR!.*code ERESOLVE/i, /ERESOLVE/i, /peer dep/i],
    userMessage: 'Some tools have conflicting versions. Trying an alternative install method...',
    actions: [
      { label: 'Retry', actionId: 'retry_npm_legacy', variant: 'primary' },
      { label: 'Skip', actionId: 'skip', variant: 'secondary' },
    ],
    autoFix: async (ctx) => {
      if (!ctx.command?.includes('npm install')) return false;
      try {
        const retryCmd = ctx.command + ' --legacy-peer-deps';
        const parts = retryCmd.split(/\s+/);
        await execFileAsync(parts[0], parts.slice(1), { cwd: ctx.cwd, timeout: 120000 });
        return true;
      } catch {
        return false;
      }
    },
  },

  // --- Git ---
  {
    category: 'git_not_repo',
    patterns: [/fatal: not a git repository/i],
    userMessage: 'Setting up version history for this project...',
    actions: [],
    autoFix: async (ctx) => {
      try {
        await execFileAsync('git', ['init'], { cwd: ctx.cwd, timeout: 10000 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    category: 'git_remote_exists',
    patterns: [/fatal: remote origin already exists/i],
    userMessage: 'Updating the connection to GitHub...',
    actions: [],
    autoFix: async (ctx) => {
      try {
        await execFileAsync('git', ['remote', 'remove', 'origin'], { cwd: ctx.cwd, timeout: 10000 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    category: 'git_push_failed',
    patterns: [/error: failed to push/i, /rejected.*non-fast-forward/i, /Updates were rejected/i],
    userMessage: 'Your online copy has newer changes. Syncing...',
    actions: [
      { label: 'Open in VS Code to resolve', actionId: 'open_vscode', variant: 'primary' },
      { label: 'Skip', actionId: 'skip', variant: 'secondary' },
    ],
    autoFix: async (ctx) => {
      try {
        await execFileAsync('git', ['pull', '--rebase'], { cwd: ctx.cwd, timeout: 30000 });
        await execFileAsync('git', ['push'], { cwd: ctx.cwd, timeout: 30000 });
        return true;
      } catch {
        return false;
      }
    },
  },
  {
    category: 'git_identity',
    patterns: [/Author identity unknown/i, /Please tell me who you are/i],
    userMessage: "Git needs to know your name. What name should appear on your work?",
    actions: [
      { label: 'Set Identity', actionId: 'set_git_identity', variant: 'primary' },
    ],
  },

  // --- GitHub CLI ---
  {
    category: 'gh_not_found',
    patterns: [/gh:?\s*command not found/i, /gh is not recognized/i],
    userMessage: "GitHub CLI isn't installed.",
    actions: [
      { label: 'Install Now', actionId: 'install_gh', variant: 'primary' },
      { label: 'Skip GitHub features', actionId: 'skip', variant: 'secondary' },
    ],
  },
  {
    category: 'gh_auth',
    patterns: [/HTTP 401/i, /not logged in/i, /gh auth login/i, /authentication required/i],
    userMessage: 'Your GitHub session expired.',
    actions: [
      { label: 'Reconnect', actionId: 'gh_login', variant: 'primary' },
      { label: 'Skip', actionId: 'skip', variant: 'secondary' },
    ],
  },
  {
    category: 'gh_repo_exists',
    patterns: [/HTTP 422/i, /Name already exists/i, /already exists on/i],
    userMessage: 'A project with this name already exists on GitHub.',
    actions: [
      { label: 'Use a different name', actionId: 'rename_repo', variant: 'primary' },
      { label: 'Link to existing', actionId: 'link_repo', variant: 'secondary' },
    ],
  },

  // --- AI Agent ---
  {
    category: 'agent_not_found',
    patterns: [/claude:?\s*command not found/i, /gemini:?\s*command not found/i, /codex:?\s*command not found/i],
    userMessage: "The AI agent isn't installed.",
    actions: [
      { label: 'Install Now', actionId: 'install_agent', variant: 'primary' },
    ],
  },
  {
    category: 'agent_auth',
    patterns: [/Authentication required/i, /API key/i, /unauthorized/i, /not authenticated/i],
    userMessage: 'You need to log in to use this AI assistant.',
    actions: [
      { label: 'Log In', actionId: 'agent_login', variant: 'primary' },
    ],
  },
  {
    category: 'agent_timeout',
    patterns: [/ETIMEDOUT/i, /ECONNREFUSED/i, /timed?\s*out/i, /ECONNRESET/i],
    userMessage: 'The AI assistant is taking a while to respond.',
    actions: [
      { label: 'Try Again', actionId: 'retry', variant: 'primary' },
      { label: 'Open Manually', actionId: 'open_terminal', variant: 'secondary' },
    ],
    autoFix: async () => {
      // Single retry with brief delay
      await new Promise((r) => setTimeout(r, 2000));
      return false; // caller should retry the original command
    },
  },

  // --- File system ---
  {
    category: 'fs_no_space',
    patterns: [/ENOSPC/i, /no space left/i],
    userMessage: "Your computer's storage is full. You'll need to free up some space before creating new projects.",
    actions: [],
  },
  {
    category: 'fs_permission',
    patterns: [/EPERM.*operation not permitted/i, /EPERM/],
    userMessage: "We don't have permission to write to this folder.",
    actions: [
      { label: 'Choose a different folder', actionId: 'select_directory', variant: 'primary' },
    ],
  },
  {
    category: 'fs_exists',
    patterns: [/EEXIST.*file already exists/i, /EEXIST/],
    userMessage: 'A project with this name already exists in this folder.',
    actions: [
      { label: 'Use a different name', actionId: 'rename', variant: 'primary' },
      { label: 'Open existing project', actionId: 'open_existing', variant: 'secondary' },
    ],
  },

  // --- WSL ---
  {
    category: 'wsl_not_found',
    patterns: [/wsl:?\s*command not found/i, /wsl.*not installed/i, /is not recognized.*wsl/i],
    userMessage: "WSL isn't set up yet. WSL gives you the best AI coding experience.",
    actions: [
      { label: 'Install WSL', actionId: 'install_wsl', variant: 'primary' },
      { label: 'Continue without WSL', actionId: 'skip', variant: 'secondary' },
    ],
  },
  {
    category: 'wsl_no_distro',
    patterns: [/no installed distributions/i, /WslRegisterDistribution/i],
    userMessage: 'WSL needs a Linux system installed.',
    actions: [
      { label: 'Install Ubuntu', actionId: 'install_ubuntu', variant: 'primary' },
      { label: 'Skip', actionId: 'skip', variant: 'secondary' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Main recovery function
// ---------------------------------------------------------------------------

/**
 * Attempt to recover from an error. Tries auto-fix first, then returns
 * user-facing information if auto-fix fails.
 */
export async function attemptRecovery(context: ErrorContext): Promise<RecoveryResult> {
  const errorStr = context.error || '';

  // Find matching pattern
  for (const pattern of errorPatterns) {
    const matches = pattern.patterns.some((p) => p.test(errorStr));
    const exitCodeMatches = pattern.exitCodes
      ? context.exitCode !== undefined && pattern.exitCodes.includes(context.exitCode)
      : false;

    if (!matches && !exitCodeMatches) continue;

    // Try auto-fix
    if (pattern.autoFix) {
      try {
        const fixed = await pattern.autoFix(context);
        if (fixed) {
          return {
            recovered: true,
            category: pattern.category,
            userMessage: 'Fixed automatically',
            technicalDetails: errorStr,
            actions: [],
          };
        }
      } catch {
        // Auto-fix failed, fall through to user message
      }
    }

    return {
      recovered: false,
      category: pattern.category,
      userMessage: pattern.userMessage,
      technicalDetails: errorStr,
      actions: pattern.actions,
    };
  }

  // No pattern matched
  return {
    recovered: false,
    category: 'unknown',
    userMessage: 'Something unexpected went wrong.',
    technicalDetails: errorStr,
    actions: [
      { label: 'Try Again', actionId: 'retry', variant: 'primary' },
    ],
  };
}

/**
 * Classify an error string into a category without attempting recovery.
 */
export function classifyError(errorStr: string): ErrorCategory {
  for (const pattern of errorPatterns) {
    if (pattern.patterns.some((p) => p.test(errorStr))) {
      return pattern.category;
    }
  }
  return 'unknown';
}

/**
 * Determine if an error is blocking (no workaround) vs recoverable.
 */
export function isBlockingError(category: ErrorCategory): boolean {
  return category === 'fs_no_space';
}
