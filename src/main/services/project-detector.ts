import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { DetectedProject, ProjectInput } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { runExecFile } from '../utils/run-command';

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readSafe(p: string): Promise<string | null> {
  try {
    return await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
}

export async function detectProject(folderPath: string): Promise<DetectedProject> {
  let name = path.basename(folderPath);
  let description = '';
  const languages: string[] = [];
  let framework: string | null = null;
  let packageManager: string | null = null;
  let hasGit = false;
  let gitRemote: string | null = null;
  const existingContextFiles: string[] = [];
  const detectedInputs: ProjectInput[] = [];

  // ── Git detection ─────────────────────────────────────────────────────────
  try {
    await runExecFile('git', ['-C', folderPath, 'rev-parse', '--git-dir']);
    hasGit = true;
    try {
      const { stdout: remoteOut } = await runExecFile('git', ['-C', folderPath, 'remote', 'get-url', 'origin']);
      const raw = remoteOut.trim();
      // Normalize SSH → HTTPS: git@github.com:user/repo.git → https://github.com/user/repo
      gitRemote = raw
        .replace(/^git@([^:]+):/, 'https://$1/')
        .replace(/\.git$/, '');
    } catch {
      // no remote
    }
  } catch {
    // no git repo
  }

  // ── Existing context files ────────────────────────────────────────────────
  for (const config of Object.values(AGENTS)) {
    if (await exists(path.join(folderPath, config.contextFileName))) {
      existingContextFiles.push(config.contextFileName);
    }
  }

  // ── package.json → Node.js / JS ecosystem ────────────────────────────────
  const pkgRaw = await readSafe(path.join(folderPath, 'package.json'));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as Record<string, unknown>;
      if (pkg.name && typeof pkg.name === 'string') name = pkg.name;
      if (pkg.description && typeof pkg.description === 'string') description = pkg.description;
      languages.push('JavaScript');
      const deps = {
        ...(typeof pkg.dependencies === 'object' && pkg.dependencies ? pkg.dependencies : {}),
        ...(typeof pkg.devDependencies === 'object' && pkg.devDependencies ? pkg.devDependencies : {}),
      } as Record<string, unknown>;
      if ('typescript' in deps) languages.push('TypeScript');
      // Framework detection — first match wins for top-level frameworks
      if ('next' in deps)               framework = 'Next.js';
      else if ('@angular/core' in deps) framework = 'Angular';
      else if ('react' in deps)         framework = 'React';
      else if ('vue' in deps)           framework = 'Vue';
      else if ('svelte' in deps)        framework = 'Svelte';
      else if ('electron' in deps)      framework = 'Electron';
      else if ('fastify' in deps)       framework = 'Fastify';
      else if ('express' in deps)       framework = 'Express';
      else if ('koa' in deps)           framework = 'Koa';
      // Package manager
      if (await exists(path.join(folderPath, 'pnpm-lock.yaml')))   packageManager = 'pnpm';
      else if (await exists(path.join(folderPath, 'bun.lockb')))   packageManager = 'bun';
      else if (await exists(path.join(folderPath, 'yarn.lock')))   packageManager = 'yarn';
      else                                                          packageManager = 'npm';
    } catch {
      // invalid JSON — ignore
    }
  }

  // ── Python ────────────────────────────────────────────────────────────────
  if (
    await exists(path.join(folderPath, 'requirements.txt')) ||
    await exists(path.join(folderPath, 'setup.py')) ||
    await exists(path.join(folderPath, 'pyproject.toml'))
  ) {
    if (!languages.includes('Python')) languages.push('Python');
    if (!packageManager) packageManager = 'pip';
    const req = await readSafe(path.join(folderPath, 'requirements.txt')) || '';
    const lower = req.toLowerCase();
    if (!framework) {
      if (lower.includes('django'))      framework = 'Django';
      else if (lower.includes('fastapi')) framework = 'FastAPI';
      else if (lower.includes('flask'))  framework = 'Flask';
    }
  }

  // ── Rust ──────────────────────────────────────────────────────────────────
  if (await exists(path.join(folderPath, 'Cargo.toml'))) {
    if (!languages.includes('Rust')) languages.push('Rust');
    if (!packageManager) packageManager = 'cargo';
  }

  // ── Go ────────────────────────────────────────────────────────────────────
  if (await exists(path.join(folderPath, 'go.mod'))) {
    if (!languages.includes('Go')) languages.push('Go');
    if (!packageManager) packageManager = 'go';
  }

  // ── Dart / Flutter ────────────────────────────────────────────────────────
  if (await exists(path.join(folderPath, 'pubspec.yaml'))) {
    if (!languages.includes('Dart')) languages.push('Dart');
    if (!framework) framework = 'Flutter';
    if (!packageManager) packageManager = 'pub';
  }

  // ── Ruby ──────────────────────────────────────────────────────────────────
  if (await exists(path.join(folderPath, 'Gemfile'))) {
    if (!languages.includes('Ruby')) languages.push('Ruby');
    if (!packageManager) packageManager = 'bundler';
    const gemfile = await readSafe(path.join(folderPath, 'Gemfile')) || '';
    if (!framework && gemfile.toLowerCase().includes('rails')) framework = 'Rails';
  }

  // ── Java / Kotlin ─────────────────────────────────────────────────────────
  if (await exists(path.join(folderPath, 'pom.xml'))) {
    if (!languages.includes('Java')) languages.push('Java');
    if (!packageManager) packageManager = 'maven';
  } else if (
    await exists(path.join(folderPath, 'build.gradle')) ||
    await exists(path.join(folderPath, 'build.gradle.kts'))
  ) {
    if (!languages.includes('Java')) languages.push('Java');
    if (!packageManager) packageManager = 'gradle';
  }

  // ── README.md → description fallback ─────────────────────────────────────
  if (!description) {
    const readme = await readSafe(path.join(folderPath, 'README.md'));
    if (readme) {
      // Find first non-empty, non-heading, non-badge line
      const firstPara = readme
        .split('\n')
        .find(l => l.trim() && !l.startsWith('#') && !l.startsWith('!') && !l.startsWith('<'));
      if (firstPara) {
        // Strip markdown links
        description = firstPara.trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 250);
      }
    }
  }

  // ── Build detectedInputs ──────────────────────────────────────────────────
  if (languages.length > 0) {
    detectedInputs.push({
      id: uuidv4(),
      label: 'Language',
      value: languages.join(', '),
      type: 'text',
    });
  }
  if (framework) {
    detectedInputs.push({
      id: uuidv4(),
      label: 'Framework',
      value: framework,
      type: 'text',
    });
  }
  if (packageManager) {
    detectedInputs.push({
      id: uuidv4(),
      label: 'Package Manager',
      value: packageManager,
      type: 'text',
    });
  }

  return {
    name,
    path: folderPath,
    description,
    languages,
    framework,
    packageManager,
    hasGit,
    gitRemote,
    existingContextFiles,
    detectedInputs,
  };
}
