// ---------------------------------------------------------------------------
// Translates shell commands to plain-English descriptions for the terminal
// output panel. Each rule is a regex + template; first match wins.
// ---------------------------------------------------------------------------

interface TranslationRule {
  pattern: RegExp;
  translate: (match: RegExpMatchArray) => string;
}

const rules: TranslationRule[] = [
  // --- git ---
  { pattern: /^git init/,                            translate: () => 'Setting up version history for your project' },
  { pattern: /^git clone (.+)/,                      translate: (m) => `Downloading project from ${m[1]}` },
  { pattern: /^git add -A/,                          translate: () => 'Preparing all your changes to be saved' },
  { pattern: /^git add \./,                          translate: () => 'Preparing all your changes to be saved' },
  { pattern: /^git add (.+)/,                        translate: (m) => `Preparing ${m[1]} to be saved` },
  { pattern: /^git commit -m ["'](.+?)["']/,         translate: (m) => `Creating a save point: ${m[1]}` },
  { pattern: /^git commit/,                          translate: () => 'Creating a save point' },
  { pattern: /^git push/,                            translate: () => 'Uploading your changes to GitHub' },
  { pattern: /^git pull/,                            translate: () => 'Getting the latest changes from GitHub' },
  { pattern: /^git checkout -b (.+)/,                translate: (m) => `Creating a new version called "${m[1]}"` },
  { pattern: /^git checkout (.+)/,                   translate: (m) => `Switching to version "${m[1]}"` },
  { pattern: /^git branch/,                          translate: () => 'Listing all versions' },
  { pattern: /^git merge (.+)/,                      translate: (m) => `Combining version "${m[1]}" into current` },
  { pattern: /^git stash/,                           translate: () => 'Saving your current changes for later' },
  { pattern: /^git status/,                          translate: () => 'Checking what has changed' },
  { pattern: /^git diff/,                            translate: () => 'Comparing your changes' },
  { pattern: /^git log/,                             translate: () => 'Viewing project history' },
  { pattern: /^git remote add (.+?) (.+)/,           translate: (m) => `Connecting to online copy "${m[1]}"` },
  { pattern: /^git remote/,                          translate: () => 'Managing online connections' },
  { pattern: /^git config/,                          translate: () => 'Updating version history settings' },

  // --- GitHub CLI ---
  { pattern: /^gh repo create (.+)/,                 translate: (m) => `Creating an online copy called ${m[1].split(/\s/)[0]}` },
  { pattern: /^gh auth login/,                       translate: () => 'Connecting to your GitHub account' },
  { pattern: /^gh auth status/,                      translate: () => 'Checking GitHub connection' },
  { pattern: /^gh pr create/,                        translate: () => 'Creating a request to add your changes' },
  { pattern: /^gh repo clone (.+)/,                  translate: (m) => `Downloading ${m[1]} from GitHub` },

  // --- npm ---
  { pattern: /^npm install$/,                        translate: () => 'Installing required tools (this may take a minute)' },
  { pattern: /^npm install (.+)/,                    translate: (m) => `Installing ${m[1]}` },
  { pattern: /^npm i -g (.+)/,                       translate: (m) => `Installing ${m[1]} globally` },
  { pattern: /^npm install -g (.+)/,                 translate: (m) => `Installing ${m[1]} globally` },
  { pattern: /^npm run build/,                       translate: () => 'Preparing your project for sharing' },
  { pattern: /^npm run dev/,                         translate: () => 'Starting your project in development mode' },
  { pattern: /^npm run start/,                       translate: () => 'Starting your project' },
  { pattern: /^npm run test/,                        translate: () => 'Making sure everything works correctly' },
  { pattern: /^npm run lint/,                        translate: () => 'Checking your code for mistakes' },
  { pattern: /^npm run (.+)/,                        translate: (m) => `Running task: ${m[1]}` },
  { pattern: /^npm init/,                            translate: () => 'Setting up project configuration' },
  { pattern: /^npx (.+)/,                            translate: (m) => `Running ${m[1]}` },

  // --- yarn ---
  { pattern: /^yarn install/,                        translate: () => 'Installing required tools' },
  { pattern: /^yarn add (.+)/,                       translate: (m) => `Installing ${m[1]}` },
  { pattern: /^yarn (.+)/,                           translate: (m) => `Running task: ${m[1]}` },

  // --- pnpm ---
  { pattern: /^pnpm install/,                        translate: () => 'Installing required tools' },
  { pattern: /^pnpm add (.+)/,                       translate: (m) => `Installing ${m[1]}` },

  // --- AI agents ---
  { pattern: /^claude\b/,                            translate: () => 'Starting Claude Code AI assistant' },
  { pattern: /^gemini\b/,                            translate: () => 'Starting Gemini AI assistant' },
  { pattern: /^codex\b/,                             translate: () => 'Starting Codex AI assistant' },

  // --- File system ---
  { pattern: /^mkdir -p (.+)/,                       translate: (m) => `Creating folder ${m[1]}` },
  { pattern: /^mkdir (.+)/,                          translate: (m) => `Creating folder ${m[1]}` },
  { pattern: /^rm -rf (.+)/,                         translate: (m) => `Removing ${m[1]}` },
  { pattern: /^cp (.+)/,                             translate: () => 'Copying files' },
  { pattern: /^mv (.+)/,                             translate: () => 'Moving files' },
  { pattern: /^chmod (.+)/,                          translate: () => 'Updating file permissions' },
  { pattern: /^cd (.+)/,                             translate: (m) => `Navigating to ${m[1]}` },
  { pattern: /^ls/,                                  translate: () => 'Listing files' },
  { pattern: /^cat (.+)/,                            translate: (m) => `Reading ${m[1]}` },
  { pattern: /^touch (.+)/,                          translate: (m) => `Creating file ${m[1]}` },

  // --- System ---
  { pattern: /^node (.+)/,                           translate: (m) => `Running ${m[1]}` },
  { pattern: /^python3? (.+)/,                       translate: (m) => `Running Python script ${m[1]}` },
  { pattern: /^pip install (.+)/,                    translate: (m) => `Installing Python package ${m[1]}` },
  { pattern: /^curl (.+)/,                           translate: () => 'Downloading from the internet' },
  { pattern: /^wget (.+)/,                           translate: () => 'Downloading from the internet' },
];

/**
 * Translate a full command string to a plain-English description.
 * Returns null if no translation rule matches.
 */
export function translateCommand(command: string): string | null {
  const trimmed = command.trim();
  for (const rule of rules) {
    const match = trimmed.match(rule.pattern);
    if (match) return rule.translate(match);
  }
  return null;
}

/**
 * Translate with a fallback to the raw command.
 */
export function translateCommandOrRaw(command: string): string {
  return translateCommand(command) ?? command;
}
