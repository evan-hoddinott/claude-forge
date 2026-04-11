import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import type { MapNode, ReasoningMap, AgentType } from '../../shared/types';
import { getFileAttribution } from '../store';

const DEFAULT_IGNORE = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'out', '.vite',
  'coverage', '.cache', '__pycache__', '.mypy_cache', 'venv', '.venv',
  'target', 'vendor', '.idea', '.vscode',
]);

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.vue', '.svelte',
]);

const MAX_FILES = 300;
const MAX_NODES = 25;

interface FileInfo {
  absPath: string;
  relPath: string;
  ext: string;
}

/** Walk project directory, collecting source files up to MAX_FILES. */
async function walkFiles(dir: string, base: string, results: FileInfo[]): Promise<void> {
  if (results.length >= MAX_FILES) return;
  let entries: string[];
  try {
    entries = await fs.readdir(dir, { encoding: 'utf-8' });
  } catch {
    return;
  }
  for (const name of entries) {
    if (results.length >= MAX_FILES) break;
    if (DEFAULT_IGNORE.has(name)) continue;
    if (name.startsWith('.')) continue;
    const absPath = path.join(dir, name);
    const relPath = path.relative(base, absPath);
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      await walkFiles(absPath, base, results);
    } else if (stat.isFile()) {
      const ext = path.extname(name).toLowerCase();
      if (SOURCE_EXTENSIONS.has(ext)) {
        results.push({ absPath, relPath, ext });
      }
    }
  }
}

/** Extract relative import paths from a file's content. */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const patterns = [
    /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /from\s+['"]([^'"]+)['"]/g,
  ];
  for (const pattern of patterns) {
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(content)) !== null) {
      if (m[1].startsWith('.')) {
        imports.push(m[1]);
      }
    }
  }
  return [...new Set(imports)];
}

