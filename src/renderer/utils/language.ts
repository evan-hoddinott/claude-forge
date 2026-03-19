import type { AppMode } from '../../shared/types';

// ---------------------------------------------------------------------------
// Label registry — keyed by identifier, values for simple / developer modes
// ---------------------------------------------------------------------------

interface LabelEntry {
  simple: string;
  developer: string;
}

const labels: Record<string, LabelEntry> = {
  // --- Git ---
  git_init:           { simple: 'Setting up version history',            developer: 'Initializing git repository' },
  git_push:           { simple: 'Saving to the cloud',                   developer: 'Pushing to remote' },
  git_commit:         { simple: 'Creating a save point',                 developer: 'Committing changes' },
  git_pull:           { simple: 'Getting latest changes',                developer: 'Pulling from remote' },
  git_clone:          { simple: 'Downloading project',                   developer: 'Cloning repository' },
  git_add:            { simple: 'Preparing your changes',                developer: 'Staging changes' },
  git_stash:          { simple: 'Saving changes for later',              developer: 'Stashing changes' },
  git_merge:          { simple: 'Combining versions',                    developer: 'Merging branches' },
  git_rebase:         { simple: 'Reorganizing your changes',             developer: 'Rebasing branch' },
  git_diff:           { simple: 'Comparing changes',                     developer: 'Viewing diff' },

  // --- GitHub ---
  github_connect:     { simple: 'Connect to GitHub',                     developer: 'Authenticate with GitHub' },
  github_create_repo: { simple: 'Create an online copy',                 developer: 'Create GitHub repository' },
  github_link_repo:   { simple: 'Link to existing online copy',          developer: 'Link existing repository' },
  github_disconnect:  { simple: 'Disconnect from GitHub',                developer: 'Revoke GitHub authentication' },
  github_pr:          { simple: 'Request to add your changes',           developer: 'Pull request' },
  github_issue:       { simple: 'Report a problem',                      developer: 'GitHub issue' },
  github_fork:        { simple: 'Make your own copy',                    developer: 'Fork repository' },

  // --- npm / Node ---
  npm_install:        { simple: 'Installing tools...',                   developer: 'Running npm install...' },
  npm_run:            { simple: 'Running a task...',                     developer: 'Running npm script...' },
  npm_build:          { simple: 'Preparing for sharing',                 developer: 'Running build...' },
  npm_test:           { simple: 'Making sure everything works',          developer: 'Running tests...' },

  // --- Agent ---
  agent_launch:       { simple: 'Starting AI assistant',                 developer: 'Launching Claude Code' },
  agent_auth:         { simple: 'Logging into AI assistant',             developer: 'Authenticating with API' },
  agent_install:      { simple: 'Installing AI assistant',               developer: 'Installing CLI agent' },
  agent_update:       { simple: 'Updating AI assistant',                 developer: 'Updating CLI agent' },
  agent_running:      { simple: 'AI assistant is working',               developer: 'Agent process running' },
  agent_stopped:      { simple: 'AI assistant finished',                 developer: 'Agent process exited' },

  // --- Project ---
  project_create:     { simple: 'Creating your project',                 developer: 'Scaffolding project' },
  project_path:       { simple: 'Project folder',                        developer: 'Project directory path' },
  project_delete:     { simple: 'Remove project',                        developer: 'Delete project' },
  project_open:       { simple: 'Open project',                          developer: 'Open project' },
  project_settings:   { simple: 'Project options',                       developer: 'Project configuration' },

  // --- Environment ---
  wsl_detected:       { simple: 'Linux environment ready',               developer: 'WSL detected' },
  wsl_not_found:      { simple: 'Linux environment not found',           developer: 'WSL not available' },
  wsl_install:        { simple: 'Set up Linux environment',              developer: 'Install WSL' },

  // --- Technical terms ---
  context_file:       { simple: 'AI instructions file',                  developer: 'CLAUDE.md context file' },
  terminal:           { simple: 'Command window',                        developer: 'Terminal' },
  dependencies:       { simple: 'Required tools',                        developer: 'Dependencies' },
  clone:              { simple: 'Download project',                      developer: 'Clone repository' },
  branch:             { simple: 'Version',                               developer: 'Branch' },
  merge:              { simple: 'Combine versions',                      developer: 'Merge' },
  pull_request:       { simple: 'Request to add your changes',           developer: 'Pull request' },
  deploy:             { simple: 'Put it on the internet',                developer: 'Deploy' },
  env_vars:           { simple: 'Secret settings',                       developer: 'Environment variables' },
  api:                { simple: 'Connection to other services',          developer: 'API' },
  port:               { simple: 'Connection number',                     developer: 'Port' },
  build:              { simple: 'Prepare for sharing',                   developer: 'Build' },
  lint:               { simple: 'Check for mistakes',                    developer: 'Lint' },
  test:               { simple: 'Make sure everything works',            developer: 'Run tests' },
  repository:         { simple: 'Online project folder',                 developer: 'Repository' },
  commit:             { simple: 'Save point',                            developer: 'Commit' },
  staging:            { simple: 'Changes ready to save',                 developer: 'Staging area' },
  remote:             { simple: 'Online copy',                           developer: 'Remote' },
  origin:             { simple: 'Default online copy',                   developer: 'Origin remote' },
  head:               { simple: 'Current position',                      developer: 'HEAD' },
  workspace:          { simple: 'Your project files',                    developer: 'Working directory' },
  readme:             { simple: 'Project description file',              developer: 'README.md' },
  package_json:       { simple: 'Project settings file',                 developer: 'package.json' },
  node_modules:       { simple: 'Downloaded tools folder',               developer: 'node_modules' },
  config:             { simple: 'Settings',                              developer: 'Configuration' },
  runtime:            { simple: 'Program runner',                        developer: 'Runtime' },
  compiler:           { simple: 'Code translator',                       developer: 'Compiler' },
  debugger:           { simple: 'Error finder',                          developer: 'Debugger' },
  framework:          { simple: 'Code toolkit',                          developer: 'Framework' },
  sdk:                { simple: 'Development toolkit',                   developer: 'SDK' },
  endpoint:           { simple: 'Service address',                       developer: 'API endpoint' },
  auth_token:         { simple: 'Login key',                             developer: 'Authentication token' },
  ssh_key:            { simple: 'Secure login key',                      developer: 'SSH key' },
  ci_cd:              { simple: 'Automatic testing & publishing',        developer: 'CI/CD pipeline' },
  docker:             { simple: 'App container',                         developer: 'Docker container' },
  migration:          { simple: 'Database update',                       developer: 'Database migration' },
  schema:             { simple: 'Data structure',                        developer: 'Schema' },
  hook:               { simple: 'Automatic action',                      developer: 'Git hook' },
  linter:             { simple: 'Code style checker',                    developer: 'Linter' },
  minify:             { simple: 'Compress for speed',                    developer: 'Minify' },
  transpile:          { simple: 'Convert to compatible code',            developer: 'Transpile' },

  // --- UI actions ---
  create_only:        { simple: 'Create project',                        developer: 'Create Only' },
  create_and_launch:  { simple: 'Create & start AI',                     developer: 'Create & Launch' },
  skip_for_now:       { simple: 'Skip for now',                          developer: 'Skip' },
  browse:             { simple: 'Choose folder',                         developer: 'Browse' },
  select_directory:   { simple: 'Choose a folder',                       developer: 'Select directory' },
  show_details:       { simple: 'Show more info',                        developer: 'Show technical details' },
  hide_details:       { simple: 'Hide extra info',                       developer: 'Hide technical details' },
  retry:              { simple: 'Try again',                             developer: 'Retry' },
  open_terminal:      { simple: 'Open command window',                   developer: 'Open in terminal' },
  open_editor:        { simple: 'Open in code editor',                   developer: 'Open in editor' },
};

