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
    scanFolder: (folderPath: string) =>
      ipcRenderer.invoke('projects:scan-folder', folderPath),
    import: (input: unknown) =>
      ipcRenderer.invoke('projects:import', input),
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
    cloneRepo: (url: string, destination: string) =>
      ipcRenderer.invoke('github:clone-repo', url, destination),
    onCloneProgress: (callback: (data: { message: string; done: boolean; error?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { message: string; done: boolean; error?: string }) =>
        callback(data);
      ipcRenderer.on('github:clone-progress', handler);
    },
    offCloneProgress: () => {
      ipcRenderer.removeAllListeners('github:clone-progress');
    },
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
  updater: {
    checkNow: () => ipcRenderer.invoke('updater:check-now'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:get-version') as Promise<string>,
    onUpdateStatus: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('update-status', handler);
    },
    offUpdateStatus: () => {
      ipcRenderer.removeAllListeners('update-status');
    },
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  chat: {
    send: (projectId: string | null, model: string, providerId: string, messages: unknown[]) =>
      ipcRenderer.invoke('chat:send', projectId, model, providerId, messages),
    getProviders: () => ipcRenderer.invoke('chat:get-providers'),
    getHistory: (projectId: string | null) => ipcRenderer.invoke('chat:get-history', projectId),
    clearHistory: (projectId: string | null) => ipcRenderer.invoke('chat:clear-history', projectId),
    setApiKey: (providerId: string, key: string) => ipcRenderer.invoke('chat:set-api-key', providerId, key),
    testConnection: (providerId: string) => ipcRenderer.invoke('chat:test-connection', providerId),
    onToken: (callback: (data: { token: string; done: boolean; messageId: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { token: string; done: boolean; messageId: string }) => callback(data);
      ipcRenderer.on('chat:token', handler);
    },
    offToken: () => {
      ipcRenderer.removeAllListeners('chat:token');
    },
  },
  vault: {
    list: () => ipcRenderer.invoke('vault:list'),
    save: (entry: { id?: string; provider: string; displayName: string; apiKey: string; baseUrl?: string }) =>
      ipcRenderer.invoke('vault:save', entry),
    delete: (id: string) => ipcRenderer.invoke('vault:delete', id),
    test: (provider: string, apiKey?: string, baseUrl?: string) =>
      ipcRenderer.invoke('vault:test', provider, apiKey, baseUrl),
  },
  deploy: {
    start: (options: unknown) => ipcRenderer.invoke('deploy:start', options),
    forcePush: (projectPath: string) => ipcRenderer.invoke('deploy:force-push', projectPath),
    onProgress: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('deploy:progress', handler);
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('deploy:progress');
    },
    onDone: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('deploy:done', handler);
    },
    offDone: () => {
      ipcRenderer.removeAllListeners('deploy:done');
    },
  },
  vibe: {
    export: (options: unknown) => ipcRenderer.invoke('vibe:export', options),
    pickAndPreview: () => ipcRenderer.invoke('vibe:pick-and-preview'),
    import: (filePath: string, mode: string, projectPath: string, projectId?: string, projectName?: string) =>
      ipcRenderer.invoke('vibe:import', filePath, mode, projectPath, projectId, projectName),
  },
  snapshot: {
    export: (options: unknown) => ipcRenderer.invoke('snapshot:export', options),
    estimateSize: (projectId: string, includeSource: boolean, includeGit: boolean) =>
      ipcRenderer.invoke('snapshot:estimate-size', projectId, includeSource, includeGit),
    pickAndPreview: () => ipcRenderer.invoke('snapshot:pick-and-preview'),
    import: (filePath: string, projectPath: string, projectName?: string) =>
      ipcRenderer.invoke('snapshot:import', filePath, projectPath, projectName),
  },
  reasoningMap: {
    generate: (projectId: string, projectPath: string) =>
      ipcRenderer.invoke('reasoningmap:generate', projectId, projectPath),
    get: (projectId: string) =>
      ipcRenderer.invoke('reasoningmap:get', projectId),
    getAttribution: (projectId: string) =>
      ipcRenderer.invoke('reasoningmap:get-attribution', projectId),
    onFilesChanged: (callback: (data: { projectId: string }) => void) => {
      ipcRenderer.on('reasoningmap:files-changed', (_event, data) => callback(data));
    },
    offFilesChanged: () => {
      ipcRenderer.removeAllListeners('reasoningmap:files-changed');
    },
  },
  ghostTest: {
    run: (projectId: string, projectPath: string, agentType: string) =>
      ipcRenderer.invoke('ghost-test:run', projectId, projectPath, agentType),
    getHistory: (projectId: string) =>
      ipcRenderer.invoke('ghost-test:get-history', projectId),
    getSettings: (projectId: string) =>
      ipcRenderer.invoke('ghost-test:get-settings', projectId),
    updateSettings: (projectId: string, settings: unknown) =>
      ipcRenderer.invoke('ghost-test:update-settings', projectId, settings),
    detectCommand: (projectPath: string) =>
      ipcRenderer.invoke('ghost-test:detect-command', projectPath),
    getAllLastResults: () =>
      ipcRenderer.invoke('ghost-test:get-all-last-results'),
    onProgress: (callback: (data: { projectId: string; message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { projectId: string; message: string }) =>
        callback(data);
      ipcRenderer.on('ghost-test:progress', handler);
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('ghost-test:progress');
    },
    onAutoResult: (callback: (data: { projectId: string; result: import('./shared/types').GhostTestResult }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { projectId: string; result: import('./shared/types').GhostTestResult }) =>
        callback(data);
      ipcRenderer.on('ghost-test:auto-result', handler);
    },
    offAutoResult: () => {
      ipcRenderer.removeAllListeners('ghost-test:auto-result');
    },
  },
  skills: {
    fetchCatalog: () => ipcRenderer.invoke('skills:fetch-catalog'),
    getInstalled: (projectId: string) => ipcRenderer.invoke('skills:get-installed', projectId),
    install: (skillId: string, projectId: string) =>
      ipcRenderer.invoke('skills:install', skillId, projectId),
    uninstall: (skillId: string, projectId: string) =>
      ipcRenderer.invoke('skills:uninstall', skillId, projectId),
    saveAs: (skillId: string) => ipcRenderer.invoke('skills:save-as', skillId),
  },
  battle: {
    start: (projectId: string, projectPath: string, task: string, agents: [string, string]) =>
      ipcRenderer.invoke('battle:start', projectId, projectPath, task, agents),
    cancel: () => ipcRenderer.invoke('battle:cancel'),
    getProgress: () => ipcRenderer.invoke('battle:get-progress'),
    getDiff: (side: 0 | 1) => ipcRenderer.invoke('battle:get-diff', side),
    applyWinner: (side: 0 | 1, projectPath: string) =>
      ipcRenderer.invoke('battle:apply-winner', side, projectPath),
    discard: () => ipcRenderer.invoke('battle:discard'),
    getHistory: (projectId: string) => ipcRenderer.invoke('battle:get-history', projectId),
    getLeaderboard: () => ipcRenderer.invoke('battle:get-leaderboard'),
    onProgress: (callback: (event: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('battle:progress', handler);
    },
    offProgress: () => {
      ipcRenderer.removeAllListeners('battle:progress');
    },
  },
  timeline: {
    getEvents: (projectId: string) =>
      ipcRenderer.invoke('timeline:get', projectId),
    addEvent: (projectId: string, event: unknown) =>
      ipcRenderer.invoke('timeline:add-event', projectId, event),
    onEventAdded: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('timeline:event-added', handler);
    },
    offEventAdded: () => {
      ipcRenderer.removeAllListeners('timeline:event-added');
    },
  },
  conductor: {
    startPlan: (projectId: string, goal: string, controlLevel: string) =>
      ipcRenderer.invoke('conductor:start-plan', projectId, goal, controlLevel),
    submitAnswers: (planId: string, answers: unknown) =>
      ipcRenderer.invoke('conductor:submit-answers', planId, answers),
    startExecution: (planId: string) =>
      ipcRenderer.invoke('conductor:start-execution', planId),
    pause: (planId: string) => ipcRenderer.invoke('conductor:pause', planId),
    resume: (planId: string) => ipcRenderer.invoke('conductor:resume', planId),
    skipTask: (planId: string) => ipcRenderer.invoke('conductor:skip-task', planId),
    stop: (planId: string) => ipcRenderer.invoke('conductor:stop', planId),
    checkpointDecision: (planId: string, decision: string) =>
      ipcRenderer.invoke('conductor:checkpoint-decision', planId, decision),
    getPlan: (projectId: string) =>
      ipcRenderer.invoke('conductor:get-plan', projectId),
    reorderTasks: (planId: string, stationId: string, taskIds: string[]) =>
      ipcRenderer.invoke('conductor:reorder-tasks', planId, stationId, taskIds),
    reassignTask: (planId: string, taskId: string, agentType: string) =>
      ipcRenderer.invoke('conductor:reassign-task', planId, taskId, agentType),
    onStatusUpdate: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('conductor:status-update', handler);
    },
    offStatusUpdate: () => {
      ipcRenderer.removeAllListeners('conductor:status-update');
    },
    onTaskUpdate: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('conductor:task-update', handler);
    },
    offTaskUpdate: () => {
      ipcRenderer.removeAllListeners('conductor:task-update');
    },
  },
  fuel: {
    getStatus: () => ipcRenderer.invoke('fuel:get-status'),
    getBudget: () => ipcRenderer.invoke('fuel:get-budget'),
    setBudget: (budget: unknown) => ipcRenderer.invoke('fuel:set-budget', budget),
    getProjectReport: (projectId: string) =>
      ipcRenderer.invoke('fuel:get-project-report', projectId),
    onStatusUpdate: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
      ipcRenderer.on('fuel:status-update', handler);
    },
    offStatusUpdate: () => {
      ipcRenderer.removeAllListeners('fuel:status-update');
    },
  },
  timeMachine: {
    getSnapshots: (projectId: string) =>
      ipcRenderer.invoke('time-machine:get-snapshots', projectId),
    createSnapshot: (projectId: string, projectPath: string, label: string) =>
      ipcRenderer.invoke('time-machine:create-snapshot', projectId, projectPath, label),
    revert: (projectId: string, projectPath: string, snapshotId: string) =>
      ipcRenderer.invoke('time-machine:revert', projectId, projectPath, snapshotId),
    preview: (projectId: string, projectPath: string, snapshotId: string) =>
      ipcRenderer.invoke('time-machine:preview', projectId, projectPath, snapshotId),
    backToPresent: (projectId: string, projectPath: string) =>
      ipcRenderer.invoke('time-machine:back-to-present', projectId, projectPath),
  },
  ollama: {
    getStatus: () => ipcRenderer.invoke('ollama:get-status'),
    start: () => ipcRenderer.invoke('ollama:start'),
    getStats: () => ipcRenderer.invoke('ollama:get-stats'),
    pullModel: (name: string) => ipcRenderer.invoke('ollama:pull-model', name),
    deleteModel: (name: string) => ipcRenderer.invoke('ollama:delete-model', name),
    detectHardware: () => ipcRenderer.invoke('ollama:detect-hardware'),
    onPullProgress: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, d: unknown) => callback(d);
      ipcRenderer.on('ollama:pull-progress', handler);
    },
    offPullProgress: () => {
      ipcRenderer.removeAllListeners('ollama:pull-progress');
    },
    onConnectivity: (callback: (data: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, d: unknown) => callback(d);
      ipcRenderer.on('connectivity:status', handler);
    },
    offConnectivity: () => {
      ipcRenderer.removeAllListeners('connectivity:status');
    },
  },
  hub: {
    fetchCatalog: (forceRefresh?: boolean) =>
      ipcRenderer.invoke('hub:fetch-catalog', forceRefresh),
    installItem: (itemId: string, projectPath: string) =>
      ipcRenderer.invoke('hub:install-item', itemId, projectPath),
    getInstalled: (projectPath: string) =>
      ipcRenderer.invoke('hub:get-installed', projectPath),
    trackDownload: (itemId: string) =>
      ipcRenderer.invoke('hub:track-download', itemId),
    publish: (input: unknown) =>
      ipcRenderer.invoke('hub:publish', input),
    generateVibe: (projectId: string) =>
      ipcRenderer.invoke('hub:generate-vibe', projectId),
  },
});
