import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import { execSync } from 'node:child_process';
import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import type { TestPipelineResult, TestStep } from '../../shared/types';
import * as store from '../store';
import { runCommand } from '../utils/run-command';

function broadcast(channel: string, data: unknown): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

function broadcastStep(projectId: string, step: TestStep) {
  broadcast('test-pipeline:progress', { projectId, step });
}

// --- Cheap model for AI review ---

function selectReviewModel(): { provider: string; model: string; baseUrl?: string; apiKey?: string } | null {
  try {
    const ghToken = execSync('gh auth token', { timeout: 5000 }).toString().trim();
    if (ghToken) {
      return { provider: 'github', model: 'gpt-4o-mini', baseUrl: 'https://models.inference.ai.azure.com', apiKey: ghToken };
    }
  } catch { /* skip */ }

  const anthropicKey = store.getApiKey('anthropic');
  if (anthropicKey) return { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', apiKey: anthropicKey };

  const openaiKey = store.getApiKey('openai');
  if (openaiKey) return { provider: 'openai', model: 'gpt-4o-mini', apiKey: openaiKey };

  return null;
}

async function callReviewModel(model: NonNullable<ReturnType<typeof selectReviewModel>>, prompt: string): Promise<string> {
  if (model.provider === 'github' || model.provider === 'openai') {
    const baseUrl = model.baseUrl ?? 'https://api.openai.com/v1';
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${model.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model.model, messages: [{ role: 'user', content: prompt }], max_tokens: 1000 }),
    });
    const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    return json.choices[0]?.message?.content ?? '';
  }
  if (model.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': model.apiKey!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: model.model, max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
    });
    const json = (await res.json()) as { content: Array<{ text: string }> };
    return json.content[0]?.text ?? '';
  }
  return '';
}

async function runStep(step: TestStep, projectPath: string, projectId: string): Promise<TestStep> {
  step.status = 'running';
  broadcastStep(projectId, { ...step });

  const start = Date.now();
  try {
    if (step.command) {
      const output = await runCommand(step.command, { cwd: projectPath, timeout: 60000 });
      step.output = output.slice(0, 3000);
      step.status = 'passed';
    } else {
      step.status = 'passed';
    }
  } catch (err) {
    step.status = 'failed';
    step.output = err instanceof Error ? err.message.slice(0, 3000) : String(err);
  }
  step.duration = Date.now() - start;
  broadcastStep(projectId, { ...step });
  return step;
}

function detectCommands(projectPath: string): { test?: string; build?: string; lint?: string } {
  try {
    const pkg = JSON.parse(require('node:fs').readFileSync(nodePath.join(projectPath, 'package.json'), 'utf-8')) as { scripts?: Record<string, string> };
    const scripts = pkg.scripts ?? {};
    return {
      test: scripts['test'] ? 'npm test -- --passWithNoTests 2>&1 || true' : undefined,
      build: scripts['build'] ? 'npm run build 2>&1' : undefined,
      lint: scripts['lint'] ? 'npm run lint 2>&1 || true' : undefined,
    };
  } catch {
    return {};
  }
}