/** Determine the node type for a file. */
function classifyFile(relPath: string, content: string): MapNode['type'] {
  const parts = relPath.split('/');
  const filename = path.basename(relPath, path.extname(relPath)).toLowerCase();
  const dir = parts.slice(0, -1).join('/').toLowerCase();

  // Config files
  if (/^(vite|webpack|rollup|jest|vitest|tsconfig|babel|eslint|prettier)/.test(filename)) return 'config';
  if (filename === 'package' || filename === '.env') return 'config';

  // Tests
  if (filename.includes('.test') || filename.includes('.spec') || dir.includes('__tests__') || dir.includes('test')) return 'test';

  // API routes
  if (dir.includes('/api/') || dir.startsWith('api/') || filename.startsWith('route') || filename.endsWith('router') || filename.endsWith('routes')) return 'api';

  // Models / schemas
  if (dir.includes('models') || dir.includes('schema') || filename.includes('model') || filename.includes('schema') || filename.includes('entity') || filename.includes('prisma')) return 'model';

  // Services / middleware
  if (dir.includes('services') || dir.includes('service') || dir.includes('middleware') || filename.endsWith('service') || filename.endsWith('middleware')) return 'service';

  // Pages
  if (dir.includes('pages') || dir.includes('app/') || dir === 'app' || filename === 'index' || filename === 'page') {
    if (content.includes('JSX') || content.includes('tsx') || /<[A-Z]/.test(content) || /return\s*\(/.test(content)) {
      return 'page';
    }
  }

  // Components (exports JSX)
  if (dir.includes('components') || dir.includes('component') || dir.includes('ui')) return 'component';
  if (/<[A-Z]/.test(content) || /return\s*\([\s\S]{0,100}</.test(content)) return 'component';

  return 'component';
}

/** Turn a file path into a human-readable label. */
function fileToLabel(relPath: string): string {
  const name = path.basename(relPath, path.extname(relPath));
  // PascalCase split, or kebab/snake to Title
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || name;
}

/** Group files under a shared directory node if we'd exceed MAX_NODES. */
function groupNodes(rawNodes: Array<{ relPath: string; type: MapNode['type']; label: string }>): MapNode[] {
  if (rawNodes.length <= MAX_NODES) {
    return rawNodes.map((n, i) => ({
      id: `N${i}`,
      label: n.label,
      type: n.type,
      files: [n.relPath],
    }));
  }

  // Group by directory
  const dirMap = new Map<string, typeof rawNodes>();
  for (const n of rawNodes) {
    const dir = path.dirname(n.relPath);
    if (!dirMap.has(dir)) dirMap.set(dir, []);
    dirMap.get(dir)!.push(n);
  }

  const grouped: MapNode[] = [];
  let idx = 0;
  for (const [dir, files] of dirMap) {
    if (grouped.length >= MAX_NODES) break;
    if (files.length === 1) {
      grouped.push({ id: `N${idx++}`, label: files[0].label, type: files[0].type, files: [files[0].relPath] });
    } else {
      const dirLabel = fileToLabel(path.basename(dir) || dir);
      const majority = files.reduce<Record<string, number>>((acc, f) => {
        acc[f.type] = (acc[f.type] ?? 0) + 1;
        return acc;
      }, {});
      const dominantType = (Object.entries(majority).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'component') as MapNode['type'];
      grouped.push({ id: `N${idx++}`, label: dirLabel, type: dominantType, files: files.map(f => f.relPath) });
    }
  }

  return grouped;
}

/** Build Mermaid flowchart code from nodes and edges. */
function buildMermaid(nodes: MapNode[], edges: Array<[string, string]>): string {
  const lines: string[] = [
    'flowchart TD',
    '  classDef page fill:#3d6b2e,stroke:#5a9441,color:#d4cba8',
    '  classDef component fill:#2d5a6b,stroke:#3d7a8b,color:#d4cba8',
    '  classDef api fill:#6b5a2d,stroke:#8b7a3d,color:#d4cba8',
    '  classDef model fill:#4a3520,stroke:#6b4e2e,color:#d4cba8',
    '  classDef service fill:#4a2d6b,stroke:#6a4d8b,color:#d4cba8',
    '  classDef test fill:#3a3a3a,stroke:#5a5a5a,color:#9c9478',
    '  classDef database fill:#4a3520,stroke:#8b5e3c,color:#d4cba8',
    '  classDef config fill:#2a2a1a,stroke:#4a4a2a,color:#9c9478',
  ];

  for (const node of nodes) {
    const label = node.label.replace(/"/g, "'");
    lines.push(`  ${node.id}["${label}"]:::${node.type}`);
  }

  const seenEdges = new Set<string>();
  for (const [fromId, toId] of edges) {
    const key = `${fromId}-->${toId}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      lines.push(`  ${fromId} --> ${toId}`);
    }
  }

  return lines.join('\n');
}

export async function generateReasoningMap(projectId: string, projectPath: string): Promise<ReasoningMap> {
  const fileInfos: FileInfo[] = [];
  await walkFiles(projectPath, projectPath, fileInfos);

  // Read file contents (limit to first 4KB each for classification)
  const fileData: Array<{ info: FileInfo; content: string }> = [];
  for (const info of fileInfos) {
    let content = '';
    try {
      const buf = await fs.readFile(info.absPath);
      content = buf.toString('utf-8', 0, Math.min(buf.length, 4096));
    } catch {
      // skip unreadable files
    }
    fileData.push({ info, content });
  }

  // Classify each file
  const rawNodes = fileData.map(({ info, content }) => ({
    relPath: info.relPath,
    type: classifyFile(info.relPath, content),
    label: fileToLabel(info.relPath),
    content,
  }));

  // Group into final nodes
  const nodes = groupNodes(rawNodes);

  // Build a map from relPath → node id for edge resolution
  const relPathToNodeId = new Map<string, string>();
  for (const node of nodes) {
    for (const f of node.files) {
      relPathToNodeId.set(f, node.id);
    }
  }

  // Build edges from import graph
  const edges: Array<[string, string]> = [];
  for (const { info, content } of fileData) {
    const fromNodeId = relPathToNodeId.get(info.relPath);
    if (!fromNodeId) continue;
    const imports = extractImports(content);
    for (const imp of imports) {
      // Resolve the import relative to the file's directory
      const resolvedRel = path.normalize(
        path.join(path.dirname(info.relPath), imp)
      );
      // Try various extensions
      for (const ext of SOURCE_EXTENSIONS) {
        const candidate = resolvedRel + ext;
        const toNodeId = relPathToNodeId.get(candidate);
        if (toNodeId && toNodeId !== fromNodeId) {
          edges.push([fromNodeId, toNodeId]);
          break;
        }
        // Also try /index.tsx etc.
        const indexCandidate = path.join(resolvedRel, `index${ext}`);
        const toNodeId2 = relPathToNodeId.get(indexCandidate);
        if (toNodeId2 && toNodeId2 !== fromNodeId) {
          edges.push([fromNodeId, toNodeId2]);
          break;
        }
      }
    }
  }

  // Attach agent attribution to nodes
  const attribution = getFileAttribution(projectId);
  for (const node of nodes) {
    // Find the most recent attribution among this node's files
    let latestDate = '';
    let latestAgent: AgentType | 'user' | undefined;
    for (const f of node.files) {
      const attr = attribution[f];
      if (attr && attr.date > latestDate) {
        latestDate = attr.date;
        latestAgent = attr.agent;
      }
    }
    if (latestAgent) {
      node.lastModifiedBy = latestAgent;
      node.lastModified = latestDate;
    }
  }

  const mermaidCode = buildMermaid(nodes, edges);

  return {
    mermaidCode,
    nodes,
    lastGenerated: new Date().toISOString(),
    lastModifiedBy: 'system',
  };
}

/** Check if a project directory has any source files newer than a given ISO date. */
export async function isStale(projectPath: string, lastGenerated: string): Promise<boolean> {
  const since = new Date(lastGenerated).getTime();
  const files: FileInfo[] = [];
  await walkFiles(projectPath, projectPath, files);
  for (const file of files) {
    try {
      const stat = fsSync.statSync(file.absPath);
      if (stat.mtimeMs > since) return true;
    } catch {
      // ignore
    }
  }
  return false;
}
