import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { shell } from 'electron';
import * as store from '../store';
import { BUILTIN_CATALOG_ITEMS, BUILTIN_VIBES } from './hub-builtin';
import type { HubCatalog, HubItem, HubVibeBundle, HubPublishInput } from '../../shared/types';

const CATALOG_URL = 'https://raw.githubusercontent.com/evan-hoddinott/caboo-hub/main/catalog.json';
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function mergeCatalog(remote: HubCatalog): HubCatalog {
  const remoteIds = new Set(remote.items.map((i) => i.id));
  // Built-ins always present; community items that don't clash with built-ins are appended
  const communityOnly = remote.items.filter((i) => !BUILTIN_CATALOG_ITEMS.find((b) => b.id === i.id));
  return {
    ...remote,
    items: [...BUILTIN_CATALOG_ITEMS, ...communityOnly],
  };
  void remoteIds; // satisfy linter
}

export async function fetchCatalog(forceRefresh = false): Promise<HubCatalog> {
  const cached = store.getHubCache();
  if (!forceRefresh && cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return mergeCatalog(cached.catalog);
    }
  }

  try {
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const remote: HubCatalog = await res.json() as HubCatalog;
    store.setHubCache(remote);
    return mergeCatalog(remote);
  } catch {
    // Offline or network error: return built-in items only
    const fallback: HubCatalog = {
      version: '1',
      lastUpdated: cached?.fetchedAt ?? new Date().toISOString(),
      items: [],
    };
    return mergeCatalog(fallback);
  }
}

export async function installItem(itemId: string, projectPath: string): Promise<void> {
  const catalog = await fetchCatalog();
  const item: HubItem | undefined = catalog.items.find((i) => i.id === itemId);
  if (!item) throw new Error(`Hub item '${itemId}' not found`);

  let bundle: HubVibeBundle;

  if (item.source === 'bundled') {
    const builtin = BUILTIN_VIBES[itemId];
    if (!builtin) throw new Error(`Built-in vibe for '${itemId}' not found`);
    bundle = builtin;
  } else {
    if (!item.downloadUrl) throw new Error(`No download URL for '${itemId}'`);
    const res = await fetch(item.downloadUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Failed to download item: HTTP ${res.status}`);
    bundle = await res.json() as HubVibeBundle;
  }

  // Write/merge each file into the project
  for (const file of bundle.files) {
    const dest = path.join(projectPath, file.path);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    if (file.merge) {
      let existing = '';
      try {
        existing = await fs.readFile(dest, 'utf-8');
      } catch {
        // File doesn't exist yet — that's fine
      }
      await fs.writeFile(dest, existing ? existing + '\n\n' + file.content : file.content, 'utf-8');
    } else {
      await fs.writeFile(dest, file.content, 'utf-8');
    }
  }

  // Record installed item in .caboo-hub-installed.json
  const installedPath = path.join(projectPath, '.caboo-hub-installed.json');
  let installed: string[] = [];
  try {
    installed = JSON.parse(await fs.readFile(installedPath, 'utf-8')) as string[];
  } catch {
    // No existing file
  }
  if (!installed.includes(itemId)) {
    installed.push(itemId);
    await fs.writeFile(installedPath, JSON.stringify(installed, null, 2), 'utf-8');
  }

  store.incrementHubDownload(itemId);
}

export async function getInstalledItems(projectPath: string): Promise<string[]> {
  const installedPath = path.join(projectPath, '.caboo-hub-installed.json');
  try {
    return JSON.parse(await fs.readFile(installedPath, 'utf-8')) as string[];
  } catch {
    return [];
  }
}

export async function trackDownload(itemId: string): Promise<void> {
  store.incrementHubDownload(itemId);
}

export async function generateVibe(projectId: string): Promise<string> {
  // Returns a JSON string representing a basic HubVibeBundle for the project.
  // The actual project context files are picked up from project metadata.
  // For now, returns a template the user can fill in for publishing.
  const bundle: HubVibeBundle = {
    id: `custom-${projectId}`,
    name: 'My Custom Skill',
    version: '1.0.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: '## My Custom Skill\n\nDescribe what this skill does and the instructions for the agent.\n',
      },
    ],
  };
  return JSON.stringify(bundle, null, 2);
}

export async function publishItem(input: HubPublishInput): Promise<{ url: string }> {
  // Try to open the GitHub new-file URL with instructions pre-filled in the title
  const issueTitle = encodeURIComponent(`[${input.type}] ${input.name}`);
  const issueBody = encodeURIComponent(
    `## Submission: ${input.name}\n\n**Type**: ${input.type}\n**Category**: ${input.category}\n**Description**: ${input.description}\n\n${input.longDescription}\n\n**Tags**: ${input.tags.join(', ')}\n\n---\n*Submitted via Caboo Hub publisher*`,
  );
  const url = `https://github.com/evan-hoddinott/caboo-hub/issues/new?title=${issueTitle}&body=${issueBody}`;

  try {
    await shell.openExternal(url);
  } catch {
    // Fallback: just return the URL
  }

  return { url };
}
