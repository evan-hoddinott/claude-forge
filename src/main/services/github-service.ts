import { spawn } from 'node:child_process';
import type { GitHubRepo } from '../../shared/types';
import { isValidRepoName, sanitizeDescription, isValidUrl } from '../utils/sanitize';
import { runExecFile } from '../utils/run-command';

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
    '--source', '.',
    '--remote', 'origin',
    '--push',
  ];

  if (safeDescription) {
    args.push('--description', safeDescription);
  }

  await runExecFile('gh', args, { cwd: projectPath });

  // gh repo create doesn't support --json; get repo info separately
  const { stdout: viewOut } = await runExecFile(
    'gh',
    ['repo', 'view', '--json', 'url,nameWithOwner,name'],
    { cwd: projectPath },
  );
  const result = JSON.parse(viewOut);

  return {
    name: result.name ?? name,
    url: result.url,
    fullName: result.nameWithOwner,
  };
}

export async function listRepos(): Promise<GitHubRepo[]> {
  const { stdout } = await runExecFile('gh', [
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

export async function cloneRepo(
  url: string,
  destination: string,
  onProgress: (data: { message: string; done: boolean; error?: string }) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // git clone --progress emits progress info on stderr
    const child = spawn('git', ['clone', '--progress', url, destination], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout?.on('data', (d: Buffer) => {
      onProgress({ message: d.toString(), done: false });
    });
    child.stderr?.on('data', (d: Buffer) => {
      onProgress({ message: d.toString(), done: false });
    });
    child.on('close', (code) => {
      if (code === 0) {
        onProgress({ message: 'Clone complete.\n', done: true });
        resolve();
      } else {
        const err = `git clone exited with code ${code}`;
        onProgress({ message: err, done: true, error: err });
        reject(new Error(err));
      }
    });
    child.on('error', (err) => {
      onProgress({ message: err.message, done: true, error: err.message });
      reject(err);
    });
  });
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
    await runExecFile('git', ['remote', 'get-url', 'origin'], {
      cwd: projectPath,
    });
    // Remote exists — update it
    await runExecFile('git', ['remote', 'set-url', 'origin', repoUrl], {
      cwd: projectPath,
    });
  } catch {
    // Remote doesn't exist — add it
    await runExecFile('git', ['remote', 'add', 'origin', repoUrl], {
      cwd: projectPath,
    });
  }

  await runExecFile('git', ['push', '-u', 'origin', 'main'], {
    cwd: projectPath,
  });
}
