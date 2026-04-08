import _Store from 'electron-store';
import type Store from 'electron-store';
import { app } from 'electron';
import path from 'node:path';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import type { Project, CreateProjectInput, UserPreferences, ChatMessage } from '../shared/types';

// electron-store is ESM; when Node.js requires it at runtime the default export
// may land on `.default`. This handles both CJS interop shapes.
const StoreClass = (_Store as unknown as { default?: typeof _Store }).default ?? _Store;

interface StoreSchema {
  projects: Project[];
  preferences: UserPreferences;
  chatHistory: Record<string, ChatMessage[]>;
  apiKeys: Record<string, string>;
}

let _store: Store<StoreSchema> | null = null;

function preferenceDefaults(): UserPreferences {
  return {
    defaultProjectDir: path.join(app.getPath('home'), 'Projects'),
    projectLocationMode: 'wsl',
    githubUsername: '',
    theme: 'forge',
    defaultEditor: 'code',
    defaultRepoVisibility: 'private',
    claudeLaunchMode: 'interactive',
    customSystemPrompt: '',
    defaultAgent: 'claude',
    autoGenerateAllContextFiles: false,
    fileExplorerFontSize: 13,
    fileExplorerShowHidden: false,
    fileExplorerWordWrap: false,
    fileExplorerMinimap: true,
    setupCompleted: false,
    tutorialCompleted: false,
    mode: 'simple',
    appFontSize: 14,
    reduceAnimations: false,
    highContrast: false,
    showSplash: true,
    chatPanelOpen: false,
    chatPanelWidth: 400,
    chatLastModel: 'gpt-4o',
    chatLastProvider: 'github',
  };
}

/**
 * Get or generate an encryption key for electron-store.
 * Tries to use a machine-specific key stored in the app's userData directory.
 * This provides encryption at rest (the store file is unreadable gibberish).
 */
function getEncryptionKey(): string {
  const keyPath = path.join(app.getPath('userData'), '.store-key');
  try {
    const existing = fs.readFileSync(keyPath, 'utf-8').trim();
    if (existing.length >= 32) return existing;
  } catch {
    // Key doesn't exist yet
  }

  // Generate a new random key
  const key = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Owner-only permissions
  } catch {
    // If we can't persist the key, use it ephemerally
    // (data will need re-encryption on next launch — but this is a rare edge case)
  }

  return key;
}

function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new StoreClass<StoreSchema>({
      encryptionKey: getEncryptionKey(),
      clearInvalidConfig: true,
      defaults: {
        projects: [],
        preferences: preferenceDefaults(),
        chatHistory: {},
        apiKeys: {},
      },
    });
  }
  return _store;
}

// --- Project CRUD ---

export function getAllProjects(): Project[] {
  return getStore().get('projects');
}

export function getProjectById(id: string): Project | undefined {
  return getStore().get('projects').find((p) => p.id === id);
}

export function createProject(input: CreateProjectInput): Project {
  const store = getStore();
  const preferences = store.get('preferences');

  const project: Project = {
    id: uuidv4(),
    name: input.name,
    description: input.description,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    path: input.path || path.join(preferences.defaultProjectDir, input.name),
    githubRepo: null,
    githubUrl: null,
    status: 'created',
    inputs: input.inputs,
    tags: input.tags,
    lastClaudeSession: null,
    preferredAgent: input.preferredAgent || preferences.defaultAgent || 'claude',
    agents: input.agents || [input.preferredAgent || preferences.defaultAgent || 'claude'],
  };

  const projects = store.get('projects');
  projects.push(project);
  store.set('projects', projects);

  return project;
}

export function updateProject(
  id: string,
  updates: Partial<Omit<Project, 'id' | 'createdAt'>>,
): Project {
  const store = getStore();
  const projects = store.get('projects');
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Project not found');

  projects[index] = {
    ...projects[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  store.set('projects', projects);

  return projects[index];
}

export function deleteProject(id: string): void {
  const store = getStore();
  const projects = store.get('projects');
  store.set(
    'projects',
    projects.filter((p) => p.id !== id),
  );
}

// --- Preferences ---

export function getPreferences(): UserPreferences {
  return { ...preferenceDefaults(), ...getStore().get('preferences') };
}

export function updatePreferences(
  updates: Partial<UserPreferences>,
): UserPreferences {
  const store = getStore();
  const current = getPreferences();
  const updated = { ...current, ...updates };
  store.set('preferences', updated);
  return updated;
}

// --- Data Operations ---

export function importProjects(projects: Project[]): number {
  const store = getStore();
  const existing = store.get('projects');
  const existingIds = new Set(existing.map((p) => p.id));
  const newOnes = projects.filter((p) => !existingIds.has(p.id));
  store.set('projects', [...existing, ...newOnes]);
  return newOnes.length;
}

export function resetAll(): void {
  getStore().clear();
}

// --- Chat History ---

function chatKey(projectId: string | null): string {
  return projectId ?? '__global';
}

export function getChatHistory(projectId: string | null): ChatMessage[] {
  const history = getStore().get('chatHistory');
  return history[chatKey(projectId)] ?? [];
}

export function saveChatHistory(projectId: string | null, messages: ChatMessage[]): void {
  const store = getStore();
  const history = store.get('chatHistory');
  history[chatKey(projectId)] = messages.slice(-50); // keep last 50
  store.set('chatHistory', history);
}

export function clearChatHistory(projectId: string | null): void {
  const store = getStore();
  const history = store.get('chatHistory');
  delete history[chatKey(projectId)];
  store.set('chatHistory', history);
}

// --- API Keys ---

export function getApiKey(providerId: string): string | null {
  const keys = getStore().get('apiKeys');
  return keys[providerId] ?? null;
}

export function setApiKey(providerId: string, key: string): void {
  const store = getStore();
  const keys = store.get('apiKeys');
  keys[providerId] = key;
  store.set('apiKeys', keys);
}

export function getEncryptionStatus(): 'active' | 'fallback' {
  const keyPath = path.join(app.getPath('userData'), '.store-key');
  try {
    fs.accessSync(keyPath);
    return 'active';
  } catch {
    return 'fallback';
  }
}
