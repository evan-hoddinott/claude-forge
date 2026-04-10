import AdmZip from 'adm-zip';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { app, dialog } from 'electron';
import type { SnapshotExportOptions, SnapshotImportPreview, SnapshotManifest, Project } from '../../shared/types';
import * as store from '../store';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getForgeVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '1.0.0';
  }
}

async function tryReadFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch {
    return null;
  }
}

/** Returns project-relative paths of all files that should be included in source/. */
async function getSourceFiles(projectPath: string): Promise<string[]> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    // Tracked files
    const { stdout: tracked } = await execFileAsync(
      'git', ['ls-files', '-z'],
      { cwd: projectPath, timeout: 15000 },
    );
    // Untracked but not ignored
    const { stdout: untracked } = await execFileAsync(
      'git', ['ls-files', '-z', '--others', '--exclude-standard'],
      { cwd: projectPath, timeout: 15000 },
    );

    const all = [...tracked.split('\0'), ...untracked.split('\0')]
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    return [...new Set(all)];
  } catch {
    return fallbackWalk(projectPath, projectPath);
  }
}

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', '.vite', '__pycache__',
  '.next', 'build', 'coverage', '.cache', 'out', '.output',
]);

async function fallbackWalk(baseDir: string, currentDir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        results.push(...await fallbackWalk(baseDir, fullPath));
      } else if (entry.isFile()) {
        results.push(path.relative(baseDir, fullPath));
      }
    }
  } catch { /* skip unreadable dirs */ }
  return results;
}

