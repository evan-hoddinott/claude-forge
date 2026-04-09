import AdmZip from 'adm-zip';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { app, dialog } from 'electron';
import type { VibeExportOptions, VibeImportPreview, VibeManifest, Project } from '../../shared/types';
import * as store from '../store';

const MAX_BUNDLE_SIZE = 10 * 1024 * 1024; // 10MB

// ── Helpers ───────────────────────────────────────────────────────────────────

function getForgeVersion(): string {
  try {
    return app.getVersion();
  } catch {
    return '1.0.0';
  }
}

async function tryReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function runGitLog(projectPath: string): Promise<string | null> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);
    const { stdout } = await execFileAsync('git', ['log', '--oneline', '-20'], {
      cwd: projectPath,
      timeout: 5000,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

// ── Smart context generation ───────────────────────────────────────────────────

async function generateDecisions(project: Project): Promise<string> {
  const sections: string[] = ['# Coding Decisions\n\n*Auto-generated from project analysis.*'];

  // Analyze package.json
  const pkgRaw = await tryReadFile(path.join(project.path, 'package.json'));
  if (pkgRaw) {
    try {
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        scripts?: Record<string, string>;
      };
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const topDeps = Object.entries(allDeps).slice(0, 15).map(([k, v]) => `- ${k}: ${v}`).join('\n');
      if (topDeps) {
        sections.push(`## Dependencies\n\nKey packages chosen for this project:\n\n${topDeps}`);
      }
      if (pkg.scripts) {
        const scripts = Object.entries(pkg.scripts).map(([k, v]) => `- \`${k}\`: ${v}`).join('\n');
        sections.push(`## Scripts\n\n${scripts}`);
      }
    } catch {
      // skip
    }
  }

  // Analyze tsconfig.json
  const tsRaw = await tryReadFile(path.join(project.path, 'tsconfig.json'));
  if (tsRaw) {
    try {
      const ts = JSON.parse(tsRaw) as { compilerOptions?: Record<string, unknown> };
      const opts = ts.compilerOptions ?? {};
      const notable = [];
      if (opts.strict) notable.push('TypeScript strict mode is enabled');
      if (opts.target) notable.push(`Target: ${opts.target}`);
      if (opts.module) notable.push(`Module: ${opts.module}`);
      if (opts.paths) notable.push('Path aliases configured');
      if (notable.length > 0) {
        sections.push(`## TypeScript Configuration\n\n${notable.map(n => `- ${n}`).join('\n')}`);
      }
    } catch {
      // skip
    }
  }

  // Git history
  const gitLog = await runGitLog(project.path);
  if (gitLog) {
    sections.push(`## Recent Git History\n\nLast commits show project evolution:\n\n\`\`\`\n${gitLog}\n\`\`\``);
  }

  // Project inputs as decisions
  if (project.inputs.length > 0) {
    const inputSections = project.inputs
      .filter((i) => i.value.trim())
      .map((i) => `### ${i.label}\n\n${i.value}`)
      .join('\n\n');
    if (inputSections) {
      sections.push(`## Project Specifications\n\nContext captured at project creation:\n\n${inputSections}`);
    }
  }

  return sections.join('\n\n');
}

async function generatePatterns(project: Project): Promise<string> {
  const sections: string[] = ['# Code Patterns & Conventions\n\n*Auto-generated from project analysis.*'];

  try {
    // Scan directory for file naming patterns
    const entries = await fs.readdir(project.path, { recursive: true, withFileTypes: true });
    const files = (entries as import('node:fs').Dirent[])
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => !name.startsWith('.') && !name.includes('node_modules'));

    // Detect test patterns
    const testFiles = files.filter((f) => /\.(test|spec)\.(ts|tsx|js|jsx|py)$/.test(f));
    const hasVitest = files.some((f) => f === 'vitest.config.ts' || f === 'vitest.config.js');
    const hasJest = files.some((f) => f === 'jest.config.ts' || f === 'jest.config.js');
    if (testFiles.length > 0) {
      const framework = hasVitest ? 'Vitest' : hasJest ? 'Jest' : 'unknown framework';
      sections.push(`## Testing\n\n- Test framework: ${framework}\n- Test files follow the \`*.test.*\` / \`*.spec.*\` convention\n- ${testFiles.length} test file(s) found`);
    }

    // Detect React/component patterns
    const tsxFiles = files.filter((f) => f.endsWith('.tsx'));
    if (tsxFiles.length > 0) {
      const hasHooks = files.some((f) => f.startsWith('use') && f.endsWith('.ts'));
      sections.push(
        `## React Component Patterns\n\n- ${tsxFiles.length} TSX component file(s)\n- Functional components with hooks${hasHooks ? '\n- Custom hooks detected (files starting with `use`)' : ''}\n- TypeScript strict mode for type safety`,
      );
    }

    // Detect naming conventions from dir structure
    const dirs = (entries as import('node:fs').Dirent[])
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => !name.startsWith('.') && name !== 'node_modules' && name !== 'dist' && name !== '.vite');

    if (dirs.length > 0) {
      sections.push(`## Directory Structure\n\nTop-level directories:\n${dirs.slice(0, 10).map((d) => `- \`${d}/\``).join('\n')}`);
    }

    // File naming convention detection
    const camelCase = files.filter((f) => /^[a-z][a-zA-Z0-9]+\.[a-z]+$/.test(f)).length;
    const kebabCase = files.filter((f) => /^[a-z][a-z0-9-]+\.[a-z]+$/.test(f)).length;
    const pascalCase = files.filter((f) => /^[A-Z][a-zA-Z0-9]+\.[a-z]+$/.test(f)).length;
    const dominant = Math.max(camelCase, kebabCase, pascalCase);
    if (dominant > 2) {
      const convention = dominant === camelCase ? 'camelCase' : dominant === kebabCase ? 'kebab-case' : 'PascalCase';
      sections.push(`## File Naming\n\n- Primary convention: **${convention}**\n- Component files: PascalCase (e.g. \`MyComponent.tsx\`)\n- Utility files: camelCase or kebab-case`);
    }
  } catch {
    sections.push('## Patterns\n\n*Could not auto-detect patterns — document conventions here.*');
  }

  return sections.join('\n\n');
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function exportVibe(options: VibeExportOptions): Promise<string | null> {
  const project = store.getProjectById(options.projectId);
  if (!project) throw new Error('Project not found');

  const zip = new AdmZip();

  const manifest: VibeManifest = {
    name: options.name || project.name,
    version: '1.0.0',
    vibeVersion: '1',
    description: options.description || project.description,
    author: options.author,
    created: new Date().toISOString(),
    forgeVersion: getForgeVersion(),
    tags: options.tags,
    category: 'general',
    constraints: {
      hardware: null,
      os: [],
      minNodeVersion: '18',
      requiredTools: [],
    },
  };

  zip.addFile('vibe-bundle/manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  // README
  const readme = `# ${manifest.name}\n\n${manifest.description}\n\n**Author:** ${manifest.author}  \n**Created:** ${new Date(manifest.created).toLocaleDateString()}  \n**Tags:** ${manifest.tags.join(', ')}\n\n---\n\n*This .vibe bundle was created with Claude Forge.*\n`;
  zip.addFile('vibe-bundle/README.md', Buffer.from(readme));

  // Project config
  if (options.includeProjectConfig) {
    const config = {
      name: project.name,
      description: project.description,
      tags: project.tags,
      inputs: project.inputs,
      preferredAgent: project.preferredAgent,
      agents: project.agents,
    };
    zip.addFile('vibe-bundle/project-config.json', Buffer.from(JSON.stringify(config, null, 2)));
  }

  // Context files
  if (options.includeContextFiles) {
    const contextFiles = [
      { agentFile: 'CLAUDE.md', bundlePath: 'vibe-bundle/context/CLAUDE.md' },
      { agentFile: 'GEMINI.md', bundlePath: 'vibe-bundle/context/GEMINI.md' },
      { agentFile: 'codex.md', bundlePath: 'vibe-bundle/context/codex.md' },
      { agentFile: '.github/copilot-instructions.md', bundlePath: 'vibe-bundle/context/copilot-instructions.md' },
    ];
    for (const { agentFile, bundlePath } of contextFiles) {
      const content = await tryReadFile(path.join(project.path, agentFile));
      if (content) {
        zip.addFile(bundlePath, Buffer.from(content));
      }
    }
  }

  // Memory files
  if (options.includeDecisionFiles) {
    const decisions = await generateDecisions(project);
    const patterns = await generatePatterns(project);
    zip.addFile('vibe-bundle/memory/decisions.md', Buffer.from(decisions));
    zip.addFile('vibe-bundle/memory/patterns.md', Buffer.from(patterns));

    // Include known-issues if it exists in the project
    const knownIssues = await tryReadFile(path.join(project.path, 'KNOWN_ISSUES.md'))
      ?? await tryReadFile(path.join(project.path, 'known-issues.md'));
    if (knownIssues) {
      zip.addFile('vibe-bundle/memory/known-issues.md', Buffer.from(knownIssues));
    }
  }

  // Constraints
  if (options.includeConstraints) {
    const constraintsTemplate = {
      hardware: null,
      software: {},
      rules: [],
    };
    zip.addFile('vibe-bundle/constraints.json', Buffer.from(JSON.stringify(constraintsTemplate, null, 2)));
  }

  // Save dialog
  const safeName = (options.name || project.name).replace(/[^a-zA-Z0-9-_]/g, '-');
  const result = await dialog.showSaveDialog({
    title: 'Export .vibe Bundle',
    defaultPath: `${safeName}.vibe`,
    filters: [{ name: 'Vibe Bundle', extensions: ['vibe'] }],
  });

  if (result.canceled || !result.filePath) return null;

  zip.writeZip(result.filePath);
  return result.filePath;
}

// ── Preview ───────────────────────────────────────────────────────────────────

export async function previewVibe(filePath: string): Promise<VibeImportPreview> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_BUNDLE_SIZE) {
    throw new Error('Bundle file exceeds the 10MB size limit');
  }

  const zip = new AdmZip(filePath);
  const entries = zip.getEntries().map((e) => e.entryName);

  const manifestEntry = zip.getEntry('vibe-bundle/manifest.json');
  if (!manifestEntry) throw new Error('Invalid .vibe bundle: missing manifest.json');

  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as VibeManifest;

  const contextFiles = entries.filter((e) => e.startsWith('vibe-bundle/context/'));
  const hasContextFiles = contextFiles.length > 0;
  const hasProjectConfig = entries.includes('vibe-bundle/project-config.json');
  const hasDecisions = entries.some((e) => e.startsWith('vibe-bundle/memory/'));
  const hasConstraints = entries.includes('vibe-bundle/constraints.json');
  const hasChatHistory = entries.includes('vibe-bundle/memory/chat-history.json');

  return {
    manifest,
    hasContextFiles,
    contextFileCount: contextFiles.length,
    hasProjectConfig,
    hasDecisions,
    hasConstraints,
    hasChatHistory,
  };
}

