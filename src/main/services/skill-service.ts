import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as https from 'node:https';
import type { SkillEntry, InstalledSkillRecord, Project, AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import * as store from '../store';

// Built-in skills are imported at runtime from the renderer assets bundle.
// In the main process we duplicate the content here so IPC handlers have
// direct access without crossing process boundaries.

const CATALOG_URL =
  'https://raw.githubusercontent.com/evan-hoddinott/caboo-skills/main/catalog.json';

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CatalogCache {
  data: SkillEntry[];
  fetchedAt: number;
}

let catalogCache: CatalogCache | null = null;

// ---------------------------------------------------------------------------
// Built-in skill definitions (mirrored from renderer assets so the main
// process doesn't need to import renderer code)
// ---------------------------------------------------------------------------

const BUILT_IN_SKILLS: SkillEntry[] = [
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    author: 'Caboo Team',
    version: '1.0.0',
    category: 'personality',
    description:
      'Transforms your agent into a security-focused reviewer. Every change gets checked for vulnerabilities, exposed secrets, and insecure patterns.',
    longDescription:
      'This skill makes your AI agent focus on security at every step. It checks for OWASP Top 10 vulnerabilities, scans for hardcoded secrets and API keys, reviews authentication and authorization logic, checks dependency CVEs, and validates input sanitization.',
    icon: '🛡',
    rating: 4.5,
    ratingCount: 42,
    size: 0,
    tags: ['security', 'review', 'audit', 'owasp'],
    agents: ['claude', 'gemini', 'codex', 'copilot'],
    downloadUrl: null,
    builtIn: true,
  },
  {
    id: 'ui-ux-designer',
    name: 'UI/UX Designer',
    author: 'Caboo Team',
    version: '1.0.0',
    category: 'personality',
    description:
      'Prioritizes visual polish, accessibility, responsive design, and user experience best practices in every change.',
    longDescription:
      'This skill makes your AI agent think like a UI/UX designer. It enforces consistent spacing and typography, ensures responsive layouts, checks WCAG accessibility compliance, applies component design patterns, and suggests UX improvements.',
    icon: '🎨',
    rating: 4.7,
    ratingCount: 87,
    size: 0,
    tags: ['ui', 'ux', 'design', 'accessibility', 'responsive'],
    agents: ['claude', 'gemini', 'codex', 'copilot'],
    downloadUrl: null,
    builtIn: true,
  },
  {
    id: 'test-writer',
    name: 'Test Writer',
    author: 'Caboo Team',
    version: '1.0.0',
    category: 'personality',
    description:
      'Writes comprehensive tests for every change — unit, integration, and edge cases — prioritizing coverage and reliability.',
    longDescription:
      'This skill makes your AI agent prioritize testing. For every function or feature it creates or modifies, it writes unit tests, integration tests, and edge case tests following AAA patterns.',
    icon: '🧪',
    rating: 4.2,
    ratingCount: 19,
    size: 0,
    tags: ['testing', 'tdd', 'coverage', 'jest', 'vitest'],
    agents: ['claude', 'gemini', 'codex', 'copilot'],
    downloadUrl: null,
    builtIn: true,
  },
  {
    id: 'docs-writer',
    name: 'Documentation Writer',
    author: 'Caboo Team',
    version: '1.0.0',
    category: 'personality',
    description:
      'Adds JSDoc comments, README sections, inline explanations, and API documentation to every change.',
    longDescription:
      'This skill makes your AI agent document everything it touches. It adds JSDoc/TSDoc comments, keeps README files up to date, writes inline comments for complex logic, and generates API reference documentation.',
    icon: '📝',
    rating: 4.3,
    ratingCount: 28,
    size: 0,
    tags: ['docs', 'jsdoc', 'readme', 'comments', 'api'],
    agents: ['claude', 'gemini', 'codex', 'copilot'],
    downloadUrl: null,
    builtIn: true,
  },
  {
    id: 'perf-optimizer',
    name: 'Performance Optimizer',
    author: 'Caboo Team',
    version: '1.0.0',
    category: 'personality',
    description:
      'Focuses on bundle size, load time, caching, lazy loading, and code splitting to make your app faster.',
    longDescription:
      'This skill makes your AI agent think about performance at every step. It minimizes bundle sizes, implements lazy loading, optimizes database queries, uses caching strategies, and avoids unnecessary re-renders.',
    icon: '⚡',
    rating: 4.4,
    ratingCount: 31,
    size: 0,
    tags: ['performance', 'optimization', 'bundle', 'caching', 'lazy-loading'],
    agents: ['claude', 'gemini', 'codex', 'copilot'],
    downloadUrl: null,
    builtIn: true,
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    author: 'Caboo Team',
    version: '1.0.0',
    category: 'personality',
    description:
      'Reviews existing code and suggests improvements in readability, maintainability, and correctness without breaking functionality.',
    longDescription:
      'This skill makes your AI agent act as a senior code reviewer. It identifies code smells, suggests refactors, spots potential bugs, checks error handling, and ensures naming conventions are consistent.',
    icon: '🔍',
    rating: 4.6,
    ratingCount: 55,
    size: 0,
    tags: ['review', 'refactor', 'clean-code', 'quality'],
    agents: ['claude', 'gemini', 'codex', 'copilot'],
    downloadUrl: null,
    builtIn: true,
  },
];

