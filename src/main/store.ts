import Store from 'electron-store';
import { app } from 'electron';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { Project, CreateProjectInput, UserPreferences } from '../shared/types';

interface StoreSchema {
  projects: Project[];
  preferences: UserPreferences;
}

let _store: Store<StoreSchema> | null = null;

function preferenceDefaults(): UserPreferences {
  return {
    defaultProjectDir: path.join(app.getPath('home'), 'Projects'),
    projectLocationMode: 'wsl',
    githubUsername: '',
    theme: 'dark',
    defaultEditor: 'code',
    defaultRepoVisibility: 'private',
    claudeLaunchMode: 'interactive',
    customSystemPrompt: '',
    defaultAgent: 'claude',
    autoGenerateAllContextFiles: false,
  };
}

function getStore(): Store<StoreSchema> {
  if (!_store) {
    _store = new Store<StoreSchema>({
      defaults: {
        projects: [],
        preferences: preferenceDefaults(),
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
  if (index === -1) throw new Error(`Project not found: ${id}`);

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