// ---------------------------------------------------------------------------
// Current mode accessor
// ---------------------------------------------------------------------------

let _currentMode: AppMode = 'simple';

export function setMode(mode: AppMode): void {
  _currentMode = mode;
}

export function getMode(): AppMode {
  return _currentMode;
}

// ---------------------------------------------------------------------------
// Main label function
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate label text for the current mode.
 *
 * In Developer mode, if the key maps to a simple-mode term that differs
 * significantly, the simple term is shown in parentheses for context.
 * In Simple mode the developer term is appended in parentheses to help
 * users learn terminology.
 */
export function label(key: string): string {
  const entry = labels[key];
  if (!entry) return key;

  if (_currentMode === 'developer') {
    return entry.developer;
  }

  // Simple mode — append technical term in parentheses if different
  if (entry.simple !== entry.developer) {
    return `${entry.simple} (${entry.developer.toLowerCase()})`;
  }
  return entry.simple;
}

/**
 * Returns just the raw label for the given mode without parenthetical.
 */
export function rawLabel(key: string, mode?: AppMode): string {
  const entry = labels[key];
  if (!entry) return key;
  return (mode ?? _currentMode) === 'developer' ? entry.developer : entry.simple;
}

/**
 * Returns all registered label keys (useful for debugging / listing).
 */
export function allLabelKeys(): string[] {
  return Object.keys(labels);
}