// ── Import ────────────────────────────────────────────────────────────────────

export async function importVibe(
  filePath: string,
  mode: 'new' | 'merge',
  projectPath: string,
  projectId?: string,
  projectName?: string,
): Promise<Project | null> {
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_BUNDLE_SIZE) {
    throw new Error('Bundle file exceeds the 10MB size limit');
  }

  const zip = new AdmZip(filePath);

  const manifestEntry = zip.getEntry('vibe-bundle/manifest.json');
  if (!manifestEntry) throw new Error('Invalid .vibe bundle: missing manifest.json');

  const manifest = JSON.parse(manifestEntry.getData().toString('utf-8')) as VibeManifest;

  const contextFileMap: Record<string, string> = {
    'vibe-bundle/context/CLAUDE.md': 'CLAUDE.md',
    'vibe-bundle/context/GEMINI.md': 'GEMINI.md',
    'vibe-bundle/context/codex.md': 'codex.md',
    'vibe-bundle/context/copilot-instructions.md': '.github/copilot-instructions.md',
  };

  if (mode === 'new') {
    await fs.mkdir(projectPath, { recursive: true });

    // Write context files
    for (const [bundlePath, destRelPath] of Object.entries(contextFileMap)) {
      const entry = zip.getEntry(bundlePath);
      if (entry) {
        const destPath = path.join(projectPath, destRelPath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, entry.getData());
      }
    }

    // Write memory files as vibe-memory/
    const memEntries = zip.getEntries().filter((e) => e.entryName.startsWith('vibe-bundle/memory/'));
    for (const entry of memEntries) {
      const relPath = entry.entryName.replace('vibe-bundle/memory/', '');
      const destPath = path.join(projectPath, 'vibe-memory', relPath);
      await fs.mkdir(path.dirname(destPath), { recursive: true });
      await fs.writeFile(destPath, entry.getData());
    }

    // Parse project config from bundle if present
    let bundledInputs: Project['inputs'] = [];
    let bundledTags: string[] = manifest.tags ?? [];
    let bundledPreferredAgent: Project['preferredAgent'] = 'claude';

    const configEntry = zip.getEntry('vibe-bundle/project-config.json');
    if (configEntry) {
      try {
        const config = JSON.parse(configEntry.getData().toString('utf-8')) as {
          inputs?: Project['inputs'];
          tags?: string[];
          preferredAgent?: Project['preferredAgent'];
        };
        bundledInputs = config.inputs ?? [];
        bundledTags = config.tags ?? bundledTags;
        bundledPreferredAgent = config.preferredAgent ?? bundledPreferredAgent;
      } catch {
        // use defaults
      }
    }

    const project = store.createProject({
      name: projectName || manifest.name,
      description: manifest.description,
      path: projectPath,
      inputs: bundledInputs,
      tags: bundledTags,
      preferredAgent: bundledPreferredAgent,
    });

    return project;
  } else {
    // Merge mode — apply context files to existing project
    let existingProject: Project | undefined;

    if (projectId) {
      existingProject = store.getProjectById(projectId);
    }
    if (!existingProject) {
      const all = store.getAllProjects();
      existingProject = all.find((p) => p.path === projectPath);
    }
    if (!existingProject) throw new Error('Could not find existing project');

    // Write/overwrite context files
    for (const [bundlePath, destRelPath] of Object.entries(contextFileMap)) {
      const entry = zip.getEntry(bundlePath);
      if (entry) {
        const destPath = path.join(existingProject.path, destRelPath);
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, entry.getData());
      }
    }

    // Merge tags
    const mergedTags = [...new Set([...existingProject.tags, ...manifest.tags])];
    const updated = store.updateProject(existingProject.id, { tags: mergedTags });
    return updated;
  }
}
