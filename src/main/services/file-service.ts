import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserWindow } from 'electron';
import ignore from 'ignore';
import type { FSWatcher } from 'chokidar';
import type { FileTreeNode, FileReadResult, GitFileStatus, SearchResult } from '../../shared/types';

const execFileAsync = promisify(execFile);

// --- Language detection from extension ---

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript',
  '.js': 'javascript', '.jsx': 'javascript',
  '.mjs': 'javascript', '.cjs': 'javascript',
  '.py': 'python',
  '.md': 'markdown', '.mdx': 'markdown',
  '.json': 'json', '.jsonc': 'json',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.html': 'html', '.htm': 'html',
  '.xml': 'xml', '.svg': 'xml',
  '.rs': 'rust',
  '.go': 'go',
  '.yaml': 'yaml', '.yml': 'yaml',
  '.toml': 'toml',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.sql': 'sql',
  '.java': 'java',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.hpp': 'cpp',
  '.cs': 'csharp',
  '.rb': 'ruby',
  '.php': 'php',
  '.lua': 'lua',
  '.r': 'r', '.R': 'r',
  '.dart': 'dart',
  '.vue': 'html',
  '.graphql': 'graphql', '.gql': 'graphql',
  '.dockerfile': 'dockerfile',
  '.ini': 'ini',
  '.env': 'ini',
  '.gitignore': 'plaintext',
  '.editorconfig': 'ini',
};

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.avif',
  '.mp3', '.mp4', '.wav', '.ogg', '.avi', '.mov', '.mkv',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.o', '.obj',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.pyc', '.class', '.jar',
]);

// Default ignore patterns (always ignored)
const DEFAULT_IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'out',
  'build',
  '.next',
  '.vite',
  '.cache',
  '.turbo',
  '__pycache__',
  '.DS_Store',
  'Thumbs.db',
];

// --- .gitignore loader ---

async function loadIgnoreFilter(projectPath: string): Promise<(filePath: string) => boolean> {
  const ig = ignore();
  ig.add(DEFAULT_IGNORE);

  try {
    const gitignorePath = path.join(projectPath, '.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');
    ig.add(content);
  } catch {
    // No .gitignore, just use defaults
  }

  return (relativePath: string) => ig.ignores(relativePath);
}

// --- File Tree Builder ---

export async function buildFileTree(projectPath: string): Promise<FileTreeNode[]> {
  const isIgnored = await loadIgnoreFilter(projectPath);
  const gitStatusMap = await getGitStatus(projectPath);

  async function scanDir(dirPath: string): Promise<FileTreeNode[]> {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    const nodes: FileTreeNode[] = [];

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      // Skip hidden files (starting with .) except context files
      if (entry.name.startsWith('.') && !['CLAUDE.md', 'GEMINI.md', 'codex.md'].includes(entry.name)) {
        continue;
      }

      // Check gitignore
      const checkPath = entry.isDirectory() ? relativePath + '/' : relativePath;
      if (isIgnored(checkPath)) continue;

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      const ext = entry.isFile() ? path.extname(entry.name).toLowerCase() : null;

      const node: FileTreeNode = {
        name: entry.name,
        path: fullPath,
        relativePath,
        type: entry.isDirectory() ? 'directory' : 'file',
        extension: ext,
        size: stat.size,
        modifiedAt: stat.mtime.toISOString(),
        gitStatus: gitStatusMap.get(relativePath) ?? null,
      };

      if (entry.isDirectory()) {
        node.children = await scanDir(fullPath);
      }

      nodes.push(node);
    }

    // Sort: directories first (alphabetical), then files (alphabetical)
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return nodes;
  }

  return scanDir(projectPath);
}