/** Rough estimate of source bytes without loading all file contents. */
async function sumFileSizes(projectPath: string, relativePaths: string[]): Promise<number> {
  let total = 0;
  const cap = Math.min(relativePaths.length, 2000);
  for (let i = 0; i < cap; i++) {
    try {
      const stat = await fs.stat(path.join(projectPath, relativePaths[i]));
      total += stat.size;
    } catch { /* skip */ }
  }
  return total;
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function estimateSize(
  projectId: string,
  includeSource: boolean,
  includeGit: boolean,
): Promise<number> {
  const project = store.getProjectById(projectId);
  if (!project) return 0;

  let total = 0;
  if (includeSource) {
    const files = await getSourceFiles(project.path);
    total += await sumFileSizes(project.path, files);
  }
  if (includeGit) {
    // Rough heuristic: .git/pack files are a good indicator of bundle size
    try {
      const packDir = path.join(project.path, '.git', 'objects', 'pack');
      const packs = await fs.readdir(packDir);
      for (const pack of packs.filter((f) => f.endsWith('.pack'))) {
        const stat = await fs.stat(path.join(packDir, pack));
        total += stat.size;
      }
    } catch {
      total += 2 * 1024 * 1024; // fallback 2MB
    }
  }
  return total;
}

export async function exportSnapshot(options: SnapshotExportOptions): Promise<string | null> {
  const project = store.getProjectById(options.projectId);
  if (!project) throw new Error('Project not found');

  const zip = new AdmZip();
  const warnings: string[] = [];

  // ── manifest.json ─────────────────────────────────────────────────────────
  const manifest: SnapshotManifest = {
    name: project.name,
    description: project.description,
    snapshotVersion: '1',
    created: new Date().toISOString(),
    forgeVersion: getForgeVersion(),
    projectId: project.id,
    includes: {
      source: options.includeSource,
      git: options.includeGit,
      vibe: options.includeVibe,
      chatHistory: options.includeChatHistory,
      apiKeys: options.includeApiKeys,
    },
    warnings: [],
  };

  // ── settings/project-config.json ──────────────────────────────────────────
  const config = {
    name: project.name,
    description: project.description,
    tags: project.tags,
    inputs: project.inputs,
    preferredAgent: project.preferredAgent,
    agents: project.agents,
    githubRepo: project.githubRepo,
    githubUrl: project.githubUrl,
    status: project.status,
  };
  zip.addFile('settings/project-config.json', Buffer.from(JSON.stringify(config, null, 2)));

  // ── vibe-bundle/ ──────────────────────────────────────────────────────────
  if (options.includeVibe) {
    const vibeManifest = {
      name: project.name,
      version: '1.0.0',
      vibeVersion: '1',
      description: project.description,
      created: manifest.created,
      forgeVersion: manifest.forgeVersion,
      tags: project.tags,
      category: 'snapshot',
      constraints: { hardware: null, os: [], minNodeVersion: '18', requiredTools: [] },
    };
    zip.addFile('vibe-bundle/manifest.json', Buffer.from(JSON.stringify(vibeManifest, null, 2)));

    const contextFiles: Array<[string, string]> = [
      ['CLAUDE.md', 'vibe-bundle/context/CLAUDE.md'],
      ['GEMINI.md', 'vibe-bundle/context/GEMINI.md'],
      ['codex.md', 'vibe-bundle/context/codex.md'],
      ['.github/copilot-instructions.md', 'vibe-bundle/context/copilot-instructions.md'],
    ];
    for (const [src, dest] of contextFiles) {
      const buf = await tryReadFile(path.join(project.path, src));
      if (buf) {
        // Strip absolute project path from context files
        const sanitized = buf.toString('utf-8').replace(
          new RegExp(project.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
          '.',
        );
        zip.addFile(dest, Buffer.from(sanitized));
      }
    }
  }

  // ── source/ ───────────────────────────────────────────────────────────────
  if (options.includeSource) {
    const files = await getSourceFiles(project.path);
    const envFiles: string[] = [];

    for (const rel of files) {
      const isEnv = /^\.env(\.|$)/.test(path.basename(rel)) || rel.includes('/.env');
      if (isEnv) {
        envFiles.push(rel);
        // Skip .env files — never include them silently
        continue;
      }

      try {
        const buf = await fs.readFile(path.join(project.path, rel));
        // Skip very large files (>50MB each)
        if (buf.length > 50 * 1024 * 1024) {
          warnings.push(`Skipped large file: ${rel} (${Math.round(buf.length / 1024 / 1024)}MB)`);
          continue;
        }
        zip.addFile(`source/${rel}`, buf);
      } catch { /* skip unreadable */ }
    }

    if (envFiles.length > 0) {
      warnings.push(`Excluded .env file(s): ${envFiles.join(', ')} — secrets were NOT included.`);
    }
  }

  // ── git-bundle/repo.bundle ────────────────────────────────────────────────
  if (options.includeGit) {
    let tmpDir: string | null = null;
    try {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfsnap-git-'));
      const bundlePath = path.join(tmpDir, 'repo.bundle');

      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);

      await execFileAsync('git', ['bundle', 'create', bundlePath, '--all'], {
        cwd: project.path,
        timeout: 60000,
      });

      const bundleData = await fs.readFile(bundlePath);
      zip.addFile('git-bundle/repo.bundle', bundleData);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      warnings.push(`Could not create git bundle: ${msg}`);
    } finally {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch((_e: unknown) => void _e);
      }
    }
  }

  // ── chat-history/chats.json ───────────────────────────────────────────────
  if (options.includeChatHistory) {
    const history = store.getChatHistory(project.id);
    if (history && history.length > 0) {
      zip.addFile('chat-history/chats.json', Buffer.from(JSON.stringify(history, null, 2)));
    }
  }

  // Attach warnings to manifest
  manifest.warnings = warnings;
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  // ── Save dialog ───────────────────────────────────────────────────────────
  const safeName = project.name.replace(/[^a-zA-Z0-9-_]/g, '-');
  const dateStr = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog({
    title: 'Export Project Snapshot',
    defaultPath: `snapshot-${safeName}-${dateStr}.cfsnap`,
    filters: [{ name: 'Claude Forge Snapshot', extensions: ['cfsnap'] }],
  });

  if (result.canceled || !result.filePath) return null;

  zip.writeZip(result.filePath);
  return result.filePath;
}

// ── Preview ───────────────────────────────────────────────────────────────────

