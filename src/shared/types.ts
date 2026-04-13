export type ProjectStatus = 'created' | 'in-progress' | 'ready' | 'error';

export type AgentType = 'claude' | 'gemini' | 'codex' | 'copilot' | 'ollama';

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
  isLocal?: boolean;
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
  ollama: {
    type: 'ollama',
    displayName: 'Local AI (Ollama)',
    npmPackage: '',
    command: 'ollama',
    contextFileName: 'LOCAL.md',
    authCheckCommand: 'ollama --version',
    loginCommand: '',
    versionCommand: 'ollama --version',
    subscriptionUrl: 'https://ollama.com',
    docsUrl: 'https://ollama.com/docs',
    iconName: 'ollama',
    color: '#333333',
    isLocal: true,
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

// --- Skill Store Types ---

export type SkillCategory = 'personality' | 'starter' | 'constraint';

export interface SkillEntry {
  id: string;
  name: string;
  author: string;
  version: string;
  category: SkillCategory;
  description: string;
  longDescription?: string;
  icon: string;
  rating: number;
  ratingCount: number;
  size: number;
  tags: string[];
  agents: AgentType[];
  downloadUrl: string | null;
  builtIn: boolean;
}

export interface InstalledSkillRecord {
  skillId: string;
  name: string;
  version: string;
  installedAt: string;
}

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
  fuelBudget: FuelBudget;
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

// --- Forge Directory Types ---

export type AgentRole = 'lead' | 'engineer' | 'reviewer' | 'tester';
export type AgentOrchestratorStatus = 'idle' | 'working' | 'blocked' | 'offline';
export type OrchestrationMode = 'conductor' | 'manual' | 'collaborative';

export interface ForgeManifest {
  forgeVersion: string;
  projectName: string;
  created: string;
  orchestrationMode: OrchestrationMode;
  activeAgents: AgentType[];
  primaryAgent: AgentType;
  blackboardEnabled: boolean;
  shadowGitEnabled: boolean;
  schemaGatingEnabled: boolean;
}

export interface ForgeAgentEntry {
  type: AgentType;
  role: AgentRole;
  status: AgentOrchestratorStatus;
  lastActive: string;
  sessionsCompleted: number;
  tokensConsumed: number;
  filesOwned: string[];
  capabilities: string[];
  restrictions: string[];
}

export interface ForgeRegistry {
  agents: Partial<Record<AgentType, ForgeAgentEntry>>;
}

export interface ForgeState {
  manifest: ForgeManifest;
  registry: ForgeRegistry;
  blackboardTaskCount: number;
  lastSessionTime: string | null;
}

// --- Reasoning Map Types ---

export interface MapNode {
  id: string;
  label: string;
  type: 'page' | 'component' | 'api' | 'model' | 'service' | 'database' | 'test' | 'config';
  files: string[];
  lastModifiedBy?: AgentType | 'user';
  lastModified?: string;
}

export interface ReasoningMap {
  mermaidCode: string;
  nodes: MapNode[];
  lastGenerated: string;
  lastModifiedBy: string;
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
  sizeGb?: number;
  isLocal?: boolean;
}

// --- Ollama Types ---

export interface OllamaModel {
  name: string;
  displayName: string;
  sizeGb: number;
  quantization?: string;
  modifiedAt: string;
}

export interface OllamaStatus {
  running: boolean;
  installed: boolean;
  models: OllamaModel[];
}

export interface OllamaStats {
  modelName?: string;
  tokensPerSecond?: number;
  gpuPercent?: number;
  vramUsedGb?: number;
  vramTotalGb?: number;
}

export interface HardwareInfo {
  totalRamGb: number;
  gpuVramGb: number;
  gpuName?: string;
}

export interface OllamaPullProgress {
  modelName: string;
  status: string;
  downloadedGb?: number;
  totalGb?: number;
  percent?: number;
  done: boolean;
  error?: string;
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

// --- Battle Types ---

export interface BattleSideResult {
  agentType: AgentType;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  runtimeMs: number;
  ghostTestStatus?: GhostTestStatus;
  winner: boolean;
}

export interface BattleRecord {
  id: string;
  projectId: string;
  task: string;
  timestamp: string;
  agents: [AgentType, AgentType];
  sides: [BattleSideResult, BattleSideResult];
  winnerSide: 0 | 1 | null;
}

export interface AgentLeaderboardEntry {
  agentType: AgentType;
  wins: number;
  losses: number;
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

// --- Conductor Mode Types ---

export type ControlLevel = 'express' | 'guided' | 'full-control';
export type StationStatus = 'pending' | 'active' | 'completed' | 'failed';
export type ConductorTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type ConductorStatus =
  | 'planning'
  | 'answering'
  | 'reviewing'
  | 'executing'
  | 'checkpoint'
  | 'completed'
  | 'failed'
  | 'paused';

export interface ConductorTask {
  id: string;
  description: string;
  assignedAgent: AgentType;
  prompt: string;
  status: ConductorTaskStatus;
  duration?: number;
  tokensUsed?: number;
  filesChanged?: string[];
  output?: string;
  error?: string;
}

export interface ConductorStation {
  id: string;
  name: string;
  estimatedMinutes?: number;
  tasks: ConductorTask[];
  hasCheckpoint: boolean;
  status: StationStatus;
  startSnapshotId?: string;
}

export interface ConductorQuestionOption {
  id: string;
  label: string;
  description: string;
  pros?: string;
  cons?: string;
}

export interface ConductorQuestion {
  id: string;
  text: string;
  options: ConductorQuestionOption[];
}

export interface ConductorAnswer {
  questionId: string;
  optionId: string;
}

export interface ConductorPlan {
  id: string;
  projectId: string;
  goal: string;
  controlLevel: ControlLevel;
  questions?: ConductorQuestion[];
  answers?: ConductorAnswer[];
  stations: ConductorStation[];
  status: ConductorStatus;
  currentStationIndex: number;
  currentTaskIndex: number;
  tokenUsage: { used: number; estimated: number; saved: number };
  createdAt: string;
  completedAt?: string;
}

// --- Fuel Gauge Types ---

export type FuelTaskType = 'conductor-task' | 'chat' | 'ghost-test' | 'battle';

export interface FuelEntry {
  id: string;
  timestamp: string; // ISO date
  provider: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;          // USD
  savedAmount: number;   // USD saved by routing
  projectId: string;
  taskType: FuelTaskType;
}

export interface FuelDayReport {
  date: string;          // YYYY-MM-DD
  totalCost: number;
  totalSaved: number;
  freeRequests: number;
  entries: FuelEntry[];
}

export interface FuelStatus {
  todayCost: number;
  todaySaved: number;
  todayFreeRequests: number;
  dailyCap: number;
  percentage: number;
  overBudget: boolean;
}

export interface FuelBudget {
  dailyCap: number;      // USD
  warnAt: number;        // percentage 0-100
  pauseConductorAtCap: boolean;
  hardStop: boolean;
}

export interface FuelProjectReport {
  projectId: string;
  totalCost: number;
  totalSaved: number;
  byProvider: Record<string, { cost: number; requests: number }>;
}

// --- Time Machine Types ---

export type SnapshotTrigger = 'agent-start' | 'agent-end' | 'conductor' | 'manual' | 'auto';
export type SnapshotColor = 'green' | 'red' | 'blue' | 'amber';

export interface TimeMachineSnapshot {
  id: string;
  projectId: string;
  gitTag: string;
  timestamp: string;   // ISO date
  label: string;
  trigger: SnapshotTrigger;
  agentType?: AgentType;
  filesChanged?: string[];
  color: SnapshotColor;
}

// --- Timeline Types ---

export type TimelineEventType =
  | 'agent-start'
  | 'agent-end'
  | 'file-edit'
  | 'git-commit'
  | 'git-push'
  | 'ghost-test'
  | 'battle'
  | 'skill-install'
  | 'skill-uninstall'
  | 'bundle-export'
  | 'settings-change'
  | 'conductor-start'
  | 'conductor-station'
  | 'conductor-complete'
  | 'time-machine-snapshot'
  | 'time-machine-revert';

export interface TimelineEvent {
  id: string;
  projectId: string;
  timestamp: string; // ISO date
  type: TimelineEventType;
  agent?: AgentType;
  description: string;
  details?: {
    filesChanged?: string[];
    filesCreated?: string[];
    filesDeleted?: string[];
    duration?: number;        // ms
    commitMessage?: string;
    testResult?: string;      // 'passed' | 'failed' | 'auto-fixed' | 'timeout'
    battleWinner?: string;
    battleTask?: string;
    skillName?: string;
    linesAdded?: number;
    linesRemoved?: number;
  };
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
  reasoningMap: {
    generate: (projectId: string, projectPath: string) => Promise<ReasoningMap>;
    get: (projectId: string) => Promise<ReasoningMap | null>;
    getAttribution: (projectId: string) => Promise<Record<string, { agent: AgentType | 'user'; date: string }>>;
    onFilesChanged: (callback: (data: { projectId: string }) => void) => void;
    offFilesChanged: () => void;
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
    onAutoResult: (callback: (data: { projectId: string; result: GhostTestResult }) => void) => void;
    offAutoResult: () => void;
  };
  skills: {
    fetchCatalog: () => Promise<SkillEntry[]>;
    getInstalled: (projectId: string) => Promise<InstalledSkillRecord[]>;
    install: (skillId: string, projectId: string) => Promise<void>;
    uninstall: (skillId: string, projectId: string) => Promise<void>;
    saveAs: (skillId: string) => Promise<void>;
  };
  battle: {
    start: (projectId: string, projectPath: string, task: string, agents: [AgentType, AgentType]) => Promise<string>;
    cancel: () => Promise<void>;
    getProgress: () => Promise<{ id: string; agents: [AgentType, AgentType]; progress: [BattleSideProgressDTO, BattleSideProgressDTO] } | null>;
    getDiff: (side: 0 | 1) => Promise<string>;
    applyWinner: (side: 0 | 1, projectPath: string) => Promise<BattleRecord>;
    discard: () => Promise<void>;
    getHistory: (projectId: string) => Promise<BattleRecord[]>;
    getLeaderboard: () => Promise<AgentLeaderboardEntry[]>;
    onProgress: (callback: (event: BattleProgressDTO) => void) => void;
    offProgress: () => void;
  };
  timeline: {
    getEvents: (projectId: string) => Promise<TimelineEvent[]>;
    addEvent: (projectId: string, event: Omit<TimelineEvent, 'id' | 'timestamp' | 'projectId'>) => Promise<TimelineEvent>;
    onEventAdded: (callback: (data: { projectId: string; event: TimelineEvent }) => void) => void;
    offEventAdded: () => void;
  };
  conductor: {
    startPlan: (projectId: string, goal: string, controlLevel: ControlLevel) => Promise<ConductorPlan>;
    submitAnswers: (planId: string, answers: ConductorAnswer[]) => Promise<ConductorPlan>;
    startExecution: (planId: string) => Promise<void>;
    pause: (planId: string) => Promise<void>;
    resume: (planId: string) => Promise<void>;
    skipTask: (planId: string) => Promise<void>;
    stop: (planId: string) => Promise<void>;
    checkpointDecision: (planId: string, decision: 'continue' | 'pause' | 'revert' | 'stop') => Promise<void>;
    getPlan: (projectId: string) => Promise<ConductorPlan | null>;
    reorderTasks: (planId: string, stationId: string, taskIds: string[]) => Promise<ConductorPlan>;
    reassignTask: (planId: string, taskId: string, agentType: AgentType) => Promise<ConductorPlan>;
    onStatusUpdate: (callback: (data: { planId: string; plan: ConductorPlan }) => void) => void;
    offStatusUpdate: () => void;
    onTaskUpdate: (callback: (data: { planId: string; stationId: string; task: ConductorTask }) => void) => void;
    offTaskUpdate: () => void;
  };
  fuel: {
    getStatus: () => Promise<FuelStatus>;
    getBudget: () => Promise<FuelBudget>;
    setBudget: (budget: Partial<FuelBudget>) => Promise<FuelBudget>;
    getProjectReport: (projectId: string) => Promise<FuelProjectReport>;
    onStatusUpdate: (callback: (status: FuelStatus) => void) => void;
    offStatusUpdate: () => void;
  };
  timeMachine: {
    getSnapshots: (projectId: string) => Promise<TimeMachineSnapshot[]>;
    createSnapshot: (projectId: string, projectPath: string, label: string) => Promise<TimeMachineSnapshot>;
    revert: (projectId: string, projectPath: string, snapshotId: string) => Promise<void>;
    preview: (projectId: string, projectPath: string, snapshotId: string) => Promise<{ filesChanged: string[]; diff: string }>;
    backToPresent: (projectId: string, projectPath: string) => Promise<void>;
  };
  hub: {
    fetchCatalog: (forceRefresh?: boolean) => Promise<HubCatalog>;
    installItem: (itemId: string, projectPath: string) => Promise<void>;
    getInstalled: (projectPath: string) => Promise<string[]>;
    trackDownload: (itemId: string) => Promise<void>;
    publish: (input: HubPublishInput) => Promise<{ url: string }>;
    generateVibe: (projectId: string) => Promise<string>;
  };
  forge: {
    initialize: (projectPath: string, agents: AgentType[]) => Promise<void>;
    getState: (projectPath: string) => Promise<ForgeState | null>;
    getAgentMemory: (projectPath: string, agent: AgentType) => Promise<string>;
    appendMemory: (projectPath: string, agent: AgentType, entry: string) => Promise<void>;
    updateAgentStatus: (projectPath: string, agent: AgentType, status: AgentOrchestratorStatus) => Promise<void>;
  };
  ollama: {
    getStatus: () => Promise<OllamaStatus>;
    start: () => Promise<{ success: boolean; error?: string }>;
    getStats: () => Promise<OllamaStats>;
    pullModel: (name: string) => Promise<void>;
    deleteModel: (name: string) => Promise<{ success: boolean; error?: string }>;
    detectHardware: () => Promise<HardwareInfo>;
    onPullProgress: (callback: (data: OllamaPullProgress) => void) => void;
    offPullProgress: () => void;
    onConnectivity: (callback: (data: { online: boolean }) => void) => void;
    offConnectivity: () => void;
  };
}

export interface BattleSideProgressDTO {
  status: 'waiting' | 'running' | 'done' | 'error';
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
  runtimeMs: number;
  log: string[];
  ghostTestStatus?: GhostTestStatus;
  error?: string;
}

export interface BattleProgressDTO {
  battleId: string;
  side: 0 | 1;
  type: 'status' | 'log' | 'done' | 'error' | 'ghost-test';
  progress?: BattleSideProgressDTO;
  message?: string;
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

// --- Forge Hub Types ---

export type HubItemType = 'skill' | 'template' | 'constraint' | 'playbook';

export interface HubAuthor {
  name: string;
  github: string;
  verified: boolean;
}

export interface HubItem {
  id: string;
  type: HubItemType;
  name: string;
  author: HubAuthor;
  version: string;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  agents: string[];
  rating: number;
  ratingCount: number;
  downloads: number;
  size: number;
  icon: string;
  featured: boolean;
  official: boolean;
  source: 'bundled' | 'community';
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  readmeUrl: string;
}

export interface HubCatalog {
  version: string;
  lastUpdated: string;
  items: HubItem[];
}

export interface HubVibeBundleFile {
  path: string;
  content: string;
  merge?: boolean;
}

export interface HubVibeBundle {
  id: string;
  name: string;
  version: string;
  type: HubItemType;
  files: HubVibeBundleFile[];
}

export interface HubPublishInput {
  name: string;
  type: HubItemType;
  description: string;
  longDescription: string;
  category: string;
  tags: string[];
  icon: string;
  vibePath?: string;
  vibeContent?: HubVibeBundle;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