// --- File Reader ---

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export async function readFile(filePath: string): Promise<FileReadResult> {
  const ext = path.extname(filePath).toLowerCase();

  if (BINARY_EXTENSIONS.has(ext)) {
    return {
      content: `[Binary file: ${path.basename(filePath)}]\n\nThis is a binary file and cannot be displayed as text.`,
      language: 'plaintext',
      lineCount: 0,
    };
  }

  const stat = await fs.stat(filePath);
  let isTruncated = false;

  let content: string;
  if (stat.size > MAX_FILE_SIZE) {
    const buffer = Buffer.alloc(MAX_FILE_SIZE);
    const fileHandle = await fs.open(filePath, 'r');
    try {
      await fileHandle.read(buffer, 0, MAX_FILE_SIZE, 0);
    } finally {
      await fileHandle.close();
    }
    content = buffer.toString('utf-8');
    isTruncated = true;
  } else {
    content = await fs.readFile(filePath, 'utf-8');
  }

  const language = EXTENSION_LANGUAGE_MAP[ext] ?? detectLanguageFromFilename(path.basename(filePath));
  const lineCount = content.split('\n').length;

  return { content, language, lineCount, isTruncated };
}

function detectLanguageFromFilename(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'dockerfile') return 'dockerfile';
  if (lower === 'makefile') return 'makefile';
  if (lower === 'cmakelists.txt') return 'cmake';
  if (lower === 'gemfile' || lower === 'rakefile') return 'ruby';
  if (lower.endsWith('.lock')) return 'plaintext';
  return 'plaintext';
}

// --- Git Status ---

export async function getGitStatus(projectPath: string): Promise<Map<string, GitFileStatus>> {
  const statusMap = new Map<string, GitFileStatus>();

  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '-u'], {
      cwd: projectPath,
      timeout: 10000,
    });

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      const xy = line.substring(0, 2);
      let filePath = line.substring(3).trim();

      // Handle renamed files (R  old -> new)
      if (filePath.includes(' -> ')) {
        filePath = filePath.split(' -> ')[1];
      }

      let status: GitFileStatus;
      if (xy.startsWith('?')) {
        status = 'untracked';
      } else if (xy.startsWith('A') || xy[1] === 'A') {
        status = 'added';
      } else if (xy.startsWith('D') || xy[1] === 'D') {
        status = 'deleted';
      } else if (xy.startsWith('R') || xy[1] === 'R') {
        status = 'renamed';
      } else if (xy.startsWith('M') || xy[1] === 'M') {
        status = 'modified';
      } else {
        status = 'modified';
      }

      statusMap.set(filePath, status);
    }
  } catch {
    // Not a git repo or git not installed
  }

  return statusMap;
}

// --- File Search (names) ---

export async function searchFileNames(projectPath: string, query: string): Promise<FileTreeNode[]> {
  const isIgnored = await loadIgnoreFilter(projectPath);
  const lowerQuery = query.toLowerCase();
  const results: FileTreeNode[] = [];

  async function walk(dirPath: string) {
    let entries;
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= 50) return;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      if (entry.name.startsWith('.')) continue;
      const checkPath = entry.isDirectory() ? relativePath + '/' : relativePath;
      if (isIgnored(checkPath)) continue;

      if (entry.isFile() && entry.name.toLowerCase().includes(lowerQuery)) {
        let stat;
        try {
          stat = await fs.stat(fullPath);
        } catch {
          continue;
        }
        results.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          type: 'file',
          extension: path.extname(entry.name).toLowerCase() || null,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }

      if (entry.isDirectory()) {
        await walk(fullPath);
      }
    }
  }

  await walk(projectPath);

  // Sort: exact match > starts with > contains
  results.sort((a, b) => {
    const aLower = a.name.toLowerCase();
    const bLower = b.name.toLowerCase();
    const aExact = aLower === lowerQuery;
    const bExact = bLower === lowerQuery;
    if (aExact !== bExact) return aExact ? -1 : 1;
    const aStarts = aLower.startsWith(lowerQuery);
    const bStarts = bLower.startsWith(lowerQuery);
    if (aStarts !== bStarts) return aStarts ? -1 : 1;
    return aLower.localeCompare(bLower);
  });

  return results;
}

// --- File Search (contents) ---