export async function previewSnapshot(filePath: string): Promise<SnapshotImportPreview> {
  const stat = await fs.stat(filePath);
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().map((e) => e.entryName);

  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('Invalid .cfsnap file: missing manifest.json');

  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as SnapshotManifest;

  const sourceEntries = entries.filter((e) => e.startsWith('source/'));
  const hasGit = entries.includes('git-bundle/repo.bundle');
  const hasVibe = entries.includes('vibe-bundle/manifest.json');
  const hasChatHistory = entries.includes('chat-history/chats.json');

  return {
    manifest,
    hasSource: sourceEntries.length > 0,
    sourceFileCount: sourceEntries.length,
    hasGit,
    hasVibe,
    hasChatHistory,
    fileSizeBytes: stat.size,
  };
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importSnapshot(
  filePath: string,
  projectPath: string,
  projectName?: string,
): Promise<Project | null> {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().map((e) => e.entryName);

  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) throw new Error('Invalid .cfsnap file: missing manifest.json');
  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as SnapshotManifest;

  const hasGit = entries.includes('git-bundle/repo.bundle');
  const hasSource = entries.some((e) => e.startsWith('source/'));

  // ── Restore git history + tracked files ───────────────────────────────────
  if (hasGit) {
    let tmpDir: string | null = null;
    try {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cfsnap-import-'));
      const bundlePath = path.join(tmpDir, 'repo.bundle');

      const bundleEntry = zip.getEntry('git-bundle/repo.bundle');
      if (bundleEntry) {
        await fs.writeFile(bundlePath, bundleEntry.getData());

        const { execFile } = await import('node:child_process');
        const { promisify } = await import('node:util');
        const execFileAsync = promisify(execFile);

        // Clone from bundle into destination (creates the directory)
        await execFileAsync('git', ['clone', bundlePath, projectPath], {
          timeout: 60000,
        });
      }
    } finally {
      if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true }).catch((_e: unknown) => void _e);
      }
    }
  } else {
    // No git — just create the directory
    await fs.mkdir(projectPath, { recursive: true });
  }

  // ── Extract source files ───────────────────────────────────────────────────
  // (overwrites tracked files with their snapshot state, adds untracked files)
  if (hasSource) {
    const sourceEntries = zip.getEntries().filter((e) => e.entryName.startsWith('source/') && !e.isDirectory);
    for (const entry of sourceEntries) {
      const rel = entry.entryName.slice('source/'.length);
      if (!rel) continue;
      const destPath = path.join(projectPath, rel);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, entry.getData());
    }
  }

  // ── Extract vibe context files ─────────────────────────────────────────────
  const contextFileMap: Record<string, string> = {
    'vibe-bundle/context/CLAUDE.md': 'CLAUDE.md',
    'vibe-bundle/context/GEMINI.md': 'GEMINI.md',
    'vibe-bundle/context/codex.md': 'codex.md',
    'vibe-bundle/context/copilot-instructions.md': '.github/copilot-instructions.md',
  };
  for (const [bundlePath, destRel] of Object.entries(contextFileMap)) {
    const entry = zip.getEntry(bundlePath);
    if (entry) {
      const destPath = path.join(projectPath, destRel);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, entry.getData());
    }
  }

  // ── Parse project config ───────────────────────────────────────────────────
  let inputs: Project['inputs'] = [];
  let tags: string[] = manifest.includes.vibe ? [] : [];
  let preferredAgent: Project['preferredAgent'] = 'claude';

  const configEntry = zip.getEntry('settings/project-config.json');
  if (configEntry) {
    try {
      const config = JSON.parse(configEntry.getData().toString('utf-8')) as {
        inputs?: Project['inputs'];
        tags?: string[];
        preferredAgent?: Project['preferredAgent'];
      };
      inputs = config.inputs ?? [];
      tags = config.tags ?? [];
      preferredAgent = config.preferredAgent ?? 'claude';
    } catch { /* use defaults */ }
  }

  // ── Create project in store ────────────────────────────────────────────────
  const project = store.createProject({
    name: projectName || manifest.name,
    description: manifest.description,
    path: projectPath,
    inputs,
    tags,
    preferredAgent,
  });

  // ── Restore chat history ───────────────────────────────────────────────────
  const chatEntry = zip.getEntry('chat-history/chats.json');
  if (chatEntry) {
    try {
      const history = JSON.parse(chatEntry.getData().toString('utf-8')) as import('../../shared/types').ChatMessage[];
      if (Array.isArray(history) && history.length > 0) {
        store.saveChatHistory(project.id, history);
      }
    } catch { /* skip invalid history */ }
  }

  return project;
}
