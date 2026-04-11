export type ProjectStatus = 'created' | 'in-progress' | 'ready' | 'error';

export type AgentType = 'claude' | 'gemini' | 'codex' | 'copilot';

export interface AgentConfig {
  type: AgentType;
  displayName: string;
  npmPackage: string;
  command: string;
  contextFileName: string;
  authCheckCommand: string;
  loginCommand: string;
  versionCommand: string;
  subscriptionUrl: string;
  docsUrl: string;
  iconName: string;
  color: string;
  installMethod?: 'npm' | 'gh-extension';
  launchCommand?: string;
}

export const AGENTS: Record<AgentType, AgentConfig> = {
  claude: {
    type: 'claude',
    displayName: 'Claude Code',
    npmPackage: '@anthropic-ai/claude-code',
    command: 'claude',
    contextFileName: 'CLAUDE.md',
    authCheckCommand: 'claude --version',
    loginCommand: 'claude',
    versionCommand: 'claude --version',
    subscriptionUrl: 'https://claude.ai/pricing',
    docsUrl: 'https://docs.anthropic.com/en/docs/claude-code/overview',
    iconName: 'anthropic',
    color: '#D97706',
  },
  gemini: {
    type: 'gemini',
    displayName: 'Gemini CLI',
    npmPackage: '@google/gemini-cli',
    command: 'gemini',
    contextFileName: 'GEMINI.md',
    authCheckCommand: 'gemini --version',
    loginCommand: 'gemini',
    versionCommand: 'gemini --version',
    subscriptionUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://github.com/google-gemini/gemini-cli',
    iconName: 'google',
    color: '#4285F4',
  },
  codex: {
    type: 'codex',
    displayName: 'OpenAI Codex',
    npmPackage: '@openai/codex',
    command: 'codex',
    contextFileName: 'codex.md',
    authCheckCommand: 'codex --version',
    loginCommand: 'codex',
    versionCommand: 'codex --version',
    subscriptionUrl: 'https://chatgpt.com',
    docsUrl: 'https://github.com/openai/codex',
    iconName: 'openai',
    color: '#10A37F',
  },
  copilot: {
    type: 'copilot',
    displayName: 'GitHub Copilot',
    npmPackage: '',
    command: 'gh',
    contextFileName: '.github/copilot-instructions.md',
    authCheckCommand: 'gh auth status',
    loginCommand: 'gh',
    versionCommand: 'gh copilot --version',
    subscriptionUrl: 'https://github.com/features/copilot',
    docsUrl: 'https://docs.github.com/en/copilot',
    iconName: 'copilot',
    color: '#6e40c9',
    installMethod: 'gh-extension',
    launchCommand: 'gh copilot suggest',
  },
};

export interface ProjectInput {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'select' | 'checklist';
  options?: string[];
  multiSelect?: boolean;
  selectedOptions?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  path: string;
  githubRepo: string | null;
  githubUrl: string | null;
  status: ProjectStatus;
  inputs: ProjectInput[];
  tags: string[];
  lastClaudeSession: string | null;
  preferredAgent: AgentType;
  agents: AgentType[];
  autoPushToGitHub?: boolean;
}

export interface CreateProjectInput {
  name: string;
  description: string;
  path?: string;
  inputs: ProjectInput[];
  tags: string[];
  preferredAgent?: AgentType;
  agents?: AgentType[];
}

export type ProjectLocationMode = 'wsl' | 'windows';

export type AppMode = 'simple' | 'developer';

export interface UserPreferences {
  defaultProjectDir: string;
  projectLocationMode: ProjectLocationMode;
  githubUsername: string;
  theme: 'forge';
  defaultEditor: string;
  defaultRepoVisibility: 'public' | 'private';
  claudeLaunchMode: 'interactive' | 'auto';
  customSystemPrompt: string;
  defaultAgent: AgentType;
  autoGenerateAllContextFiles: boolean;
  fileExplorerFontSize: number;
  fileExplorerShowHidden: boolean;
  fileExplorerWordWrap: boolean;
  fileExplorerMinimap: boolean;
  setupCompleted: boolean;
  tutorialCompleted: boolean;
  mode: AppMode;
  appFontSize: number;
  reduceAnimations: boolean;
  highContrast: boolean;
  showSplash: boolean;
  chatPanelOpen: boolean;
  chatPanelWidth: number;
  chatLastModel: string;
  chatLastProvider: string;
  autoPushToGitHub: boolean;
}

