import type { HubItem, HubVibeBundle } from '../../shared/types';

const OFFICIAL_AUTHOR = {
  name: 'Evan Hoddinott',
  github: 'evan-hoddinott',
  verified: true,
};

const NOW = '2026-04-12';

export const BUILTIN_CATALOG_ITEMS: HubItem[] = [
  // ── Skills ──────────────────────────────────────────────────────────────────
  {
    id: 'security-auditor',
    type: 'skill',
    name: 'Security Auditor',
    author: OFFICIAL_AUTHOR,
    version: '1.2.0',
    description: 'Transforms AI agents into security-focused code reviewers',
    longDescription:
      'Checks every change for OWASP Top 10 vulnerabilities including SQL injection, XSS, CSRF, insecure dependencies (CVE scanning), exposed secrets and API keys, and improper authentication patterns. Adds a pre-commit hook for automatic secret detection.',
    category: 'security',
    tags: ['security', 'owasp', 'audit', 'review', 'cve'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.8,
    ratingCount: 124,
    downloads: 3412,
    size: 14200,
    icon: 'shield',
    featured: true,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-15',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'ui-ux-designer',
    type: 'skill',
    name: 'UI/UX Designer',
    author: OFFICIAL_AUTHOR,
    version: '1.1.0',
    description: 'Guides agents to build beautiful, accessible, responsive UIs',
    longDescription:
      'Enforces Tailwind best practices, WCAG 2.1 accessibility standards, mobile-first responsive design, and modern component patterns. Includes guidance for color contrast, keyboard navigation, screen reader support, and animation performance.',
    category: 'design',
    tags: ['ui', 'ux', 'tailwind', 'accessibility', 'responsive', 'design'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.7,
    ratingCount: 98,
    downloads: 2876,
    size: 11800,
    icon: 'brush',
    featured: true,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-15',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'test-writer',
    type: 'skill',
    name: 'Test Writer',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Maximizes test coverage with comprehensive, maintainable tests',
    longDescription:
      'Guides agents to write unit tests, integration tests, and end-to-end tests. Covers happy paths, edge cases, error states, and boundary conditions. Supports Jest, Vitest, Playwright, Cypress, pytest, and Go testing. Enforces coverage thresholds.',
    category: 'testing',
    tags: ['testing', 'jest', 'vitest', 'coverage', 'tdd', 'playwright'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.6,
    ratingCount: 87,
    downloads: 2341,
    size: 10400,
    icon: 'flask',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-20',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'doc-writer',
    type: 'skill',
    name: 'Documentation Writer',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Generates JSDoc, README files, and API documentation automatically',
    longDescription:
      'Instructs agents to write comprehensive documentation for every function, class, and module. Generates README.md with installation, usage, and API sections. Creates OpenAPI/Swagger specs for REST APIs. Follows language-specific doc conventions.',
    category: 'documentation',
    tags: ['docs', 'jsdoc', 'readme', 'openapi', 'swagger', 'tsdoc'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.5,
    ratingCount: 63,
    downloads: 1892,
    size: 9200,
    icon: 'book',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-20',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'perf-optimizer',
    type: 'skill',
    name: 'Performance Optimizer',
    author: OFFICIAL_AUTHOR,
    version: '1.1.0',
    description: 'Focuses agents on bundle size, lazy loading, and caching strategies',
    longDescription:
      'Guides agents to analyse bundle size, implement lazy loading, optimize images, add caching headers, and eliminate render-blocking resources. Targets Core Web Vitals (LCP, FID, CLS). Supports React, Next.js, Vue, and vanilla JS.',
    category: 'performance',
    tags: ['performance', 'optimization', 'bundle', 'lazy-loading', 'caching', 'web-vitals'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.4,
    ratingCount: 52,
    downloads: 1654,
    size: 10800,
    icon: 'zap',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-01',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'code-reviewer',
    type: 'skill',
    name: 'Code Reviewer',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Enforces clean code principles and proactively suggests refactoring',
    longDescription:
      'Guides agents to follow SOLID principles, DRY, and clean code conventions. Flags code smells, deep nesting, long functions, and magic numbers. Suggests meaningful naming, extracts reusable utilities, and improves readability.',
    category: 'quality',
    tags: ['code-review', 'clean-code', 'refactoring', 'solid', 'dry'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.6,
    ratingCount: 79,
    downloads: 2103,
    size: 9600,
    icon: 'eye',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-01',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'a11y-expert',
    type: 'skill',
    name: 'Accessibility Expert',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Ensures WCAG 2.1 AA compliance and full screen reader support',
    longDescription:
      'Guides agents to implement proper ARIA roles, labels, and live regions. Enforces keyboard navigation, focus management, color contrast ratios, and semantic HTML. Tests with axe-core rules. Supports React, Vue, Angular, and vanilla HTML.',
    category: 'accessibility',
    tags: ['a11y', 'wcag', 'aria', 'screen-reader', 'accessibility'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.7,
    ratingCount: 44,
    downloads: 1287,
    size: 11200,
    icon: 'eye-off',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-10',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'git-workflow',
    type: 'skill',
    name: 'Git Workflow',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Enforces conventional commits, branch strategy, and PR templates',
    longDescription:
      'Guides agents to follow conventional commit format, Gitflow or trunk-based branching, and structured PR descriptions. Adds commit-msg hook for validation, PR template, and CONTRIBUTING.md. Ensures atomic commits with clear messages.',
    category: 'workflow',
    tags: ['git', 'conventional-commits', 'gitflow', 'pr-template', 'workflow'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.5,
    ratingCount: 61,
    downloads: 1743,
    size: 8800,
    icon: 'git-branch',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-10',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },

  // ── Templates ────────────────────────────────────────────────────────────────
  {
    id: 'nextjs-saas',
    type: 'template',
    name: 'Next.js SaaS Starter',
    author: OFFICIAL_AUTHOR,
    version: '1.3.0',
    description: 'Full-stack SaaS with Auth.js, Prisma, Stripe, and a dashboard',
    longDescription:
      'Production-ready SaaS starter with authentication (GitHub + Google OAuth via Auth.js), Prisma ORM with PostgreSQL, Stripe subscription billing, role-based access control, admin dashboard, and email via Resend. Deploy to Vercel in minutes.',
    category: 'web',
    tags: ['nextjs', 'saas', 'stripe', 'prisma', 'auth', 'typescript'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.9,
    ratingCount: 201,
    downloads: 5823,
    size: 42000,
    icon: 'layout',
    featured: true,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-10',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'portfolio',
    type: 'template',
    name: 'Portfolio Website',
    author: OFFICIAL_AUTHOR,
    version: '1.1.0',
    description: 'Personal portfolio with blog, projects showcase, and contact form',
    longDescription:
      'Clean, fast portfolio built with Astro and Tailwind CSS. Includes MDX blog with syntax highlighting, projects grid with filtering, animated hero section, dark mode, and a Resend-powered contact form. Scores 100 on Lighthouse.',
    category: 'web',
    tags: ['portfolio', 'astro', 'blog', 'tailwind', 'mdx'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.7,
    ratingCount: 134,
    downloads: 3921,
    size: 28000,
    icon: 'user',
    featured: true,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-10',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'discord-bot',
    type: 'template',
    name: 'Discord Bot',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Slash commands, event handlers, and a SQLite database included',
    longDescription:
      'Discord.js v14 bot with slash command registration, event handler system, SQLite via better-sqlite3, permission checks, cooldown handling, and structured logging. Dockerized with a GitHub Actions CI/CD pipeline.',
    category: 'bots',
    tags: ['discord', 'bot', 'discord.js', 'sqlite', 'slash-commands'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.6,
    ratingCount: 88,
    downloads: 2412,
    size: 22000,
    icon: 'message-circle',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-25',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'rest-api',
    type: 'template',
    name: 'REST API',
    author: OFFICIAL_AUTHOR,
    version: '1.2.0',
    description: 'Express + PostgreSQL + JWT auth + Swagger docs scaffold',
    longDescription:
      'Production-ready REST API with Express, PostgreSQL via pg, JWT authentication, request validation with Zod, OpenAPI/Swagger documentation, rate limiting, structured logging with Winston, and a full test suite with Jest + Supertest.',
    category: 'backend',
    tags: ['rest', 'express', 'postgresql', 'jwt', 'swagger', 'typescript'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.8,
    ratingCount: 156,
    downloads: 4234,
    size: 35000,
    icon: 'server',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-01-25',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'chrome-extension',
    type: 'template',
    name: 'Chrome Extension',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Manifest v3 with popup, content script, and background service worker',
    longDescription:
      'Chrome Extension Manifest v3 starter with React popup, content script, background service worker, storage API helpers, message passing utilities, and Vite build pipeline. Ready to publish to the Chrome Web Store.',
    category: 'browser',
    tags: ['chrome', 'extension', 'manifest-v3', 'react', 'vite'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.5,
    ratingCount: 67,
    downloads: 1876,
    size: 19000,
    icon: 'puzzle',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-05',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'cli-tool',
    type: 'template',
    name: 'CLI Tool',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Commander.js CLI with config file, plugin system, and npm publishing',
    longDescription:
      'Node.js CLI starter with Commander.js, Inquirer for interactive prompts, Chalk + Ora for styled output, cosmiconfig for config file loading, a plugin system, and a full test suite. Includes GitHub Actions workflow for npm publishing.',
    category: 'tools',
    tags: ['cli', 'commander', 'node', 'npm', 'typescript', 'inquirer'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.6,
    ratingCount: 52,
    downloads: 1532,
    size: 16000,
    icon: 'terminal',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-05',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },

  // ── Constraints ──────────────────────────────────────────────────────────────
  {
    id: 'raspberry-pi-4',
    type: 'constraint',
    name: 'Raspberry Pi 4',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'ARM64 environment with 4GB RAM and GPIO pin access',
    longDescription:
      'Configures agents for Raspberry Pi 4B (ARM64, 4GB RAM, Raspberry Pi OS). Includes GPIO pin constraints, I2C/SPI bus guidance, memory limits, armhf/aarch64 package selection, and performance tradeoffs for the quad-core Cortex-A72.',
    category: 'embedded',
    tags: ['raspberry-pi', 'arm64', 'gpio', 'embedded', 'linux'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.4,
    ratingCount: 38,
    downloads: 876,
    size: 7200,
    icon: 'cpu',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-15',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'esp32-devkit',
    type: 'constraint',
    name: 'ESP32 DevKit',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'ESP32 with 520KB RAM, 4MB flash, FreeRTOS, and Arduino/IDF support',
    longDescription:
      'Configures agents for ESP32 microcontroller development. Covers 520KB SRAM constraints, 4MB flash partitioning, FreeRTOS task management, WiFi/Bluetooth stack memory footprint, Arduino framework vs ESP-IDF tradeoffs, and deep sleep power optimization.',
    category: 'embedded',
    tags: ['esp32', 'iot', 'freertos', 'arduino', 'microcontroller', 'wifi'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.3,
    ratingCount: 29,
    downloads: 654,
    size: 6800,
    icon: 'radio',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-15',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'low-bandwidth',
    type: 'constraint',
    name: 'Low Bandwidth',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Offline-first design with minimal assets and aggressive compression',
    longDescription:
      'Guides agents to build for unreliable or slow internet connections. Enforces offline-first with Service Workers, lazy image loading, critical CSS inlining, text compression (Brotli/gzip), resource budgets (<100KB initial JS), and IndexedDB caching.',
    category: 'environment',
    tags: ['offline', 'pwa', 'compression', 'service-worker', 'low-bandwidth'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.5,
    ratingCount: 41,
    downloads: 1123,
    size: 8100,
    icon: 'wifi-off',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-20',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'legacy-browser',
    type: 'constraint',
    name: 'Legacy Browser',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'ES5-compatible output with polyfills for IE11 and old Safari',
    longDescription:
      'Configures agents to target legacy browsers (IE11, Safari 10, Chrome 49). Enforces ES5 transpilation via Babel, required polyfills (Promises, fetch, Array methods), graceful degradation patterns, and CSS fallbacks for Flexbox/Grid gaps.',
    category: 'environment',
    tags: ['legacy', 'ie11', 'polyfills', 'babel', 'es5', 'compatibility'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 3.9,
    ratingCount: 22,
    downloads: 487,
    size: 7600,
    icon: 'clock',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-02-20',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },

  // ── Playbooks ────────────────────────────────────────────────────────────────
  {
    id: 'add-authentication',
    type: 'playbook',
    name: 'Add Authentication',
    author: OFFICIAL_AUTHOR,
    version: '1.1.0',
    description: 'Step-by-step plan for adding OAuth and session management',
    longDescription:
      'A conductor playbook that adds full authentication to any project: database schema for users and sessions, OAuth providers (GitHub + Google), JWT token handling, protected route middleware, login/logout UI, and password reset flow. Works with Express, Next.js, or FastAPI.',
    category: 'auth',
    tags: ['auth', 'oauth', 'jwt', 'sessions', 'login', 'security'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.8,
    ratingCount: 93,
    downloads: 2876,
    size: 18400,
    icon: 'lock',
    featured: true,
    official: true,
    source: 'bundled',
    createdAt: '2026-03-01',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'setup-ci-cd',
    type: 'playbook',
    name: 'Set Up CI/CD',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'GitHub Actions pipelines for testing, building, and deploying',
    longDescription:
      'A conductor playbook that configures a complete CI/CD pipeline: lint + type-check on PR, test suite with coverage reporting, build and Docker image push, staging deployment on merge to main, and production deployment on tag. Supports Vercel, Railway, Fly.io, and AWS ECS.',
    category: 'devops',
    tags: ['ci-cd', 'github-actions', 'docker', 'deployment', 'devops'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.7,
    ratingCount: 71,
    downloads: 2234,
    size: 21600,
    icon: 'git-merge',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-03-01',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'add-database',
    type: 'playbook',
    name: 'Add Database',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Schema design, migrations, and full CRUD layer in one playbook',
    longDescription:
      'A conductor playbook that adds a database to any project: schema design based on project context, migration files, connection pooling, CRUD service layer, validation, and seed data. Supports PostgreSQL (Prisma/Drizzle), MongoDB (Mongoose), and SQLite.',
    category: 'database',
    tags: ['database', 'prisma', 'drizzle', 'migrations', 'crud', 'schema'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.6,
    ratingCount: 64,
    downloads: 1987,
    size: 19800,
    icon: 'database',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-03-10',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
  {
    id: 'responsive-redesign',
    type: 'playbook',
    name: 'Responsive Redesign',
    author: OFFICIAL_AUTHOR,
    version: '1.0.0',
    description: 'Mobile-first refactor with breakpoints, fluid typography, and testing',
    longDescription:
      'A conductor playbook that makes any UI fully responsive: audits current breakpoints, applies mobile-first CSS refactor, implements fluid typography (clamp), fixes touch targets, adds viewport meta, and validates with BrowserStack device matrix.',
    category: 'design',
    tags: ['responsive', 'mobile-first', 'css', 'breakpoints', 'typography', 'design'],
    agents: ['claude', 'gemini', 'codex', 'copilot', 'ollama'],
    rating: 4.5,
    ratingCount: 48,
    downloads: 1432,
    size: 15200,
    icon: 'smartphone',
    featured: false,
    official: true,
    source: 'bundled',
    createdAt: '2026-03-10',
    updatedAt: NOW,
    downloadUrl: '',
    readmeUrl: '',
  },
];

// ── Vibe bundle content for each built-in item ───────────────────────────────

export const BUILTIN_VIBES: Record<string, HubVibeBundle> = {
  'security-auditor': {
    id: 'security-auditor',
    name: 'Security Auditor',
    version: '1.2.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Security Auditor Skill

You are operating as a **Security Auditor**. For every code change you make or review:

### Must Check
- **Injection**: SQL injection, command injection, path traversal, LDAP injection
- **XSS**: Reflected, stored, and DOM-based cross-site scripting
- **CSRF**: Missing or weak anti-CSRF tokens on state-changing endpoints
- **Auth**: Broken authentication, weak session management, insecure direct object references
- **Secrets**: Hardcoded API keys, passwords, tokens, or credentials in source code
- **Dependencies**: Known CVEs in npm/pip/cargo packages (flag versions with known vulns)
- **Headers**: Missing security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)
- **Crypto**: Weak algorithms (MD5, SHA1 for passwords), insufficient entropy

### Behavior
- Flag every issue with severity: CRITICAL / HIGH / MEDIUM / LOW
- Always suggest a fix alongside every issue
- Never merge code with CRITICAL or HIGH severity issues unaddressed
- Add security-relevant comments inline when appropriate
`,
      },
      {
        path: '.eslintrc.security.json',
        content: JSON.stringify({
          plugins: ['security'],
          extends: ['plugin:security/recommended'],
          rules: {
            'security/detect-object-injection': 'warn',
            'security/detect-non-literal-regexp': 'warn',
            'security/detect-unsafe-regex': 'error',
            'security/detect-buffer-noassert': 'error',
            'security/detect-child-process': 'warn',
            'security/detect-disable-mustache-escape': 'error',
            'security/detect-eval-with-expression': 'error',
            'security/detect-no-csrf-before-method-override': 'error',
            'security/detect-non-literal-fs-filename': 'warn',
            'security/detect-non-literal-require': 'warn',
            'security/detect-possible-timing-attacks': 'warn',
            'security/detect-pseudoRandomBytes': 'error',
          },
        }, null, 2),
      },
      {
        path: '.git/hooks/pre-commit',
        content: `#!/bin/sh
# Secret detection pre-commit hook (installed by Security Auditor skill)
echo "Running secret detection..."
if command -v gitleaks >/dev/null 2>&1; then
  gitleaks detect --staged --no-banner
  if [ $? -ne 0 ]; then
    echo "ERROR: Potential secrets detected. Commit blocked."
    echo "Run 'gitleaks detect --staged' to see details."
    exit 1
  fi
fi
# Fallback: grep for common patterns
if git diff --cached | grep -qE '(api_key|apikey|api-key|secret|password|passwd|token|credential)[[:space:]]*[=:][[:space:]]*["\x27][^"\x27]{8,}'; then
  echo "WARNING: Possible credential pattern detected in staged changes."
  echo "Please review before committing."
fi
echo "Secret detection passed."
`,
      },
    ],
  },

  'ui-ux-designer': {
    id: 'ui-ux-designer',
    name: 'UI/UX Designer',
    version: '1.1.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## UI/UX Designer Skill

You are operating as a **UI/UX Designer**. Apply these principles to every UI change:

### Design Principles
- **Mobile-first**: Start with mobile layout, enhance for larger screens
- **Accessibility**: WCAG 2.1 AA minimum — color contrast ≥ 4.5:1, keyboard navigable
- **Typography**: Use relative units (rem/em), fluid scaling with clamp()
- **Spacing**: Consistent spacing scale (4px base grid)
- **Motion**: Respect prefers-reduced-motion, keep animations <300ms

### Tailwind Guidelines
- Use utility classes; avoid arbitrary values unless necessary
- Prefer semantic color tokens over raw hex values
- Use responsive prefixes (sm:, md:, lg:) consistently
- Group related utilities with whitespace for readability

### Component Patterns
- Every interactive element needs :hover, :focus-visible, :active states
- Buttons need minimum 44×44px touch target
- Form inputs need visible labels (never placeholder-only)
- Loading states for all async operations
- Empty states for all lists/tables
`,
      },
    ],
  },

  'test-writer': {
    id: 'test-writer',
    name: 'Test Writer',
    version: '1.0.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Test Writer Skill

You are operating as a **Test Writer**. For every feature or bug fix:

### Testing Requirements
- Write tests BEFORE or ALONGSIDE implementation (TDD preferred)
- Minimum coverage: 80% lines, 70% branches
- Test the happy path, edge cases, and error states
- Use descriptive test names: "should [behavior] when [condition]"

### What to Test
- **Unit tests**: Pure functions, utilities, data transformations
- **Integration tests**: API endpoints, database operations, service interactions
- **Component tests**: User interactions, conditional rendering, props/state
- **E2E tests**: Critical user flows (auth, checkout, core features)

### Anti-patterns to Avoid
- Never test implementation details (internal state, private methods)
- No brittle selectors (use role/label/text, not CSS classes)
- No sleep/wait hacks — use proper async patterns
- No snapshot tests for dynamic content
`,
      },
      {
        path: 'jest.config.js',
        content: `/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  coverageThreshold: {
    global: { lines: 80, branches: 70, functions: 75, statements: 80 },
  },
  collectCoverageFrom: ['src/**/*.{ts,tsx,js,jsx}', '!src/**/*.d.ts', '!src/**/index.ts'],
};
`,
      },
    ],
  },

  'doc-writer': {
    id: 'doc-writer',
    name: 'Documentation Writer',
    version: '1.0.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Documentation Writer Skill

You are operating as a **Documentation Writer**. Document everything you create or modify:

### Documentation Requirements
- **Every exported function**: JSDoc/TSDoc with @param, @returns, @throws, @example
- **Every class/interface**: Purpose, usage example, key properties
- **Every REST endpoint**: Method, path, auth, request body, response schema, error codes
- **Every config option**: Type, default, description, valid values

### README.md Structure
1. Project name + one-line description
2. Quick start (install + run in <5 commands)
3. Features list
4. Configuration reference
5. API reference (if applicable)
6. Contributing guide
7. License

### Style
- Write for your future self 6 months from now
- Explain *why*, not just *what*
- Include real, runnable code examples
- Keep examples up-to-date when code changes
`,
      },
    ],
  },

  'perf-optimizer': {
    id: 'perf-optimizer',
    name: 'Performance Optimizer',
    version: '1.1.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Performance Optimizer Skill

You are operating as a **Performance Optimizer**. Target these Core Web Vitals thresholds:
- LCP (Largest Contentful Paint): < 2.5s
- FID / INP: < 100ms
- CLS (Cumulative Layout Shift): < 0.1

### Optimization Checklist
- Lazy load routes, images, and heavy components
- Split vendor bundles; target initial JS < 150KB gzipped
- Preconnect to critical third-party origins
- Use next-gen image formats (WebP, AVIF) with width/height attributes
- Cache static assets with long max-age + content hash
- Avoid layout thrash: batch DOM reads/writes
- Debounce/throttle scroll and resize handlers
- Use CSS transforms for animations (avoid width/height/top/left)

### Measurement
- Always measure before and after optimization
- Use Lighthouse in CI to catch regressions
- Real user monitoring with web-vitals library
`,
      },
    ],
  },

  'code-reviewer': {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    version: '1.0.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Code Reviewer Skill

You are operating as a **Code Reviewer**. Apply clean code principles to every change:

### Review Checklist
- **Naming**: Variables, functions, and types have clear, descriptive names
- **Functions**: Single responsibility, ≤ 20 lines, ≤ 3 parameters
- **DRY**: No duplicated logic — extract utilities, hooks, or base classes
- **Complexity**: Cyclomatic complexity ≤ 10; refactor deep nesting
- **Side effects**: Functions are pure where possible; side effects are explicit
- **Error handling**: All async operations have proper error handling

### Refactoring Triggers
- Same logic in 3+ places → extract to shared utility
- Function > 30 lines → split into smaller functions
- Nested ternaries → switch/if statements or strategy pattern
- Magic numbers/strings → named constants
`,
      },
    ],
  },

  'a11y-expert': {
    id: 'a11y-expert',
    name: 'Accessibility Expert',
    version: '1.0.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Accessibility Expert Skill

You are operating as an **Accessibility Expert**. Target WCAG 2.1 AA compliance:

### Required for Every UI Component
- Semantic HTML elements (button, nav, main, aside, header, footer)
- ARIA roles/labels only when semantic HTML is insufficient
- Keyboard navigation: Tab, Enter, Space, Escape, Arrow keys
- Visible focus indicator (outline or box-shadow, never outline:none without replacement)
- Color contrast: ≥ 4.5:1 for normal text, ≥ 3:1 for large text
- No color-only information conveying — always pair with text/icon

### Dynamic Content
- Use aria-live regions for status updates
- aria-busy for loading states
- Focus management after route changes or modal open/close
- Announce errors in forms with aria-describedby

### Testing
- Add axe-core to test suite; fail CI on WCAG violations
- Manual keyboard-only navigation test for every new feature
`,
      },
    ],
  },

  'git-workflow': {
    id: 'git-workflow',
    name: 'Git Workflow',
    version: '1.0.0',
    type: 'skill',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Git Workflow Skill

You are operating with **Git Workflow** guidelines:

### Commit Messages (Conventional Commits)
Format: <type>(<scope>): <description>

Types: feat, fix, docs, style, refactor, test, chore, perf, ci
Examples:
  feat(auth): add GitHub OAuth login
  fix(api): handle null user in /me endpoint
  test(checkout): add integration tests for Stripe webhook

### Branching
- main: production-ready code only
- feature/*: new features (branch from main)
- fix/*: bug fixes (branch from main)
- chore/*: maintenance, deps updates

### PR Guidelines
- One concern per PR
- Include "What changed" and "Why" in description
- Link related issues
- Squash merge to main
`,
      },
      {
        path: '.github/pull_request_template.md',
        content: `## What changed
<!-- Describe what this PR does -->

## Why
<!-- Explain the motivation and context -->

## Related issues
Closes #

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] No regressions introduced
`,
      },
      {
        path: '.commitlintrc.json',
        content: JSON.stringify({
          extends: ['@commitlint/config-conventional'],
          rules: {
            'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf', 'ci', 'revert']],
            'subject-max-length': [2, 'always', 72],
            'subject-case': [2, 'always', 'lower-case'],
          },
        }, null, 2),
      },
    ],
  },

  // Templates — minimal context files pointing agents to the template's purpose

  'nextjs-saas': {
    id: 'nextjs-saas',
    name: 'Next.js SaaS Starter',
    version: '1.3.0',
    type: 'template',
    files: [
      {
        path: 'CLAUDE.md',
        content: `# Next.js SaaS Starter

## Stack
- **Framework**: Next.js 15 (App Router)
- **Auth**: Auth.js v5 (GitHub + Google OAuth)
- **Database**: PostgreSQL via Prisma ORM
- **Payments**: Stripe (subscriptions + webhooks)
- **Email**: Resend
- **Styling**: Tailwind CSS + shadcn/ui
- **Deployment**: Vercel

## Project Structure
\`\`\`
app/
  (auth)/          # Login, register, callback routes
  (dashboard)/     # Protected dashboard routes
  api/             # API routes + Stripe webhooks
components/        # Reusable UI components
lib/               # Prisma client, auth config, Stripe client
prisma/            # Schema, migrations, seed
\`\`\`

## Environment Variables Required
\`\`\`
DATABASE_URL=
AUTH_SECRET=
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
\`\`\`

## Getting Started
1. \`npx create-next-app@latest --example https://github.com/evan-hoddinott/nextjs-saas-starter\`
2. Copy \`.env.example\` to \`.env.local\` and fill in values
3. \`npx prisma migrate dev\`
4. \`npm run dev\`
`,
      },
    ],
  },

  'portfolio': {
    id: 'portfolio',
    name: 'Portfolio Website',
    version: '1.1.0',
    type: 'template',
    files: [
      {
        path: 'CLAUDE.md',
        content: `# Portfolio Website Template

## Stack
- **Framework**: Astro 5
- **Styling**: Tailwind CSS
- **Content**: MDX (blog posts, project pages)
- **Syntax highlighting**: Shiki
- **Contact form**: Resend
- **Deployment**: Netlify / Vercel

## Sections
- Hero with animated introduction
- Projects grid with tech stack tags and live/source links
- Blog with MDX + syntax highlighting
- About page with timeline
- Contact form

## Content Collections
- \`src/content/projects/\` — project MDX files
- \`src/content/blog/\` — blog post MDX files

## Commands
- \`npm run dev\` — Start dev server
- \`npm run build\` — Production build (Lighthouse 100 score)
- \`npm run preview\` — Preview production build
`,
      },
    ],
  },

  'discord-bot': {
    id: 'discord-bot',
    name: 'Discord Bot',
    version: '1.0.0',
    type: 'template',
    files: [
      {
        path: 'CLAUDE.md',
        content: `# Discord Bot Template

## Stack
- **Library**: Discord.js v14
- **Database**: SQLite via better-sqlite3
- **Language**: TypeScript
- **Deploy**: Docker + GitHub Actions

## Structure
\`\`\`
src/
  commands/       # Slash command files (auto-loaded)
  events/         # Event handler files (auto-loaded)
  database/       # Schema and query helpers
  utils/          # Shared utilities
\`\`\`

## Adding a Command
Create \`src/commands/category/command-name.ts\`:
\`\`\`ts
export default {
  data: new SlashCommandBuilder().setName('ping').setDescription('Ping!'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};
\`\`\`

## Environment Variables
\`\`\`
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=   # Optional: for dev guild commands
\`\`\`
`,
      },
    ],
  },

  'rest-api': {
    id: 'rest-api',
    name: 'REST API',
    version: '1.2.0',
    type: 'template',
    files: [
      {
        path: 'CLAUDE.md',
        content: `# REST API Template

## Stack
- **Framework**: Express 5
- **Database**: PostgreSQL via pg + connection pooling
- **Auth**: JWT (access + refresh tokens)
- **Validation**: Zod
- **Docs**: OpenAPI 3.1 via swagger-jsdoc
- **Logging**: Winston + Morgan
- **Testing**: Jest + Supertest

## Structure
\`\`\`
src/
  routes/         # Express routers
  controllers/    # Request handlers
  services/       # Business logic
  middleware/     # Auth, validation, rate limiting
  db/             # Migrations, query builders
  schemas/        # Zod validation schemas
  utils/          # Logger, errors, helpers
\`\`\`

## Auth Flow
POST /auth/register → POST /auth/login → Bearer token in Authorization header
Refresh: POST /auth/refresh with refresh token cookie

## API Docs
Available at /api-docs in development (Swagger UI)
`,
      },
    ],
  },

  'chrome-extension': {
    id: 'chrome-extension',
    name: 'Chrome Extension',
    version: '1.0.0',
    type: 'template',
    files: [
      {
        path: 'CLAUDE.md',
        content: `# Chrome Extension Template (Manifest v3)

## Structure
\`\`\`
src/
  popup/          # React popup UI
  content/        # Content script (injected into pages)
  background/     # Service worker
  utils/          # Shared message passing, storage helpers
public/
  manifest.json   # Extension manifest
\`\`\`

## Message Passing Pattern
\`\`\`ts
// From popup to background
chrome.runtime.sendMessage({ type: 'ACTION', payload: data });

// From content script to background
chrome.runtime.sendMessage({ type: 'PAGE_DATA', payload: pageData });
\`\`\`

## Build
- \`npm run build\` → \`dist/\` folder
- Load unpacked from \`dist/\` in chrome://extensions
- \`npm run watch\` for hot reload during development

## Publishing
1. \`npm run build\`
2. Zip \`dist/\` folder
3. Upload to Chrome Web Store Developer Dashboard
`,
      },
    ],
  },

  'cli-tool': {
    id: 'cli-tool',
    name: 'CLI Tool',
    version: '1.0.0',
    type: 'template',
    files: [
      {
        path: 'CLAUDE.md',
        content: `# CLI Tool Template

## Stack
- **CLI framework**: Commander.js
- **Prompts**: Inquirer.js
- **Styling**: Chalk + Ora spinners
- **Config**: cosmiconfig (supports .rc, package.json, .config.js)
- **Testing**: Vitest + @commander-js/extra-typings

## Structure
\`\`\`
src/
  commands/       # Individual command modules
  utils/          # Logger, config loader, helpers
  plugins/        # Plugin system (optional)
bin/
  cli.ts          # Entry point
\`\`\`

## Adding a Command
\`\`\`ts
program
  .command('deploy')
  .description('Deploy to production')
  .option('-e, --env <env>', 'Environment', 'staging')
  .action(async (options) => { /* ... */ });
\`\`\`

## Publishing
1. Set \`"bin"\` in package.json
2. \`npm run build\`
3. \`npm publish --access public\`
`,
      },
    ],
  },

  // Constraints — CLAUDE.md with specific hardware/environment rules

  'raspberry-pi-4': {
    id: 'raspberry-pi-4',
    name: 'Raspberry Pi 4',
    version: '1.0.0',
    type: 'constraint',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Raspberry Pi 4 Constraints

**Target Hardware**: Raspberry Pi 4B · ARM Cortex-A72 · 4GB LPDDR4 · Raspberry Pi OS (64-bit)

### Memory Budget
- Total: 4GB RAM (OS + apps combined)
- Keep Node.js heap < 512MB; use --max-old-space-size flag
- Avoid in-memory caching of large datasets; use SQLite or file-based caching

### CPU Considerations
- 4 cores @ 1.8GHz — good for parallel workloads
- ARM64 binaries required; verify npm packages have ARM builds
- Avoid heavy compilation at runtime; pre-build where possible

### GPIO / Hardware
- Use \`onoff\` or \`pigpio\` for GPIO access
- I2C on /dev/i2c-1, SPI on /dev/spidev0.0
- Always cleanup GPIO pins on process exit

### Packages to Prefer
- \`better-sqlite3\` over PostgreSQL for local storage
- \`sharp\` for image processing (has ARM64 builds)
- Avoid Electron/Chrome-based apps (too heavy)
`,
      },
    ],
  },

  'esp32-devkit': {
    id: 'esp32-devkit',
    name: 'ESP32 DevKit',
    version: '1.0.0',
    type: 'constraint',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## ESP32 DevKit Constraints

**Target Hardware**: ESP32-WROOM-32 · Xtensa LX6 dual-core 240MHz · 520KB SRAM · 4MB Flash

### Memory Budget
- SRAM: 520KB total (heap typically ~320KB available after stack/OS)
- Flash: 4MB (partition: bootloader + OTA + SPIFFS + app)
- Avoid dynamic allocation in tight loops — use static buffers
- String operations are expensive; prefer char arrays over String class

### FreeRTOS Guidelines
- Assign stack sizes conservatively; use uxTaskGetStackHighWaterMark() to tune
- Use queues for inter-task communication (not global variables)
- WiFi + BT stack uses ~100KB; don't enable both unless needed
- Deep sleep: wake on GPIO, timer, or ULP co-processor

### Power Optimization
- Deep sleep current: ~10µA
- Active WiFi: ~200mA peak
- Use modem sleep between WiFi bursts
- RTC memory (8KB) persists through deep sleep
`,
      },
    ],
  },

  'low-bandwidth': {
    id: 'low-bandwidth',
    name: 'Low Bandwidth',
    version: '1.0.0',
    type: 'constraint',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Low Bandwidth Constraints

**Target**: Unreliable or slow connections (2G/3G/satellite, <1Mbps, >200ms latency)

### Asset Budgets
- Initial HTML: < 15KB gzipped
- Initial CSS: < 20KB gzipped
- Initial JS: < 100KB gzipped (defer everything else)
- Images: WebP/AVIF with explicit width+height, lazy loading
- Fonts: System fonts preferred; if custom, max 2 weights, preloaded

### Offline-First Architecture
- Service Worker caching (Workbox recommended)
- Cache-first for static assets, network-first for API calls
- Optimistic UI updates with background sync
- IndexedDB for local data storage

### Network Efficiency
- Batch API requests where possible
- Use HTTP/2 server push for critical resources
- Enable Brotli compression on server
- Implement request deduplication
`,
      },
    ],
  },

  'legacy-browser': {
    id: 'legacy-browser',
    name: 'Legacy Browser',
    version: '1.0.0',
    type: 'constraint',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Legacy Browser Constraints

**Targets**: IE11, Safari 10, Chrome 49, Firefox 52

### JavaScript
- Output ES5 only — configure Babel with @babel/preset-env and browserslist target
- Required polyfills: Promise, fetch, Array.from, Object.assign, Element.closest
- No optional chaining (?.), nullish coalescing (??), or dynamic import()
- No arrow functions in class fields; no private class fields (#field)

### CSS
- No CSS Grid gap (use margin instead)
- No CSS custom properties (var()) — use SASS variables instead
- Flexbox: use -webkit- prefix for Safari 8 compatibility
- No clip-path, backdrop-filter, or CSS Grid in IE11

### Build Configuration
\`\`\`json
// .browserslistrc
ie 11
safari >= 10
chrome >= 49
firefox >= 52
\`\`\`
`,
      },
    ],
  },

  // Playbooks — conductor plans as markdown structured files

  'add-authentication': {
    id: 'add-authentication',
    name: 'Add Authentication',
    version: '1.1.0',
    type: 'playbook',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Playbook: Add Authentication

### Stations

**Station 1: Database Schema**
- Create users table (id, email, name, avatar, role, createdAt)
- Create sessions table (id, userId, token, expiresAt, createdAt)
- Create accounts table for OAuth providers (provider, providerAccountId, userId)
- Write migration files

**Station 2: Auth Core**
- Install and configure chosen auth library (Auth.js / Passport / custom)
- Configure GitHub OAuth provider
- Configure Google OAuth provider
- Implement JWT generation and verification
- Implement session creation and validation

**Station 3: Protected Routes**
- Create auth middleware that validates session/JWT
- Apply middleware to protected routes
- Return 401 with helpful error for unauthenticated requests
- Implement role-based access control (user / admin)

**Station 4: Auth UI**
- Login page with OAuth provider buttons
- Logout button and handler
- User profile display (avatar, name, email)
- Auth state in global store / React context

**Station 5: Password Reset (if email auth)**
- Forgot password form
- Token generation and email sending
- Reset password form with token validation
- Token expiry and one-time-use enforcement
`,
      },
    ],
  },

  'setup-ci-cd': {
    id: 'setup-ci-cd',
    name: 'Set Up CI/CD',
    version: '1.0.0',
    type: 'playbook',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Playbook: Set Up CI/CD

### Stations

**Station 1: Quality Gates (PR checks)**
Create .github/workflows/pr.yml:
- Lint (eslint + prettier check)
- Type check (tsc --noEmit)
- Unit + integration tests
- Test coverage report as PR comment

**Station 2: Build & Docker**
Create .github/workflows/build.yml (on push to main):
- Build application
- Build Docker image
- Push to GitHub Container Registry (ghcr.io)
- Tag with SHA and 'latest'

**Station 3: Staging Deployment**
Create .github/workflows/deploy-staging.yml:
- Trigger: merge to main
- Deploy Docker image to staging environment
- Run smoke tests against staging
- Post deployment status to Slack/Discord (optional)

**Station 4: Production Deployment**
Create .github/workflows/deploy-production.yml:
- Trigger: push of version tag (v*)
- Require manual approval via GitHub Environments
- Deploy to production
- Create GitHub Release with changelog

**Station 5: Dependency Automation**
- Configure Dependabot for npm + GitHub Actions
- Set update schedule (weekly)
- Auto-merge patch updates if CI passes
`,
      },
      {
        path: '.github/workflows/pr.yml',
        content: `name: PR Checks
on:
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test -- --coverage
`,
      },
    ],
  },

  'add-database': {
    id: 'add-database',
    name: 'Add Database',
    version: '1.0.0',
    type: 'playbook',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Playbook: Add Database

### Stations

**Station 1: Schema Design**
- Analyse project requirements and entities from existing code
- Design normalized schema with appropriate relationships
- Define indexes for common query patterns
- Document schema with comments

**Station 2: Database Setup**
- Install chosen ORM (Prisma / Drizzle / Mongoose)
- Configure connection with pooling
- Set up .env variables (DATABASE_URL)
- Add connection health check endpoint

**Station 3: Migrations**
- Create initial migration from schema
- Set up migration scripts in package.json
- Add migration to CI/CD pipeline
- Write seed data for development

**Station 4: Service Layer**
- Create typed repository/service files for each entity
- Implement CRUD operations with proper error handling
- Add pagination helpers
- Add soft-delete where appropriate

**Station 5: Testing**
- Integration tests against a test database
- Transaction rollback between tests
- Factory functions for test data generation
- Test edge cases: duplicates, cascading deletes, constraints
`,
      },
    ],
  },

  'responsive-redesign': {
    id: 'responsive-redesign',
    name: 'Responsive Redesign',
    version: '1.0.0',
    type: 'playbook',
    files: [
      {
        path: 'CLAUDE.md',
        merge: true,
        content: `
## Playbook: Responsive Redesign

### Stations

**Station 1: Audit**
- Identify all breakpoints currently in use
- Screenshot pages at 375px, 768px, 1024px, 1440px
- List all fixed widths/heights that break at mobile
- Identify touch targets < 44px

**Station 2: Typography & Spacing**
- Convert fixed font sizes to fluid clamp() values
- Replace fixed margins/padding with responsive spacing scale
- Ensure line lengths: 45-75 chars on all screen sizes

**Station 3: Layout Refactor**
- Convert fixed-width containers to max-width with padding
- Replace absolute/fixed positioning breakage with flex/grid
- Implement mobile-first media queries (min-width)
- Fix horizontal scroll issues

**Station 4: Touch & Interaction**
- Enlarge all touch targets to minimum 44×44px
- Replace hover-only interactions with tap-friendly alternatives
- Test and fix keyboard navigation on mobile keyboards
- Add swipe gestures where appropriate (carousels, drawers)

**Station 5: Testing**
- Test on real devices (iPhone SE, Pixel 6, iPad)
- Validate viewport meta tag
- Run Lighthouse mobile audit and address issues
- Cross-browser check (Safari iOS, Chrome Android)
`,
      },
    ],
  },
};