const BUILT_IN_CONTENT: Record<string, string> = {
  'security-auditor': `## Security Auditor Skill

You are operating in Security Auditor mode. Apply the following rules to every change you make:

- **OWASP Top 10**: Check every user input for SQL injection, XSS, CSRF, and injection flaws. Sanitize and validate all inputs at system boundaries.
- **Secrets**: Never hardcode API keys, passwords, tokens, or credentials. Use environment variables. Flag any existing hardcoded secrets immediately.
- **Authentication & Authorization**: Verify that authentication checks exist and cannot be bypassed. Ensure authorization is checked at every sensitive endpoint.
- **Dependencies**: Flag any new dependency additions — check if they have known CVEs. Prefer well-maintained packages with small attack surfaces.
- **Cryptography**: Use modern, standard crypto primitives (bcrypt/argon2 for passwords, AES-256 for encryption). Never roll custom crypto.
- **Error handling**: Never expose stack traces or internal details in error responses. Log errors server-side only.
- **Data exposure**: Ensure API responses only include the minimum necessary data. Never return full database rows to the client.

When you identify a security issue, explain the risk and provide a specific fix.`,

  'ui-ux-designer': `## UI/UX Designer Skill

You are operating in UI/UX Designer mode. Apply the following rules to every change you make:

- **Consistency**: Follow the existing design system. Use the same spacing scale, color tokens, typography scale, and component patterns already in the codebase.
- **Accessibility (WCAG 2.1 AA)**: Every interactive element must have a keyboard handler and visible focus state. Provide ARIA labels where semantic HTML is insufficient. Maintain 4.5:1 color contrast ratio for text.
- **Responsive design**: All layouts must work at mobile (320px), tablet (768px), and desktop (1280px+). Use CSS Grid or Flexbox — never fixed pixel widths for containers.
- **Loading states**: Every async operation needs a loading indicator. Every error state needs a clear message with a recovery action.
- **Micro-interactions**: Add subtle hover, focus, and active states. Transitions should be 150-250ms with ease-in-out curves.
- **Typography**: Use a clear hierarchy (heading → subheading → body → caption). Keep line length at 60-80 characters for body text.
- **Empty states**: Design empty states that guide users toward the next action — never a blank screen.

Suggest UX improvements even when not asked, but don't implement them without confirmation.`,

  'test-writer': `## Test Writer Skill

You are operating in Test Writer mode. Apply the following rules to every change you make:

- **Coverage**: Write tests for every function you create or modify. Aim for 100% coverage on critical paths (auth, data mutations, business logic).
- **AAA pattern**: Structure every test as Arrange (set up), Act (call the function), Assert (verify the result).
- **Naming**: Test names must describe the scenario: \`it('returns 404 when user does not exist')\` not \`it('works')\`.
- **Edge cases**: Always test null/undefined inputs, empty arrays, boundary values, and error paths in addition to the happy path.
- **Isolation**: Unit tests must not hit the network, database, or filesystem. Mock external dependencies. Integration tests may use real dependencies.
- **Test data**: Use realistic test data that mirrors production shapes. Avoid magic numbers — use named constants.
- **Cleanup**: Tests must not leave side effects. Use beforeEach/afterEach to set up and tear down state.
- **Framework conventions**: Follow the conventions of the test framework already in the project (Jest, Vitest, Mocha, etc.).

If a function is hard to test, that is a signal to refactor it first.`,

  'docs-writer': `## Documentation Writer Skill

You are operating in Documentation Writer mode. Apply the following rules to every change you make:

- **JSDoc/TSDoc**: Add JSDoc comments to every exported function, class, and type. Include @param, @returns, @throws, and @example where relevant.
- **Inline comments**: Add comments for non-obvious logic — the "why", not the "what". If the code explains itself, skip the comment.
- **README**: Update the README when you add or change features, configuration options, or installation steps.
- **API documentation**: For any HTTP endpoint or public API method, document the request shape, response shape, and error codes.
- **Changelog**: Note significant changes in a CHANGELOG.md if one exists.
- **Type descriptions**: TypeScript interfaces and types should have JSDoc descriptions explaining their purpose and any constraints.
- **Examples**: Provide usage examples for complex or non-obvious APIs.

Keep documentation concise and accurate. Outdated documentation is worse than no documentation.`,

  'perf-optimizer': `## Performance Optimizer Skill

You are operating in Performance Optimizer mode. Apply the following rules to every change you make:

- **Bundle size**: Avoid importing entire libraries when only a small utility is needed. Use tree-shakeable imports (\`import { x } from 'lib'\` not \`import lib from 'lib'\`).
- **Lazy loading**: Defer loading of non-critical code paths. Use dynamic imports for routes, modals, and heavy components.
- **Caching**: Cache expensive computations with useMemo/useCallback (React), memoize pure functions, and set appropriate HTTP cache headers.
- **Database queries**: Avoid N+1 queries. Use joins and batch fetches. Add indexes for columns used in WHERE and ORDER BY clauses.
- **Re-renders**: In React/Vue/Svelte, avoid re-renders caused by object/array literals in render. Keep component state minimal.
- **Assets**: Images should be appropriately sized and use modern formats (WebP, AVIF). Use lazy loading for off-screen images.
- **Async patterns**: Parallelize independent async operations with Promise.all rather than sequential await chains.
- **Measurements**: Before and after optimizing, note the measurable improvement (bundle size, query time, render count).

Do not optimize prematurely — only target measured bottlenecks or patterns with known high cost.`,

  'code-reviewer': `## Code Reviewer Skill

You are operating in Code Reviewer mode. Apply the following rules to every change you make:

- **Readability**: Code should be self-documenting. Use descriptive names for variables, functions, and types. Avoid abbreviations unless universally understood.
- **Single responsibility**: Functions and modules should do one thing. If a function is longer than ~40 lines, it probably does too much.
- **DRY principle**: Identify and eliminate duplication. Extract shared logic into reusable utilities — but only after the pattern appears at least twice.
- **Error handling**: Every async operation and external call must handle errors explicitly. Never silently swallow errors.
- **Consistency**: Follow the existing code style and patterns in the file/module. Don't mix paradigms.
- **Complexity**: Flag cyclomatic complexity > 10 in a single function. Prefer early returns to deeply nested conditionals.
- **Magic values**: Replace magic numbers and strings with named constants.
- **Dead code**: Remove unused variables, imports, functions, and commented-out code.
- **Suggestions**: When you identify an issue, explain why it's a problem and suggest a specific improvement. Don't just flag — fix.

Focus on changes that improve long-term maintainability, not style preferences.`,
};

