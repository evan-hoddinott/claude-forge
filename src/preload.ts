import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  setup: {
    checkDependencies: () => ipcRenderer.invoke('setup:check-dependencies'),
  },
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
    checkAuth: () => ipcRenderer.invoke('github:check-auth'),
    loginStart: () => ipcRenderer.invoke('github:login-start'),
    logout: () => ipcRenderer.invoke('github:logout'),
    repoCount: () => ipcRenderer.invoke('github:repo-count'),
  },
  agent: {
    start: (projectId: string, agentType: string) =>
      ipcRenderer.invoke('agent:start', projectId, agentType),
    status: (projectId: string) =>
      ipcRenderer.invoke('agent:status', projectId),
    checkFullStatus: (agentType: string) =>
      ipcRenderer.invoke('agent:check-full-status', agentType),
    checkAllStatuses: () =>
      ipcRenderer.invoke('agent:check-all-statuses'),
    install: (agentType: string) =>
      ipcRenderer.invoke('agent:install', agentType),
    update: (agentType: string) =>
      ipcRenderer.invoke('agent:update', agentType),
    login: (agentType: string) =>
      ipcRenderer.invoke('agent:login', agentType),
    onInstallProgress: (callback: (data: { line: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { line: string }) => callback(data);
      ipcRenderer.on('agent:install-progress', handler);
    },
    offInstallProgress: () => {
      ipcRenderer.removeAllListeners('agent:install-progress');
    },
  },
  system: {
    selectDirectory: () => ipcRenderer.invoke('system:select-directory'),
    checkPathExists: (path: string) =>
      ipcRenderer.invoke('system:check-path-exists', path) as Promise<{ exists: boolean; hasContent: boolean }>,
    openInTerminal: (path: string) =>
      ipcRenderer.invoke('system:open-in-terminal', path),
    openInEditor: (path: string) =>
      ipcRenderer.invoke('system:open-in-editor', path),
    checkGhAuth: () => ipcRenderer.invoke('system:check-gh-auth'),
    openExternal: (url: string) =>
      ipcRenderer.invoke('system:open-external', url),
    getEnvironment: () => ipcRenderer.invoke('system:get-environment'),
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
  files: {
    tree: (projectPath: string) => ipcRenderer.invoke('files:tree', projectPath),
    read: (filePath: string) => ipcRenderer.invoke('files:read', filePath),
    gitStatus: (projectPath: string) => ipcRenderer.invoke('files:git-status', projectPath),
    searchNames: (projectPath: string, query: string) =>
      ipcRenderer.invoke('files:search-names', projectPath, query),
    searchContents: (projectPath: string, query: string) =>
      ipcRenderer.invoke('files:search-contents', projectPath, query),
    openVSCode: (filePath: string, lineNumber?: number) =>
      ipcRenderer.invoke('files:open-vscode', filePath, lineNumber),
    openFolderVSCode: (folderPath: string) =>
      ipcRenderer.invoke('files:open-folder-vscode', folderPath),
    openDefaultEditor: (filePath: string) =>
      ipcRenderer.invoke('files:open-default-editor', filePath),
    openInTerminal: (filePath: string) =>
      ipcRenderer.invoke('files:open-terminal', filePath),
    watch: (projectPath: string) => ipcRenderer.invoke('files:watch', projectPath),
    unwatch: (projectPath: string) => ipcRenderer.invoke('files:unwatch', projectPath),
    save: (filePath: string, content: string) =>
      ipcRenderer.invoke('files:save', filePath, content),
    regenerateContext: (projectId: string, agentType: string) =>
      ipcRenderer.invoke('files:regenerate-context', projectId, agentType),
    onFileChange: (callback: (data: { type: string; path: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { type: string; path: string }) => callback(data);
      ipcRenderer.on('files:change', handler);
    },
    offFileChange: () => {
      ipcRenderer.removeAllListeners('files:change');
    },
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
});
