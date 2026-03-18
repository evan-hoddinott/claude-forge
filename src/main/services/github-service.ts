import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubRepo } from '../../shared/types';

const execFileAsync = promisify(execFile);

export async function createRepo(
  name: string,
  isPrivate: boolean,
  description: string,
  projectPath: string,
): Promise<GitHubRepo> {
  const visibility = isPrivate ? '--private' : '--public';

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

  if (description) {
    args.push('--description', description);
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
