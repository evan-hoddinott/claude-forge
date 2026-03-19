import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubRepo } from '../../shared/types';
import { isValidRepoName, sanitizeDescription, isValidUrl } from '../utils/sanitize';

const execFileAsync = promisify(execFile);

export async function createRepo(
  name: string,
  isPrivate: boolean,
  description: string,
  projectPath: string,
): Promise<GitHubRepo> {
  // Validate repo name
  if (!isValidRepoName(name)) {
    throw new Error('Invalid repository name. Use only letters, numbers, hyphens, underscores, and dots.');
  }

  const visibility = isPrivate ? '--private' : '--public';
  const safeDescription = sanitizeDescription(description);

  const args = [
    'repo',
    'create',
    name,
    visibility,
    '--source',
    '.',
    '--remote',
    'origin',
    '--push',
    '--json',
    'url,nameWithOwner,name',
  ];

  if (safeDescription) {
    args.push('--description', safeDescription);
  }

  const { stdout } = await execFileAsync('gh', args, { cwd: projectPath });
  const result = JSON.parse(stdout);

  return {
    name: result.name ?? name,
    url: result.url,
    fullName: result.nameWithOwner,
  };
}

export async function listRepos(): Promise<GitHubRepo[]> {
  const { stdout } = await execFileAsync('gh', [
    'repo',
    'list',
    '--json',
    'name,url,nameWithOwner,description,isPrivate',
    '--limit',
    '50',
  ]);

  const repos: {
    name: string;
    url: string;
    nameWithOwner: string;
  }[] = JSON.parse(stdout);

  return repos.map((r) => ({
    name: r.name,
    url: r.url,
    fullName: r.nameWithOwner,
  }));
}

export async function linkExistingRepo(
  projectPath: string,
  repoUrl: string,
): Promise<void> {
  // Validate the repo URL
  if (!isValidUrl(repoUrl) && !/^git@[\w.-]+:[\w./-]+\.git$/.test(repoUrl)) {
    throw new Error('Invalid repository URL');
  }

  // Check if remote already exists
  try {
    await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: projectPath,
    });
    // Remote exists — update it
    await execFileAsync('git', ['remote', 'set-url', 'origin', repoUrl], {
      cwd: projectPath,
    });
  } catch {
    // Remote doesn't exist — add it
    await execFileAsync('git', ['remote', 'add', 'origin', repoUrl], {
      cwd: projectPath,
    });
  }

  await execFileAsync('git', ['push', '-u', 'origin', 'main'], {
    cwd: projectPath,
  });
}