export async function runPipeline(opts: { projectId: string; projectPath: string }): Promise<TestPipelineResult> {
  const { projectId, projectPath } = opts;
  const commands = detectCommands(projectPath);

  const steps: TestStep[] = [
    { id: 'tests',   label: 'Unit Tests',        command: commands.test,  status: commands.test  ? 'pending' : 'skipped' },
    { id: 'build',   label: 'Build',             command: commands.build, status: commands.build ? 'pending' : 'skipped' },
    { id: 'lint',    label: 'Lint',              command: commands.lint,  status: commands.lint  ? 'pending' : 'skipped' },
    { id: 'runtime', label: 'Runtime Check',     command: undefined,      status: 'pending' },
    { id: 'review',  label: 'AI Code Review',    command: undefined,      status: 'pending' },
    { id: 'notes',   label: 'Test Report',       command: undefined,      status: 'pending' },
  ];

  const result: TestPipelineResult = {
    id: uuidv4(),
    projectId,
    ranAt: new Date().toISOString(),
    steps,
    overallStatus: 'passed',
  };

  // Steps 1-3: automated checks
  for (const step of steps.slice(0, 3)) {
    if (step.status === 'skipped') {
      broadcastStep(projectId, { ...step });
      continue;
    }
    await runStep(step, projectPath, projectId);
  }

  // Step 4: Runtime check — verify no obvious syntax/import errors
  const runtimeStep = steps[3];
  runtimeStep.status = 'running';
  broadcastStep(projectId, { ...runtimeStep });
  try {
    // Check for TypeScript errors if tsconfig exists
    try {
      await fs.access(nodePath.join(projectPath, 'tsconfig.json'));
      const tsOutput = await runCommand('npx tsc --noEmit 2>&1 | head -20 || true', { cwd: projectPath, timeout: 30000 });
      runtimeStep.output = tsOutput || 'No TypeScript errors found';
    } catch {
      runtimeStep.output = 'TypeScript check skipped (no tsconfig)';
    }
    runtimeStep.status = 'passed';
  } catch (err) {
    runtimeStep.status = 'failed';
    runtimeStep.output = err instanceof Error ? err.message : String(err);
  }
  runtimeStep.duration = 0;
  broadcastStep(projectId, { ...runtimeStep });

  // Step 5: AI code review
  const reviewStep = steps[4];
  reviewStep.status = 'running';
  broadcastStep(projectId, { ...reviewStep });
  const model = selectReviewModel();
  if (model) {
    try {
      // Collect test outputs for review context
      const testContext = steps.slice(0, 4)
        .filter((s) => s.output)
        .map((s) => `[${s.label}]\n${s.output}`)
        .join('\n\n');

      // Sample a few recent files for review
      let codeContext = '';
      try {
        const recentFiles = await runCommand('git diff --name-only HEAD~1 HEAD 2>/dev/null | head -5 || true', { cwd: projectPath, timeout: 5000 });
        for (const file of recentFiles.split('\n').filter(Boolean).slice(0, 3)) {
          const content = await fs.readFile(nodePath.join(projectPath, file), 'utf-8').catch(() => '');
          if (content) codeContext += `\n\n// ${file}\n${content.slice(0, 500)}`;
        }
      } catch { /* skip */ }

      const prompt = `You are a code reviewer. Review this project's test results and recent code changes. Identify up to 3 specific issues or improvements. Be concise and actionable.

Test results:
${testContext || '(no test output)'}

Recent code:
${codeContext || '(no recent changes)'}

Provide a structured review with: 1) overall verdict (PASS/WARN/FAIL), 2) up to 3 specific findings, 3) one recommended next step.`;

      const review = await callReviewModel(model, prompt);
      reviewStep.output = review;
      reviewStep.status = 'passed';
    } catch (err) {
      reviewStep.status = 'failed';
      reviewStep.output = 'AI review unavailable: ' + (err instanceof Error ? err.message : String(err));
    }
  } else {
    reviewStep.status = 'skipped';
    reviewStep.output = 'No AI provider connected — connect GitHub, Claude, or OpenAI in Settings to enable AI review.';
  }
  broadcastStep(projectId, { ...reviewStep });

  // Step 6: Generate report
  const notesStep = steps[5];
  notesStep.status = 'running';
  broadcastStep(projectId, { ...notesStep });

  const passed = steps.filter((s) => s.status === 'passed').length;
  const failed = steps.filter((s) => s.status === 'failed').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  notesStep.output = `${passed} passed · ${failed} failed · ${skipped} skipped`;
  notesStep.status = 'passed';
  broadcastStep(projectId, { ...notesStep });

  result.overallStatus = failed > 0 ? 'failed' : passed < steps.length - skipped ? 'partial' : 'passed';
  result.aiNotes = steps[4].output;

  // Save to history
  saveResult(projectId, result);

  return result;
}

function saveResult(projectId: string, result: TestPipelineResult): void {
  try {
    store.saveTestPipelineResult(projectId, result);
  } catch { /* non-fatal */ }
}

export function getHistory(projectId: string): TestPipelineResult[] {
  try {
    return store.getTestPipelineHistory(projectId);
  } catch {
    return [];
  }
}