export async function searchFileContents(projectPath: string, query: string): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  try {
    const { stdout } = await execFileAsync('grep', [
      '-rn',
      '--include=*.ts', '--include=*.tsx',
      '--include=*.js', '--include=*.jsx',
      '--include=*.py', '--include=*.rs', '--include=*.go',
      '--include=*.md', '--include=*.json',
      '--include=*.css', '--include=*.html',
      '--include=*.yaml', '--include=*.yml',
      '--include=*.toml', '--include=*.sh',
      '--include=*.sql', '--include=*.rb',
      '--include=*.java', '--include=*.c', '--include=*.cpp',
      '-m', '100',
      '--', query, projectPath,
    ], { timeout: 15000, maxBuffer: 1024 * 1024 });

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;

      // Format: filepath:lineNumber:content
      const firstColon = line.indexOf(':');
      if (firstColon === -1) continue;
      const secondColon = line.indexOf(':', firstColon + 1);
      if (secondColon === -1) continue;

      const filePath = line.substring(0, firstColon);
      const lineNumber = parseInt(line.substring(firstColon + 1, secondColon), 10);
      const lineContent = line.substring(secondColon + 1);

      if (isNaN(lineNumber)) continue;

      // Skip node_modules etc.
      const rel = path.relative(projectPath, filePath);
      if (rel.startsWith('node_modules') || rel.startsWith('.git')) continue;

      results.push({
        filePath,
        relativePath: rel,
        lineNumber,
        lineContent: lineContent.substring(0, 300),
      });
    }
  } catch {
    // grep returns non-zero if no matches
  }

  return results.slice(0, 100);
}

// --- File Watcher ---

const watchers = new Map<string, FSWatcher>();

export async function watchProject(projectPath: string, win: BrowserWindow): Promise<void> {
  // Don't double-watch
  if (watchers.has(projectPath)) return;

  const chokidar = await import('chokidar');
  const watcher = chokidar.watch(projectPath, {
    ignored: [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/out/**',
      '**/build/**',
      '**/.next/**',
      '**/.vite/**',
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 20,
  });

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function notify(type: string, filePath: string) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!win.isDestroyed()) {
        win.webContents.send('files:change', { type, path: filePath });
      }
    }, 500);
  }

  watcher.on('add', (p) => notify('add', p));
  watcher.on('change', (p) => notify('change', p));
  watcher.on('unlink', (p) => notify('unlink', p));
  watcher.on('addDir', (p) => notify('addDir', p));
  watcher.on('unlinkDir', (p) => notify('unlinkDir', p));

  watchers.set(projectPath, watcher);
}

export function unwatchProject(projectPath: string): void {
  const watcher = watchers.get(projectPath);
  if (watcher) {
    watcher.close();
    watchers.delete(projectPath);
  }
}

// --- Open in Editor ---

export async function openInVSCode(filePath: string, lineNumber?: number): Promise<void> {
  const target = lineNumber ? `${filePath}:${lineNumber}` : filePath;
  await execFileAsync('code', ['--goto', target]);
}

export async function openFolderInVSCode(folderPath: string): Promise<void> {
  await execFileAsync('code', [folderPath]);
}

export async function openInDefaultEditor(filePath: string): Promise<void> {
  const editors = ['code', 'cursor', 'windsurf', 'subl', 'atom'];
  for (const editor of editors) {
    try {
      await execFileAsync('which', [editor]);
      await execFileAsync(editor, [filePath]);
      return;
    } catch {
      continue;
    }
  }
  // Fallback
  const { shell } = await import('electron');
  await shell.openPath(filePath);
}

export async function openInTerminal(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  if (process.platform === 'darwin') {
    await execFileAsync('open', ['-a', 'Terminal', dir]);
  } else if (process.platform === 'win32') {
    await execFileAsync('cmd', ['/c', 'start', 'cmd', '/k', `cd /d "${dir}"`]);
  } else {
    spawn('x-terminal-emulator', [], {
      cwd: dir,
      detached: true,
    }).unref();
  }
}

// --- Save File ---

export async function saveFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}
