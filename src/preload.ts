import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    get: (id: string) => ipcRenderer.invoke('projects:get', id),
    create: (input: unknown) => ipcRenderer.invoke('projects:create', input),
    update: (id: string, updates: unknown) =>
      ipcRenderer.invoke('projects:update', id, updates),
    delete: (id: string, deleteFromDisk?: boolean) =>
      ipcRenderer.invoke('projects:delete', id, deleteFromDisk),
  },
  github: {
    createRepo: (name: string, isPrivate: boolean, description: string, projectPath: string) =>
      ipcRenderer.invoke('github:create-repo', name, isPrivate, description, projectPath),
    listRepos: () => ipcRenderer.invoke('github:list-repos'),
    linkRepo: (projectPath: string, repoUrl: string) =>
      ipcRenderer.invoke('github:link-repo', projectPath, repoUrl),
  },
  claude: {
    start: (projectId: string) => ipcRenderer.invoke('claude:start', projectId),
    status: (projectId: string) =>
      ipcRenderer.invoke('claude:status', projectId),
  },
  system: {
    selectDirectory: () => ipcRenderer.invoke('system:select-directory'),
    openInTerminal: (path: string) =>
      ipcRenderer.invoke('system:open-in-terminal', path),
    openInEditor: (path: string) =>
      ipcRenderer.invoke('system:open-in-editor', path),
    checkGhAuth: () => ipcRenderer.invoke('system:check-gh-auth'),
    checkClaude: () => ipcRenderer.invoke('system:check-claude'),
    openExternal: (url: string) =>
      ipcRenderer.invoke('system:open-external', url),
  },
  preferences: {
    get: () => ipcRenderer.invoke('preferences:get'),
    update: (updates: unknown) =>
      ipcRenderer.invoke('preferences:update', updates),
  },
  data: {
    exportProjects: () => ipcRenderer.invoke('data:export'),
    importProjects: () => ipcRenderer.invoke('data:import'),
    resetAll: () => ipcRenderer.invoke('data:reset'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
});
