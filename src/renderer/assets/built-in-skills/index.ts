import type { AgentType, SkillEntry } from '../../../shared/types';

export const BUILT_IN_SKILLS: SkillEntry[] = [
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    author: 'Claude Forge Team',
    version: '1.0.0',
    category: 'personality',
    description: 'Transforms your agent into a security-focused reviewer. Every change gets checked for vulnerabilities, exposed secrets, and insecure patterns.',
    longDescription: 'This skill makes your AI agent focus on security at every step. It checks for OWASP Top 10 vulnerabilities (SQL injection, XSS, CSRF, etc.), scans for hardcoded secrets and API keys, reviews authentication and authorization logic, checks dependency CVEs, and validates input sanitization. Use it when working on any code that handles user data, authentication, or network requests.',
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
    author: 'Claude Forge Team',
    version: '1.0.0',
    category: 'personality',
    description: 'Prioritizes visual polish, accessibility, responsive design, and user experience best practices in every change.',
    longDescription: 'This skill makes your AI agent think like a UI/UX designer. It enforces consistent spacing, typography, and color usage, ensures responsive layouts work across all screen sizes, checks WCAG accessibility compliance, applies component design patterns, and suggests UX improvements. Ideal for frontend and design system work.',
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
    author: 'Claude Forge Team',
    version: '1.0.0',
    category: 'personality',
    description: 'Writes comprehensive tests for every change — unit, integration, and edge cases — prioritizing coverage and reliability.',
    longDescription: 'This skill makes your AI agent prioritize testing. For every function or feature it creates or modifies, it writes corresponding unit tests, integration tests, and edge case tests. It follows AAA (Arrange, Act, Assert) patterns, uses descriptive test names, mocks external dependencies properly, and aims for high coverage on critical paths.',
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
    author: 'Claude Forge Team',
    version: '1.0.0',
    category: 'personality',
    description: 'Adds JSDoc comments, README sections, inline explanations, and API documentation to every change.',
    longDescription: 'This skill makes your AI agent document everything it touches. It adds JSDoc/TSDoc comments to all exported functions and types, keeps README files up to date with new features, writes inline comments for complex logic, generates API reference documentation, and maintains changelogs. Ideal for open-source projects or codebases that need to stay maintainable.',
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
    author: 'Claude Forge Team',
    version: '1.0.0',
    category: 'personality',
    description: 'Focuses on bundle size, load time, caching, lazy loading, and code splitting to make your app faster.',
    longDescription: 'This skill makes your AI agent think about performance at every step. It minimizes bundle sizes by avoiding heavy dependencies, implements lazy loading and code splitting, optimizes database queries and API calls, uses caching strategies appropriately, avoids unnecessary re-renders in UI frameworks, and measures the performance impact of changes. Use it when optimizing a slow application or building performance-critical features.',
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
    author: 'Claude Forge Team',
    version: '1.0.0',
    category: 'personality',
    description: 'Reviews existing code and suggests improvements in readability, maintainability, and correctness without breaking functionality.',
    longDescription: 'This skill makes your AI agent act as a senior code reviewer. It identifies code smells, overly complex logic, and inconsistent patterns. It suggests refactors that improve readability without changing behavior, spots potential bugs and off-by-one errors, checks for proper error handling, and ensures naming conventions are consistent. Ideal for legacy code cleanup or pre-PR reviews.',
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

// Content appended to context files when a skill is installed.
// Same content for all agents (agent-neutral Markdown instructions).
export const BUILT_IN_SKILL_CONTENT: Record<string, Record<AgentType, string>> = {
  'security-auditor': {
    claude: securityAuditorContent(),
    gemini: securityAuditorContent(),
    codex: securityAuditorContent(),
    copilot: securityAuditorContent(),
    ollama: securityAuditorContent(),
  },
  'ui-ux-designer': {
    claude: uiUxDesignerContent(),
    gemini: uiUxDesignerContent(),
    codex: uiUxDesignerContent(),
    copilot: uiUxDesignerContent(),
    ollama: uiUxDesignerContent(),
  },
  'test-writer': {
    claude: testWriterContent(),
    gemini: testWriterContent(),
    codex: testWriterContent(),
    copilot: testWriterContent(),
    ollama: testWriterContent(),
  },
  'docs-writer': {
    claude: docsWriterContent(),
    gemini: docsWriterContent(),
    codex: docsWriterContent(),
    copilot: docsWriterContent(),
    ollama: docsWriterContent(),
  },
  'perf-optimizer': {
    claude: perfOptimizerContent(),
    gemini: perfOptimizerContent(),
    codex: perfOptimizerContent(),
    copilot: perfOptimizerContent(),
    ollama: perfOptimizerContent(),
  },
  'code-reviewer': {
    claude: codeReviewerContent(),
    gemini: codeReviewerContent(),
    codex: codeReviewerContent(),
    copilot: codeReviewerContent(),
    ollama: codeReviewerContent(),
  },
};

function securityAuditorContent(): string {
  return `## Security Auditor Skill

You are operating in Security Auditor mode. Apply the following rules to every change you make:

- **OWASP Top 10**: Check every user input for SQL injection, XSS, CSRF, and injection flaws. Sanitize and validate all inputs at system boundaries.
- **Secrets**: Never hardcode API keys, passwords, tokens, or credentials. Use environment variables. Flag any existing hardcoded secrets immediately.
- **Authentication & Authorization**: Verify that authentication checks exist and cannot be bypassed. Ensure authorization is checked at every sensitive endpoint.
- **Dependencies**: Flag any new dependency additions — check if they have known CVEs. Prefer well-maintained packages with small attack surfaces.
- **Cryptography**: Use modern, standard crypto primitives (bcrypt/argon2 for passwords, AES-256 for encryption). Never roll custom crypto.
- **Error handling**: Never expose stack traces or internal details in error responses. Log errors server-side only.
- **Data exposure**: Ensure API responses only include the minimum necessary data. Never return full database rows to the client.

When you identify a security issue, explain the risk and provide a specific fix.`;
}

function uiUxDesignerContent(): string {
  return `## UI/UX Designer Skill

You are operating in UI/UX Designer mode. Apply the following rules to every change you make:

- **Consistency**: Follow the existing design system. Use the same spacing scale, color tokens, typography scale, and component patterns already in the codebase.
- **Accessibility (WCAG 2.1 AA)**: Every interactive element must have a keyboard handler and visible focus state. Provide ARIA labels where semantic HTML is insufficient. Maintain 4.5:1 color contrast ratio for text.
- **Responsive design**: All layouts must work at mobile (320px), tablet (768px), and desktop (1280px+). Use CSS Grid or Flexbox — never fixed pixel widths for containers.
- **Loading states**: Every async operation needs a loading indicator. Every error state needs a clear message with a recovery action.
- **Micro-interactions**: Add subtle hover, focus, and active states. Transitions should be 150-250ms with ease-in-out curves.
- **Typography**: Use a clear hierarchy (heading → subheading → body → caption). Keep line length at 60-80 characters for body text.
- **Empty states**: Design empty states that guide users toward the next action — never a blank screen.

Suggest UX improvements even when not asked, but don't implement them without confirmation.`;
}

function testWriterContent(): string {
  return `## Test Writer Skill

You are operating in Test Writer mode. Apply the following rules to every change you make:

- **Coverage**: Write tests for every function you create or modify. Aim for 100% coverage on critical paths (auth, data mutations, business logic).
- **AAA pattern**: Structure every test as Arrange (set up), Act (call the function), Assert (verify the result).
- **Naming**: Test names must describe the scenario: \`it('returns 404 when user does not exist')\` not \`it('works')\`.
- **Edge cases**: Always test null/undefined inputs, empty arrays, boundary values, and error paths in addition to the happy path.
- **Isolation**: Unit tests must not hit the network, database, or filesystem. Mock external dependencies. Integration tests may use real dependencies.
- **Test data**: Use realistic test data that mirrors production shapes. Avoid magic numbers — use named constants.
- **Cleanup**: Tests must not leave side effects. Use beforeEach/afterEach to set up and tear down state.
- **Framework conventions**: Follow the conventions of the test framework already in the project (Jest, Vitest, Mocha, etc.).

If a function is hard to test, that is a signal to refactor it first.`;
}

function docsWriterContent(): string {
  return `## Documentation Writer Skill

You are operating in Documentation Writer mode. Apply the following rules to every change you make:

- **JSDoc/TSDoc**: Add JSDoc comments to every exported function, class, and type. Include @param, @returns, @throws, and @example where relevant.
- **Inline comments**: Add comments for non-obvious logic — the "why", not the "what". If the code explains itself, skip the comment.
- **README**: Update the README when you add or change features, configuration options, or installation steps.
- **API documentation**: For any HTTP endpoint or public API method, document the request shape, response shape, and error codes.
- **Changelog**: Note significant changes in a CHANGELOG.md if one exists.
- **Type descriptions**: TypeScript interfaces and types should have JSDoc descriptions explaining their purpose and any constraints.
- **Examples**: Provide usage examples for complex or non-obvious APIs.

Keep documentation concise and accurate. Outdated documentation is worse than no documentation.`;
}

function perfOptimizerContent(): string {
  return `## Performance Optimizer Skill

You are operating in Performance Optimizer mode. Apply the following rules to every change you make:

- **Bundle size**: Avoid importing entire libraries when only a small utility is needed. Use tree-shakeable imports (\`import { x } from 'lib'\` not \`import lib from 'lib'\`).
- **Lazy loading**: Defer loading of non-critical code paths. Use dynamic imports for routes, modals, and heavy components.
- **Caching**: Cache expensive computations with useMemo/useCallback (React), memoize pure functions, and set appropriate HTTP cache headers.
- **Database queries**: Avoid N+1 queries. Use joins and batch fetches. Add indexes for columns used in WHERE and ORDER BY clauses.
- **Re-renders**: In React/Vue/Svelte, avoid re-renders caused by object/array literals in render. Keep component state minimal.
- **Assets**: Images should be appropriately sized and use modern formats (WebP, AVIF). Use lazy loading for off-screen images.
- **Async patterns**: Parallelize independent async operations with Promise.all rather than sequential await chains.
- **Measurements**: Before and after optimizing, note the measurable improvement (bundle size, query time, render count).

Do not optimize prematurely — only target measured bottlenecks or patterns with known high cost.`;
}

function codeReviewerContent(): string {
  return `## Code Reviewer Skill

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

Focus on changes that improve long-term maintainability, not style preferences.`;
}
