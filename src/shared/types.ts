export type ProjectStatus = 'created' | 'in-progress' | 'ready' | 'error';

export type AgentType = 'claude' | 'gemini' | 'codex';

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
};

export interface ProjectInput {
  id: string;
  label: string;
  value: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
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

export interface UserPreferences {
  defaultProjectDir: string;
  projectLocationMode: ProjectLocationMode;
  githubUsername: string;
  theme: 'dark' | 'light' | 'system';
  defaultEditor: string;
  defaultRepoVisibility: 'public' | 'private';
  claudeLaunchMode: 'interactive' | 'auto';
  customSystemPrompt: string;
  defaultAgent: AgentType;
  autoGenerateAllContextFiles: boolean;
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

export interface ElectronAPI {
  projects: {
    list: () => Promise<Project[]>;
    get: (id: string) => Promise<Project | undefined>;
    create: (input: CreateProjectInput) => Promise<Project>;
    update: (id: string, updates: Partial<Project>) => Promise<Project>;
    delete: (id: string, deleteFromDisk?: boolean) => Promise<void>;
  };
  github: {
    createRepo: (name: string, isPrivate: boolean, description: string, projectPath: string) => Promise<GitHubRepo>;
    listRepos: () => Promise<GitHubRepo[]>;
    linkRepo: (projectPath: string, repoUrl: string) => Promise<void>;
    checkAuth: () => Promise<GhAuthStatus>;
    loginStart: () => Promise<{ code: string } | { error: string }>;
    logout: () => Promise<void>;
    repoCount: () => Promise<number>;
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
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
