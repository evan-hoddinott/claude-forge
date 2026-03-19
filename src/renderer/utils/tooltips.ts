// ---------------------------------------------------------------------------
// Contextual help tooltips — shown as (?) icons in Simple Mode
// ---------------------------------------------------------------------------

export interface TooltipEntry {
  term: string;
  title: string;
  description: string;
  learnMoreUrl?: string;
}

const tooltipEntries: Record<string, TooltipEntry> = {
  // --- Core concepts ---
  github: {
    term: 'github',
    title: 'GitHub',
    description: 'GitHub is like Google Drive for code. It saves your project online so you can access it from anywhere and collaborate with others.',
    learnMoreUrl: 'https://docs.github.com/en/get-started',
  },
  repository: {
    term: 'repository',
    title: 'Repository',
    description: 'A repository (or "repo") is an online folder for your project\'s code. It keeps track of every change you make.',
    learnMoreUrl: 'https://docs.github.com/en/repositories',
  },
  git: {
    term: 'git',
    title: 'Git',
    description: 'Git is a tool that tracks changes to your files over time. Think of it like "undo history" for your entire project.',
    learnMoreUrl: 'https://git-scm.com/doc',
  },
  wsl: {
    term: 'wsl',
    title: 'WSL',
    description: 'WSL (Windows Subsystem for Linux) lets you run Linux tools on your Windows computer. AI coding tools work best with Linux.',
    learnMoreUrl: 'https://learn.microsoft.com/en-us/windows/wsl/',
  },
  claude_md: {
    term: 'claude_md',
    title: 'CLAUDE.md',
    description: 'This is a file that tells the AI assistant about your project \u2014 what you\'re building and how you want it built.',
  },
  branch: {
    term: 'branch',
    title: 'Branch',
    description: 'A branch is like a separate copy of your project where you can try changes without affecting the original.',
    learnMoreUrl: 'https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-branches',
  },
  terminal: {
    term: 'terminal',
    title: 'Terminal',
    description: 'A terminal is a text-based way to give your computer commands. Claude Forge handles this for you behind the scenes.',
  },
  commit: {
    term: 'commit',
    title: 'Commit',
    description: 'A commit is a save point in your project\'s history. You can always go back to any previous commit.',
  },
  pull_request: {
    term: 'pull_request',
    title: 'Pull Request',
    description: 'A pull request (PR) is a way to propose changes to a project. Others can review your changes before they\'re added.',
    learnMoreUrl: 'https://docs.github.com/en/pull-requests',
  },
  merge: {
    term: 'merge',
    title: 'Merge',
    description: 'Merging combines changes from one branch into another. It\'s how you add finished work back to the main project.',
  },

  // --- Tools & tech ---
  nodejs: {
    term: 'nodejs',
    title: 'Node.js',
    description: 'Node.js lets you run JavaScript on your computer (not just in a web browser). Many development tools require it.',
    learnMoreUrl: 'https://nodejs.org',
  },
  npm: {
    term: 'npm',
    title: 'npm',
    description: 'npm is a tool that downloads and manages code libraries (packages) that your project needs. It comes with Node.js.',
  },
  github_cli: {
    term: 'github_cli',
    title: 'GitHub CLI',
    description: 'The GitHub CLI (gh) lets you interact with GitHub from the terminal \u2014 create repos, manage pull requests, and more.',
    learnMoreUrl: 'https://cli.github.com',
  },
  api: {
    term: 'api',
    title: 'API',
    description: 'An API is a way for different software to talk to each other. Think of it like a waiter taking your order to the kitchen.',
  },
  env_vars: {
    term: 'env_vars',
    title: 'Environment Variables',
    description: 'Environment variables store secret settings (like passwords and API keys) that your app needs but shouldn\'t be shared publicly.',
  },
  ssh_key: {
    term: 'ssh_key',
    title: 'SSH Key',
    description: 'An SSH key is a secure way to prove your identity to services like GitHub without typing a password every time.',
  },
  docker: {
    term: 'docker',
    title: 'Docker',
    description: 'Docker packages your app and everything it needs into a container, so it runs the same way everywhere.',
  },
  ci_cd: {
    term: 'ci_cd',
    title: 'CI/CD',
    description: 'CI/CD automatically tests your code and deploys it when you push changes. It catches bugs before they reach users.',
  },
  typescript: {
    term: 'typescript',
    title: 'TypeScript',
    description: 'TypeScript adds type checking to JavaScript, helping catch errors before your code runs. It\'s like spell-check for code.',
  },

  // --- Project concepts ---
  dependencies: {
    term: 'dependencies',
    title: 'Dependencies',
    description: 'Dependencies are tools and libraries your project needs to work. They\'re listed in package.json and installed with npm.',
  },
  package_json: {
    term: 'package_json',
    title: 'package.json',
    description: 'This file describes your project \u2014 its name, the tools it needs, and the commands to run it.',
  },
  node_modules: {
    term: 'node_modules',
    title: 'node_modules',
    description: 'This folder contains all the downloaded tools your project needs. It\'s created by npm install and can be very large.',
  },
  linting: {
    term: 'linting',
    title: 'Linting',
    description: 'Linting checks your code for style issues and potential bugs \u2014 like a grammar checker but for code.',
  },
  build: {
    term: 'build',
    title: 'Build',
    description: 'Building prepares your code for production \u2014 it optimizes, compresses, and bundles everything so it loads fast.',
  },
  deploy: {
    term: 'deploy',
    title: 'Deploy',
    description: 'Deploying puts your app on the internet so other people can use it. Think of it as publishing.',
  },
  framework: {
    term: 'framework',
    title: 'Framework',
    description: 'A framework is a pre-built toolkit that gives you a head start. It provides common features so you don\'t have to build everything from scratch.',
  },

  // --- Claude Forge specific ---
  context_file: {
    term: 'context_file',
    title: 'Context File',
    description: 'A context file (like CLAUDE.md) tells the AI assistant about your project. The more detail you add, the better results you\'ll get.',
  },
  project_inputs: {
    term: 'project_inputs',
    title: 'Project Inputs',
    description: 'Inputs are the information you provide about what you\'re building. The AI uses these to understand your project and generate better code.',
  },
  launch_mode: {
    term: 'launch_mode',
    title: 'Launch Mode',
    description: 'Interactive mode asks before making changes. Auto mode lets the AI work without stopping to ask \u2014 faster but less control.',
  },
  agent: {
    term: 'agent',
    title: 'AI Agent',
    description: 'An AI agent (like Claude Code) is a program that can read, write, and run code on your computer with your guidance.',
  },
  visibility: {
    term: 'visibility',
    title: 'Repository Visibility',
    description: 'Public repos can be seen by anyone. Private repos are only visible to you and people you invite.',
  },
};

/**
 * Get a tooltip entry by key.
 */
export function getTooltip(key: string): TooltipEntry | null {
  return tooltipEntries[key] ?? null;
}

/**
 * Get all tooltip entries (useful for debugging / listing).
 */
export function getAllTooltips(): Record<string, TooltipEntry> {
  return tooltipEntries;
}