export interface DependencyStatus {
  name: string;
  command: string;
  installed: boolean;
  version: string;
  description: string;
  installUrl: string;
  linuxInstallCommand: string;
}

export interface SetupCheckResult {
  dependencies: DependencyStatus[];
  platform: 'wsl' | 'native-linux' | 'native-windows';
  wslAvailable: boolean;
}

// --- File Explorer Types ---

export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';

export interface FileTreeNode {
  name: string;
  path: string;
  relativePath: string;
  type: 'file' | 'directory';
  extension: string | null;
  size: number;
  modifiedAt: string;
  children?: FileTreeNode[];
  gitStatus?: GitFileStatus | null;
}

export interface FileReadResult {
  content: string;
  language: string;
  lineCount: number;
  isTruncated?: boolean;
}

export interface SearchResult {
  filePath: string;
  relativePath: string;
  lineNumber: number;
  lineContent: string;
}

export interface EnvironmentInfo {
  platform: 'wsl' | 'native-linux' | 'native-windows';
  wslAvailable: boolean;
  wslDistro: string;
  wslHomePath: string;
  defaultProjectDir: string;
  windowsProjectDir: string;
  wslProjectDir: string;
}

export interface GitHubRepo {
  name: string;
  url: string;
  fullName: string;
}

// ── Import / Detection types ──────────────────────────────────────────────

export interface DetectedProject {
  name: string;
  path: string;
  description: string;
  languages: string[];
  framework: string | null;
  packageManager: string | null;
  hasGit: boolean;
  gitRemote: string | null;
  existingContextFiles: string[];
  detectedInputs: ProjectInput[];
}

export interface ImportProjectInput {
  name: string;
  description: string;
  path: string;
  inputs: ProjectInput[];
  preferredAgent: AgentType;
  generateMissingContextFiles: boolean;
  overwriteExistingContextFiles: boolean;
}

export interface GhAuthStatus {
  authenticated: boolean;
  username: string;
  ghInstalled: boolean;
}

export interface AgentStatus {
  nodeInstalled: boolean;
  installed: boolean;
  version: string;
  latestVersion: string;
  updateAvailable: boolean;
  authenticated: boolean;
}

// --- Vault Types ---

export interface VaultEntry {
  id: string;
  provider: string; // 'openai' | 'google' | 'anthropic' | 'github' | 'custom'
  displayName: string;
  apiKey: string;
  baseUrl?: string; // for custom OpenAI-compatible providers
  isValid: boolean | null; // null = not tested
  lastTested: string | null; // ISO date string
  models: string[];
}

export interface VaultEntryMasked extends Omit<VaultEntry, 'apiKey'> {
  maskedKey: string; // e.g. "sk-••••••••••••3kF2" — empty string if no key
  hasKey: boolean;
}

// --- Deploy Types ---

export type DeployStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface DeployStep {
  id: string;
  label: string;
  status: DeployStepStatus;
  detail?: string;
}

export interface DeployOptions {
  projectPath: string;
  projectId: string;
  mode: 'create' | 'push';
  // create-new
  repoName?: string;
  isPrivate?: boolean;
  description?: string;
  // push-existing
  repoUrl?: string;
  // options
  includeContextFiles: boolean;
  includeEnvFiles: boolean;
  commitMessage: string;
}

export interface DeployResult {
  success: boolean;
  repoUrl?: string;
  error?: string;
}

// --- Chat Types ---

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

export interface ChatModelInfo {
  id: string;
  displayName: string;
  providerId: string;
  isFree: boolean;
  isAvailable: boolean;
}

export interface ChatProviderInfo {
  id: string;
  name: string;
  isFree: boolean;
  hasKey: boolean;
  isAvailable: boolean;
  models: ChatModelInfo[];
}

