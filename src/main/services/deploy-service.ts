/**
 * deploy-service.ts
 * One-click GitHub deployment: git init → .gitignore → stage → commit → create/push.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DeployOptions, DeployResult, DeployStep } from '../../shared/types';
import { isValidRepoName, sanitizeDescription } from '../utils/sanitize';
import { runExecFile } from '../utils/run-command';

type StepCallback = (step: DeployStep) => void;

function step(
  onStep: StepCallback,
  id: string,
  label: string,
  status: DeployStep['status'],
  detail?: string,
): void {
  onStep({ id, label, status, detail });
}

const GITIGNORE_DEFAULTS = `# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
dist/
build/
out/
.next/
.nuxt/

# Environment & secrets
.env
.env.*
!.env.example

# OS / editor
.DS_Store
Thumbs.db
.idea/
.vscode/settings.json

# Logs
*.log
npm-debug.log*

# Misc
*.tsbuildinfo

# Caboo orchestration (ephemeral state — keep config & memory)
.caboo/blackboard/
.caboo/snapshots/
.caboo/security/audit-log.jsonl
.caboo/agents/*/session-log/
`;

async function hasGit(projectPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectPath, '.git'));
    return true;
  } catch {
    return false;
  }
}

async function hasGitignore(projectPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectPath, '.gitignore'));
    return true;
  } catch {
    return false;
  }
}

async function detectEnvFiles(projectPath: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(projectPath);
    return entries.some((f) => f === '.env' || f.startsWith('.env.'));
  } catch {
    return false;
  }
}

export async function deployToGitHub(
  options: DeployOptions,
  onStep: StepCallback,
): Promise<DeployResult> {
  const { projectPath, mode, commitMessage, includeEnvFiles } = options;

  // Validate project path
  try {
    await fs.access(projectPath);
  } catch {
    return { success: false, error: 'Project path does not exist' };
  }

  // Validate repo name for create mode
  if (mode === 'create' && options.repoName && !isValidRepoName(options.repoName)) {
    return {
      success: false,
      error: 'Invalid repository name. Use only letters, numbers, hyphens, underscores, and dots.',
    };
  }

  // ── Step 1: Initialise git ────────────────────────────────────────────────

  step(onStep, 'init', 'Setting up version history', 'running');
  try {
    const gitExists = await hasGit(projectPath);
    if (!gitExists) {
      await runExecFile('git', ['init'], { cwd: projectPath });
    }
    step(onStep, 'init', 'Setting up version history', 'done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git init failed';
    step(onStep, 'init', 'Setting up version history', 'error', msg);
    return { success: false, error: msg };
  }

  // ── Step 2: Create .gitignore ─────────────────────────────────────────────

  step(onStep, 'gitignore', 'Preparing your files', 'running');
  try {
    if (!(await hasGitignore(projectPath))) {
      await fs.writeFile(path.join(projectPath, '.gitignore'), GITIGNORE_DEFAULTS, 'utf-8');
    } else if (!includeEnvFiles) {
      // Ensure .env is ignored — append if not already present
      const existing = await fs.readFile(path.join(projectPath, '.gitignore'), 'utf-8');
      if (!existing.includes('.env')) {
        await fs.appendFile(
          path.join(projectPath, '.gitignore'),
          '\n# Environment\n.env\n.env.*\n!.env.example\n',
        );
      }
    }
    step(onStep, 'gitignore', 'Preparing your files', 'done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : '.gitignore setup failed';
    step(onStep, 'gitignore', 'Preparing your files', 'error', msg);
    return { success: false, error: msg };
  }

  // ── Step 3: Stage files ───────────────────────────────────────────────────

  step(onStep, 'stage', 'Staging files', 'running');
  try {
    if (includeEnvFiles) {
      await runExecFile('git', ['add', '-A'], { cwd: projectPath });
    } else {
      // Stage everything, then unstage .env files
      await runExecFile('git', ['add', '-A'], { cwd: projectPath });
      const envFiles = await detectEnvFiles(projectPath);
      if (envFiles) {
        try {
          await runExecFile('git', ['reset', '--', '.env', '.env.*'], { cwd: projectPath });
        } catch {
          // Ignore if no .env was staged
        }
      }
    }
    step(onStep, 'stage', 'Staging files', 'done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git add failed';
    step(onStep, 'stage', 'Staging files', 'error', msg);
    return { success: false, error: msg };
  }

  // ── Step 4: Commit ────────────────────────────────────────────────────────

  step(onStep, 'commit', 'Saving a snapshot of your work', 'running');
  try {
    // Check if there's anything to commit
    const { stdout: statusOut } = await runExecFile(
      'git',
      ['status', '--porcelain'],
      { cwd: projectPath },
    );
    if (statusOut.trim()) {
      await runExecFile('git', ['commit', '-m', commitMessage], { cwd: projectPath });
    }
    // else: nothing to commit (already up to date) — that's fine
    step(onStep, 'commit', 'Saving a snapshot of your work', 'done');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git commit failed';
    step(onStep, 'commit', 'Saving a snapshot of your work', 'error', msg);
    return { success: false, error: msg };
  }

  // ── Step 5: Create / push repo ────────────────────────────────────────────

  if (mode === 'create') {
    step(onStep, 'remote', 'Creating online copy', 'running');
    try {
      const repoName = options.repoName ?? path.basename(projectPath);
      const visibility = options.isPrivate !== false ? '--private' : '--public';
      const safeDesc = options.description ? sanitizeDescription(options.description) : '';

      const args = [
        'repo', 'create', repoName,
        visibility,
        '--source', '.',
        '--remote', 'origin',
        '--push',
      ];
      if (safeDesc) args.push('--description', safeDesc);

      await runExecFile('gh', args, { cwd: projectPath });
      step(onStep, 'remote', 'Creating online copy', 'done');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'gh repo create failed';
      step(onStep, 'remote', 'Creating online copy', 'error', raw);
      // Detect name-taken error
      if (raw.includes('already exists') || raw.includes('Name already taken')) {
        return { success: false, error: 'REPO_EXISTS' };
      }
      return { success: false, error: raw };
    }

    // Get the URL from the newly created repo
    step(onStep, 'upload', 'Uploading to GitHub', 'running');
    try {
      const { stdout } = await runExecFile(
        'gh',
        ['repo', 'view', '--json', 'url'],
        { cwd: projectPath },
      );
      const { url } = JSON.parse(stdout) as { url: string };
      step(onStep, 'upload', 'Uploading to GitHub', 'done');
      return { success: true, repoUrl: url };
    } catch {
      step(onStep, 'upload', 'Uploading to GitHub', 'done');
      return { success: true };
    }
  } else {
    // Push to existing repo
    step(onStep, 'remote', 'Connecting to repository', 'running');
    try {
      const repoUrl = options.repoUrl ?? '';
      // Check/set remote
      try {
        await runExecFile('git', ['remote', 'get-url', 'origin'], { cwd: projectPath });
        // Remote exists — update if URL changed
        if (repoUrl) {
          await runExecFile('git', ['remote', 'set-url', 'origin', repoUrl], { cwd: projectPath });
        }
      } catch {
        if (!repoUrl) throw new Error('Repository URL is required');
        await runExecFile('git', ['remote', 'add', 'origin', repoUrl], { cwd: projectPath });
      }
      step(onStep, 'remote', 'Connecting to repository', 'done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Remote setup failed';
      step(onStep, 'remote', 'Connecting to repository', 'error', msg);
      return { success: false, error: msg };
    }

    step(onStep, 'upload', 'Uploading to GitHub', 'running');
    try {
      // Try push; detect conflict
      try {
        await runExecFile('git', ['push', '-u', 'origin', 'HEAD'], { cwd: projectPath });
      } catch (pushErr) {
        const msg = pushErr instanceof Error ? pushErr.message : '';
        if (
          msg.includes('rejected') ||
          msg.includes('non-fast-forward') ||
          msg.includes('fetch first')
        ) {
          step(onStep, 'upload', 'Uploading to GitHub', 'error', 'CONFLICT');
          return { success: false, error: 'CONFLICT', repoUrl: options.repoUrl };
        }
        throw pushErr;
      }
      step(onStep, 'upload', 'Uploading to GitHub', 'done');
      return { success: true, repoUrl: options.repoUrl };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'git push failed';
      step(onStep, 'upload', 'Uploading to GitHub', 'error', msg);
      return { success: false, error: msg };
    }
  }
}

export async function forcePush(projectPath: string): Promise<DeployResult> {
  try {
    await runExecFile('git', ['push', '-u', 'origin', 'HEAD', '--force'], { cwd: projectPath });
    // Get URL
    try {
      const { stdout } = await runExecFile(
        'git', ['remote', 'get-url', 'origin'], { cwd: projectPath },
      );
      return { success: true, repoUrl: stdout.trim() };
    } catch {
      return { success: true };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Force push failed' };
  }
}