// ---------------------------------------------------------------------------
// HTTP fetch helper (no node-fetch dependency needed)
// ---------------------------------------------------------------------------

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 10000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          res.resume();
          return;
        }
        let body = '';
        res.on('data', (chunk: Buffer) => (body += chunk.toString()));
        res.on('end', () => resolve(body));
      })
      .on('error', reject)
      .on('timeout', () => reject(new Error('Request timed out')));
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchCatalog(): Promise<SkillEntry[]> {
  // Return cached if fresh
  if (catalogCache && Date.now() - catalogCache.fetchedAt < CACHE_TTL_MS) {
    return catalogCache.data;
  }

  try {
    const body = await fetchUrl(CATALOG_URL);
    const json = JSON.parse(body) as { skills?: SkillEntry[] };
    const remote: SkillEntry[] = (json.skills ?? []).map((s) => ({ ...s, builtIn: false }));

    // Merge: built-ins take precedence over remote entries with the same id
    const builtInIds = new Set(BUILT_IN_SKILLS.map((s) => s.id));
    const merged = [...BUILT_IN_SKILLS, ...remote.filter((s) => !builtInIds.has(s.id))];

    catalogCache = { data: merged, fetchedAt: Date.now() };
    return merged;
  } catch {
    // Offline or repo doesn't exist yet — return built-ins only
    return BUILT_IN_SKILLS;
  }
}