export interface UpdateStatus {
  status: 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error';
  version?: string;
  currentVersion?: string;
  releaseNotes?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

// --- Ghost Test Types ---

export type GhostTestStatus = 'passed' | 'failed' | 'timeout' | 'auto-fixed';

export interface GhostTestResult {
  id: string;
  timestamp: string; // ISO date
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number; // ms
  status: GhostTestStatus;
  fixAttempts: number;
  fixDescription?: string;
}

export interface GhostTestSettings {
  enabled: boolean;
  customCommand: string; // empty = auto-detect
  timeoutSeconds: number;
  maxRetries: number;
  useDocker: boolean;
}

export interface ElectronAPI {
  setup: {
    checkDependencies: () => Promise<SetupCheckResult>;
  };
  projects: {
    list: () => Promise<Project[]>;
    get: (id: string) => Promise<Project | undefined>;
    create: (input: CreateProjectInput) => Promise<Project>;
    update: (id: string, updates: Partial<Project>) => Promise<Project>;
    delete: (id: string, deleteFromDisk?: boolean) => Promise<void>;
    scanFolder: (folderPath: string) => Promise<DetectedProject>;
    import: (input: ImportProjectInput) => Promise<Project>;
  };
  github: {
    createRepo: (name: string, isPrivate: boolean, description: string, projectPath: string) => Promise<GitHubRepo>;
    listRepos: () => Promise<GitHubRepo[]>;
    linkRepo: (projectPath: string, repoUrl: string) => Promise<void>;
    checkAuth: () => Promise<GhAuthStatus>;
    loginStart: () => Promise<{ code: string } | { error: string }>;
    logout: () => Promise<void>;
    repoCount: () => Promise<number>;
    cloneRepo: (url: string, destination: string) => Promise<void>;
    onCloneProgress: (callback: (data: { message: string; done: boolean; error?: string }) => void) => void;
    offCloneProgress: () => void;
  };
  agent: {
    start: (projectId: string, agentType: AgentType) => Promise<void>;
    status: (projectId: string) => Promise<{ running: boolean; hasHistory: boolean }>;
    checkFullStatus: (agentType: AgentType) => Promise<AgentStatus>;
    checkAllStatuses: () => Promise<Record<AgentType, AgentStatus>>;
    install: (agentType: AgentType) => Promise<{ success: boolean; error?: string }>;
    update: (agentType: AgentType) => Promise<{ success: boolean; error?: string }>;
    login: (agentType: AgentType) => Promise<{ success: boolean }>;
    onInstallProgress: (callback: (data: { line: string }) => void) => void;
    offInstallProgress: () => void;
  };
  system: {
    selectDirectory: () => Promise<string | null>;
    checkPathExists: (path: string) => Promise<{ exists: boolean; hasContent: boolean }>;
    openInTerminal: (path: string) => Promise<void>;
    openInEditor: (path: string) => Promise<void>;
    checkGhAuth: () => Promise<{ authenticated: boolean; username: string }>;
    openExternal: (url: string) => Promise<void>;
    getEnvironment: () => Promise<EnvironmentInfo>;
  };
  preferences: {
    get: () => Promise<UserPreferences>;
    update: (updates: Partial<UserPreferences>) => Promise<UserPreferences>;
  };
  data: {
    exportProjects: () => Promise<string | null>;
    importProjects: () => Promise<number>;
    resetAll: () => Promise<void>;
  };
  files: {
    tree: (projectPath: string) => Promise<FileTreeNode[]>;
    read: (filePath: string) => Promise<FileReadResult>;
    gitStatus: (projectPath: string) => Promise<Record<string, GitFileStatus>>;
    searchNames: (projectPath: string, query: string) => Promise<FileTreeNode[]>;
    searchContents: (projectPath: string, query: string) => Promise<SearchResult[]>;
    openVSCode: (filePath: string, lineNumber?: number) => Promise<void>;
    openFolderVSCode: (folderPath: string) => Promise<void>;
    openDefaultEditor: (filePath: string) => Promise<void>;
    openInTerminal: (filePath: string) => Promise<void>;
    watch: (projectPath: string) => Promise<void>;
    unwatch: (projectPath: string) => Promise<void>;
    save: (filePath: string, content: string) => Promise<void>;
    regenerateContext: (projectId: string, agentType: AgentType) => Promise<void>;
    onFileChange: (callback: (data: { type: string; path: string }) => void) => void;
    offFileChange: () => void;
  };
  updater: {
    checkNow: () => Promise<void>;
    download: () => Promise<void>;
    install: () => Promise<void>;
    getVersion: () => Promise<string>;
    onUpdateStatus: (callback: (data: UpdateStatus) => void) => void;
    offUpdateStatus: () => void;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
  chat: {
    send: (projectId: string | null, model: string, providerId: string, messages: ChatMessage[]) => Promise<void>;
    getProviders: () => Promise<ChatProviderInfo[]>;
    getHistory: (projectId: string | null) => Promise<ChatMessage[]>;
    clearHistory: (projectId: string | null) => Promise<void>;
    setApiKey: (providerId: string, key: string) => Promise<void>;
    testConnection: (providerId: string) => Promise<{ success: boolean; error?: string }>;
    onToken: (callback: (data: { token: string; done: boolean; messageId: string }) => void) => void;
    offToken: () => void;
  };
  vault: {
    list: () => Promise<VaultEntryMasked[]>;
    save: (entry: { id?: string; provider: string; displayName: string; apiKey: string; baseUrl?: string }) => Promise<VaultEntryMasked>;
    delete: (id: string) => Promise<void>;
    test: (provider: string, apiKey?: string, baseUrl?: string) => Promise<{ success: boolean; error?: string; models?: string[] }>;
  };
  deploy: {
    start: (options: DeployOptions) => Promise<void>;
    forcePush: (projectPath: string) => Promise<DeployResult>;
    onProgress: (callback: (data: DeployStep) => void) => void;
    offProgress: () => void;
    onDone: (callback: (result: DeployResult) => void) => void;
    offDone: () => void;
  };
  vibe: {
    export: (options: VibeExportOptions) => Promise<string | null>;
    pickAndPreview: () => Promise<{ filePath: string; preview: VibeImportPreview } | null>;
    import: (filePath: string, mode: 'new' | 'merge', projectPath: string, projectId?: string, projectName?: string) => Promise<Project | null>;
  };
  snapshot: {
    export: (options: SnapshotExportOptions) => Promise<string | null>;
    estimateSize: (projectId: string, includeSource: boolean, includeGit: boolean) => Promise<number>;
    pickAndPreview: () => Promise<{ filePath: string; preview: SnapshotImportPreview } | null>;
    import: (filePath: string, projectPath: string, projectName?: string) => Promise<Project | null>;
  };
  ghostTest: {
    run: (projectId: string, projectPath: string, agentType: AgentType) => Promise<GhostTestResult>;
    getHistory: (projectId: string) => Promise<GhostTestResult[]>;
    getSettings: (projectId: string) => Promise<GhostTestSettings>;
    updateSettings: (projectId: string, settings: Partial<GhostTestSettings>) => Promise<GhostTestSettings>;
    detectCommand: (projectPath: string) => Promise<string>;
    getAllLastResults: () => Promise<Record<string, GhostTestResult | null>>;
    onProgress: (callback: (data: { projectId: string; message: string }) => void) => void;
    offProgress: () => void;
  };
}

// --- Vibe Bundle Types ---

export interface VibeManifest {
  name: string;
  version: string;
  vibeVersion: '1';
  description: string;
  author: string;
  created: string;
  forgeVersion: string;
  tags: string[];
  category: string;
  constraints: {
    hardware: string | null;
    os: string[];
    minNodeVersion: string;
    requiredTools: string[];
  };
}

export interface VibeExportOptions {
  projectId: string;
  name: string;
  description: string;
  tags: string[];
  author: string;
  includeContextFiles: boolean;
  includeProjectConfig: boolean;
  includeDecisionFiles: boolean;
  includeChatHistory: boolean;
  includeConstraints: boolean;
}

export interface VibeImportPreview {
  manifest: VibeManifest;
  hasContextFiles: boolean;
  contextFileCount: number;
  hasProjectConfig: boolean;
  hasDecisions: boolean;
  hasConstraints: boolean;
  hasChatHistory: boolean;
}

// --- Snapshot Types ---

export interface SnapshotManifest {
  name: string;
  description: string;
  snapshotVersion: '1';
  created: string;
  forgeVersion: string;
  projectId: string;
  includes: {
    source: boolean;
    git: boolean;
    vibe: boolean;
    chatHistory: boolean;
    apiKeys: boolean;
  };
  warnings?: string[];
}

export interface SnapshotExportOptions {
  projectId: string;
  includeSource: boolean;
  includeGit: boolean;
  includeVibe: boolean;
  includeChatHistory: boolean;
  includeApiKeys: boolean;
}

export interface SnapshotImportPreview {
  manifest: SnapshotManifest;
  hasSource: boolean;
  sourceFileCount: number;
  hasGit: boolean;
  hasVibe: boolean;
  hasChatHistory: boolean;
  fileSizeBytes: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