export async function installSkill(skillId: string, project: Project): Promise<void> {
  const catalog = await fetchCatalog();
  const skill = catalog.find((s) => s.id === skillId);
  if (!skill) throw new Error(`Skill "${skillId}" not found in catalog`);

  let content: string;
  if (skill.builtIn) {
    content = BUILT_IN_CONTENT[skillId];
    if (!content) throw new Error(`No content for built-in skill "${skillId}"`);
  } else {
    if (!skill.downloadUrl) throw new Error(`Skill "${skillId}" has no download URL`);
    const raw = await fetchUrl(skill.downloadUrl);
    const bundle = JSON.parse(raw) as { content?: string };
    content = bundle.content ?? raw;
  }

  const agentsToUpdate: AgentType[] = project.agents.length > 0 ? project.agents : ['claude'];

  for (const agentType of agentsToUpdate) {
    const agentConfig = AGENTS[agentType];
    if (!agentConfig) continue;

    const contextFilePath = path.join(project.path, agentConfig.contextFileName);
    const startTag = `<!-- caboo-skill:${skillId} -->`;
    const endTag = `<!-- /caboo-skill:${skillId} -->`;
    const legacyStartTag = `<!-- forge-skill:${skillId} -->`;

    // Read existing content (or empty string if file doesn't exist)
    let existing = '';
    try {
      existing = await fs.readFile(contextFilePath, 'utf-8');
    } catch {
      // File doesn't exist yet — will be created
    }

    // Skip if already installed (idempotent)
    if (existing.includes(startTag) || existing.includes(legacyStartTag)) continue;

    // Ensure parent directory exists (e.g. .github/ for copilot)
    const dir = path.dirname(contextFilePath);
    await fs.mkdir(dir, { recursive: true });

    const section = `\n\n${startTag}\n${content}\n${endTag}\n`;
    await fs.writeFile(contextFilePath, existing + section, 'utf-8');
  }

  const record: InstalledSkillRecord = {
    skillId,
    name: skill.name,
    version: skill.version,
    installedAt: new Date().toISOString(),
  };
  store.addInstalledSkill(project.id, record);
}

export async function uninstallSkill(skillId: string, project: Project): Promise<void> {
  const agentsToUpdate: AgentType[] = project.agents.length > 0 ? project.agents : ['claude'];
  const tagPairs = [
    {
      startTag: `<!-- caboo-skill:${skillId} -->`,
      endTag: `<!-- /caboo-skill:${skillId} -->`,
    },
    {
      startTag: `<!-- forge-skill:${skillId} -->`,
      endTag: `<!-- /forge-skill:${skillId} -->`,
    },
  ];

  for (const agentType of agentsToUpdate) {
    const agentConfig = AGENTS[agentType];
    if (!agentConfig) continue;

    const contextFilePath = path.join(project.path, agentConfig.contextFileName);

    let existing = '';
    try {
      existing = await fs.readFile(contextFilePath, 'utf-8');
    } catch {
      continue; // File doesn't exist — nothing to remove
    }

    if (!tagPairs.some(({ startTag }) => existing.includes(startTag))) continue;

    let cleaned = existing;
    for (const { startTag, endTag } of tagPairs) {
      const blockRegex = new RegExp(
        `\\n*${escapeRegex(startTag)}[\\s\\S]*?${escapeRegex(endTag)}\\n*`,
        'g',
      );
      cleaned = cleaned.replace(blockRegex, '\n');
    }

    await fs.writeFile(contextFilePath, `${cleaned.trimEnd()}\n`, 'utf-8');
  }

  store.removeInstalledSkill(project.id, skillId);
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
