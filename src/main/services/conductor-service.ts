import { spawn, execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import type {
  ConductorPlan,
  ConductorStation,
  ConductorTask,
  ConductorQuestion,
  ConductorAnswer,
  ControlLevel,
  AgentType,
  TaskComplexity,
} from '../../shared/types';
import { AGENTS } from '../../shared/types';
import * as store from '../store';
import * as fuelService from './fuel-service';
import * as timeMachineService from './time-machine-service';
import * as timelineService from './timeline-service';
import { runCommand } from '../utils/run-command';
import * as blackboardService from './blackboard-service';
import * as tokenBucketService from './token-bucket';
import * as contractNetService from './contract-net';
import {
  getAvailableAgents,
  getPreferredPlanningModel,
  selectModelVariant,
  checkAgentAvailability,
} from './agent-availability';

// --- State ---

type CheckpointDecision = 'continue' | 'pause' | 'revert' | 'stop';

interface ExecutionState {
  plan: ConductorPlan;
  projectPath: string;
  paused: boolean;
  stopped: boolean;
  checkpointDecision: CheckpointDecision | null;
  checkpointResolve: (() => void) | null;
  blackboardIdMap: Map<string, string>;
}

const activeExecutions = new Map<string, ExecutionState>();

const MAX_PARALLEL_TASKS = 3;

// --- Broadcast helpers ---

function broadcast(channel: string, data: unknown): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
}

function broadcastPlan(plan: ConductorPlan): void {
  broadcast('conductor:status-update', { planId: plan.id, plan });
  store.saveConductorPlan(plan.projectId, plan);
}

function broadcastTask(plan: ConductorPlan, station: ConductorStation, task: ConductorTask): void {
  broadcast('conductor:task-update', { planId: plan.id, stationId: station.id, task });
}

function broadcastStream(plan: ConductorPlan, taskId: string, chunk: string): void {
  broadcast('conductor:task-stream', { planId: plan.id, taskId, chunk });
}

// --- Simple concurrency semaphore ---

function createSemaphore(max: number) {
  let running = 0;
  const queue: Array<() => void> = [];

  return async function acquire<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= max) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    running++;
    try {
      return await fn();
    } finally {
      running = Math.max(0, running - 1);
      queue.shift()?.();
    }
  };
}

// --- LLM calling ---

interface LLMChoice {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  isFree?: boolean;
  displayName?: string;
}

async function callLLM(choice: LLMChoice, systemPrompt: string, userMessage: string): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  if (choice.provider === 'github' || choice.provider === 'openai') {
    const baseUrl = choice.baseUrl ?? 'https://api.openai.com/v1';
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${choice.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: choice.model, messages, max_tokens: 4000 }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`LLM error ${response.status}: ${text.slice(0, 300)}`);
    }
    const json = (await response.json()) as { choices: Array<{ message: { content: string } }> };
    return json.choices[0]?.message?.content ?? '';
  }

  if (choice.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': choice.apiKey!,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: choice.model,
        max_tokens: 4000,
        messages: [{ role: 'user', content: userMessage }],
        system: systemPrompt,
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic error ${response.status}: ${text.slice(0, 300)}`);
    }
    const json = (await response.json()) as { content: Array<{ text: string }> };
    return json.content[0]?.text ?? '';
  }

  throw new Error(`Unknown provider: ${choice.provider}`);
}

function extractJSON(text: string): unknown {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim());
}

const DESIGN_KEYWORDS = /\b(ui|ux|design|visual|component|page|layout|style|css|theme|color|button|form|modal|dashboard|landing|hero|card|table|nav|sidebar|header|footer)\b/i;

// --- Availability export ---

export function checkAvailability() {
  return getAvailableAgents();
}

// --- Planning Phase ---

export async function startPlan(opts: {
  projectId: string;
  projectPath: string;
  goal: string;
  controlLevel: ControlLevel;
}): Promise<ConductorPlan> {
  const { projectId, projectPath, goal, controlLevel } = opts;
  const model = getPreferredPlanningModel('balanced');

  broadcast('conductor:availability', {
    projectId,
    availability: getAvailableAgents(),
    planningModel: model.displayName,
  });

  let contextContent = '';
  try {
    contextContent = await fs.readFile(nodePath.join(projectPath, 'CLAUDE.md'), 'utf-8');
  } catch { /* no context file */ }

  const plan: ConductorPlan = {
    id: uuidv4(),
    projectId,
    goal,
    controlLevel,
    questions: [],
    answers: [],
    stations: [],
    status: controlLevel === 'express' ? 'reviewing' : 'answering',
    currentStationIndex: 0,
    currentTaskIndex: 0,
    tokenUsage: { used: 0, estimated: 0, saved: 0 },
    createdAt: new Date().toISOString(),
  };

  store.saveConductorPlan(projectId, plan);

  if (controlLevel !== 'express') {
    const systemPrompt = `You are a senior software architect helping plan a coding project. Generate 3-5 clarifying questions about the user's goal. For each question, provide 3-4 options with plain-English explanations of any technical terms, plus pros and cons for each option. Keep it friendly and accessible to beginners.

Return ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "questions": [
    {
      "id": "q1",
      "text": "How should X work?",
      "options": [
        {
          "id": "a",
          "label": "Simple approach",
          "description": "One sentence plain English explanation",
          "pros": "What's good about this",
          "cons": "What's tricky about this"
        }
      ]
    }
  ]
}`;

    const userMessage = `Project context:\n${contextContent || '(new project)'}\n\nUser goal: ${goal}\n\nGenerate clarifying questions.`;

    try {
      const response = await callLLM(model, systemPrompt, userMessage);
      const parsed = extractJSON(response) as { questions: ConductorQuestion[] };
      plan.questions = parsed.questions || [];
    } catch {
      plan.questions = [];
      plan.status = 'reviewing';
    }
  }

  if (plan.questions && plan.questions.length > 0) {
    plan.status = 'answering';
  } else {
    const generatedPlan = await generatePlan({ plan, contextContent, model });
    plan.stations = generatedPlan.stations;
    plan.tokenUsage = generatedPlan.tokenUsage;
    plan.status = 'reviewing';
  }

  broadcastPlan(plan);
  return plan;
}

export async function submitAnswers(opts: {
  planId: string;
  projectId: string;
  answers: ConductorAnswer[];
}): Promise<ConductorPlan> {
  const { projectId, answers } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  plan.answers = answers;
  plan.status = 'reviewing';

  const project = store.getProjectById(projectId);
  let contextContent = '';
  try {
    contextContent = await fs.readFile(nodePath.join(project?.path ?? '', 'CLAUDE.md'), 'utf-8');
  } catch { /* no context */ }

  const model = getPreferredPlanningModel('balanced');
  const generatedPlan = await generatePlan({ plan, contextContent, model });
  plan.stations = generatedPlan.stations;
  plan.tokenUsage = generatedPlan.tokenUsage;

  broadcastPlan(plan);
  return plan;
}

interface GeneratedPlan {
  stations: ConductorStation[];
  tokenUsage: { used: number; estimated: number; saved: number };
}

async function generatePlan(opts: {
  plan: ConductorPlan;
  contextContent: string;
  model: LLMChoice;
}): Promise<GeneratedPlan> {
  const { plan, contextContent, model } = opts;

  // Get available agents to restrict assignments to available ones
  const available = getAvailableAgents();
  const availableAgents = available.filter((a) => a.available).map((a) => a.agent);
  const freeAgents = available.filter((a) => a.available && a.isFree).map((a) => a.agent);

  const agentSummary = available
    .map((a) => `- ${a.agent}: ${a.available ? (a.isFree ? 'AVAILABLE (free)' : 'AVAILABLE (paid)') : `UNAVAILABLE: ${a.reason}`}`)
    .join('\n');

  const answersText = (plan.answers ?? [])
    .map((a) => {
      const q = plan.questions?.find((q) => q.id === a.questionId);
      const opt = q?.options.find((o) => o.id === a.optionId);
      return `- ${q?.text ?? a.questionId}: ${opt?.label ?? a.optionId}`;
    })
    .join('\n');

  const systemPrompt = `You are a senior software architect. Create a detailed implementation plan broken into stations (phases) and tasks.

ONLY assign tasks to agents that are AVAILABLE. Available agents:
${agentSummary}

If a preferred agent is unavailable, assign to the next best available one.
Prefer free agents when task complexity allows.

Task complexity rules:
- "hard": architecture decisions, complex algorithms, security-sensitive code → best available model
- "medium": components, API routes, database queries → balanced model
- "easy": config, boilerplate, docs, simple scripts → cheapest model

Return ONLY valid JSON:
{
  "stations": [
    {
      "id": "s1",
      "name": "Station name",
      "estimatedMinutes": 10,
      "hasCheckpoint": true,
      "tasks": [
        {
          "id": "t1",
          "description": "What to do",
          "assignedAgent": "claude",
          "complexity": "medium",
          "prompt": "Detailed prompt for the agent including exactly what files to create/modify and what the output should be"
        }
      ]
    }
  ]
}

Rules:
- 2-5 stations, 2-5 tasks per station
- Last station should always run ghost tests
- Add checkpoints after stations 1 and 2, and before final station
- Prompts must be detailed enough for an AI to execute without further questions
- Tasks within a station will run IN PARALLEL — ensure they are independent of each other`;

  const userMessage = [
    `Project context:\n${contextContent || '(new project)'}`,
    `User goal: ${plan.goal}`,
    answersText ? `User choices:\n${answersText}` : '',
    `Available agents (ONLY assign to these): ${availableAgents.join(', ') || 'none — cannot proceed'}`,
    `Create a detailed implementation plan.`,
  ].filter(Boolean).join('\n\n');

  if (availableAgents.length === 0) {
    throw new Error('No agents available. Install and authenticate at least one agent (Claude Code, Gemini CLI, etc.) to use Conductor Mode.');
  }

  const response = await callLLM(model, systemPrompt, userMessage);
  const parsed = extractJSON(response) as { stations: Array<{
    id: string; name: string; estimatedMinutes?: number; hasCheckpoint?: boolean;
    tasks: Array<{ id: string; description: string; assignedAgent: string; complexity?: string; prompt: string }>;
  }> };

  const stations: ConductorStation[] = (parsed.stations ?? []).map((s) => ({
    id: s.id || uuidv4(),
    name: s.name,
    estimatedMinutes: s.estimatedMinutes,
    hasCheckpoint: s.hasCheckpoint ?? false,
    tasks: (s.tasks ?? []).map((t) => {
      const agent = availableAgents.includes(t.assignedAgent as AgentType)
        ? (t.assignedAgent as AgentType)
        : (availableAgents[0] as AgentType ?? 'claude');
      const complexity = (['easy', 'medium', 'hard'].includes(t.complexity ?? ''))
        ? (t.complexity as TaskComplexity)
        : 'medium';
      const modelVariant = selectModelVariant(complexity, agent);
      return {
        id: t.id || uuidv4(),
        description: t.description,
        assignedAgent: agent,
        complexity,
        modelVariant,
        prompt: t.prompt,
        status: 'pending' as const,
      };
    }),
    status: 'pending' as const,
  }));

  // Tag design stations
  for (const station of stations) {
    const stationText = [station.name, ...station.tasks.map((t) => t.description)].join(' ');
    if (DESIGN_KEYWORDS.test(stationText)) {
      station.isDesignStation = true;
    }
  }

  const taskCount = stations.reduce((sum, s) => sum + s.tasks.length, 0);
  const estimatedTokens = taskCount * 3000;
  const estimatedCost = fuelService.estimateCost(model.model, estimatedTokens, estimatedTokens).cost;

  return {
    stations,
    tokenUsage: { used: 0, estimated: estimatedCost, saved: 0 },
  };
}

// --- Mockup Generation (Extension 1) ---

export async function generateMockups(opts: { planId: string; projectId: string }): Promise<ConductorPlan> {
  const { projectId } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  const model = getPreferredPlanningModel('balanced');

  for (const station of plan.stations) {
    if (!station.isDesignStation) continue;

    const taskDescriptions = station.tasks.map((t) => t.description).join(', ');

    const systemPrompt = `You are a UI/UX expert. Generate 3 distinct design variants for the user to choose from. Each variant must be a complete, self-contained HTML document with inline CSS. Make the designs visually distinct from each other but all solve the same design problem. Use a dark background (#1a1714) as base. Keep designs compact (fits in 200px height preview).

Return ONLY valid JSON:
{
  "designDecision": "Brief description of the design choice",
  "variants": [
    {
      "id": "v1",
      "label": "Minimal",
      "description": "One sentence description",
      "htmlSpec": "<!DOCTYPE html><html>...</html>"
    }
  ]
}`;

    const userMessage = `Design task: ${taskDescriptions}\nGoal: ${plan.goal}\n\nGenerate 3 visual variants.`;

    try {
      const response = await callLLM(model, systemPrompt, userMessage);
      const parsed = extractJSON(response) as {
        designDecision: string;
        variants: Array<{ id: string; label: string; description: string; htmlSpec: string }>;
      };
      station.mockupSpec = {
        designDecision: parsed.designDecision,
        variants: parsed.variants ?? [],
        selectedVariantId: parsed.variants?.[0]?.id,
      };
    } catch {
      // Non-fatal: skip mockup for this station
    }
  }

  plan.status = 'mockup';
  broadcastPlan(plan);
  return plan;
}

export function selectMockup(opts: { planId: string; projectId: string; stationId: string; variantId: string }): ConductorPlan {
  const { projectId, stationId, variantId } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  const station = plan.stations.find((s) => s.id === stationId);
  if (station?.mockupSpec) {
    station.mockupSpec.selectedVariantId = variantId;
    const variant = station.mockupSpec.variants.find((v) => v.id === variantId);
    if (variant) {
      for (const task of station.tasks) {
        task.prompt = `Design choice: "${variant.label}" — ${variant.description}\n\n${task.prompt}`;
      }
    }
  }

  store.saveConductorPlan(projectId, plan);
  return plan;
}

// --- Learning Mode (Extension 3) ---

export async function setLearningMode(opts: { planId: string; projectId: string; enabled: boolean }): Promise<ConductorPlan> {
  const { projectId, enabled } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  plan.learningEnabled = enabled;
  store.saveConductorPlan(projectId, plan);
  return plan;
}

async function generateLearningAnnotation(task: ConductorTask, model: LLMChoice): Promise<string> {
  const systemPrompt = `You are a friendly coding tutor. Explain what just happened in 2-3 plain English sentences. Focus on what the user learned, not technical jargon. Write as if explaining to someone new to programming.`;
  const userMessage = `Task completed: "${task.description}"\nOutput snippet: ${(task.output ?? '').slice(0, 500)}`;
  try {
    const text = await callLLM(model, systemPrompt, userMessage);
    return text.trim().slice(0, 400);
  } catch {
    return `The Conductor completed: ${task.description}`;
  }
}

async function saveLearningSession(projectPath: string, plan: ConductorPlan): Promise<void> {
  if (!plan.learningEnabled || !plan.learningAnnotations) return;
  try {
    const dir = nodePath.join(projectPath, '.caboo', 'learning');
    await fs.mkdir(dir, { recursive: true });
    const date = new Date().toISOString().split('T')[0];
    const lines = [
      `# Learning Session — ${date}`,
      `Goal: ${plan.goal}`,
      '',
      ...Object.entries(plan.learningAnnotations).map(([taskId, annotation]) => {
        const task = plan.stations.flatMap((s) => s.tasks).find((t) => t.id === taskId);
        return `## ${task?.description ?? taskId}\n${annotation}\n`;
      }),
    ];
    await fs.writeFile(nodePath.join(dir, `session-${date}.md`), lines.join('\n'), 'utf-8');
  } catch { /* non-fatal */ }
}

// --- Task Reordering & Reassignment ---

export function reorderTasks(opts: { projectId: string; stationId: string; taskIds: string[] }): ConductorPlan {
  const { projectId, stationId, taskIds } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  const station = plan.stations.find((s) => s.id === stationId);
  if (!station) throw new Error('Station not found');

  const taskMap = new Map(station.tasks.map((t) => [t.id, t]));
  station.tasks = taskIds.map((id) => taskMap.get(id)!).filter(Boolean);

  broadcastPlan(plan);
  return plan;
}

export function reassignTask(opts: { projectId: string; taskId: string; agentType: AgentType }): ConductorPlan {
  const { projectId, taskId, agentType } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  for (const station of plan.stations) {
    const task = station.tasks.find((t) => t.id === taskId);
    if (task) {
      const avail = checkAgentAvailability(agentType);
      if (!avail.available) {
        broadcast('conductor:agent-unavailable', {
          planId: plan.id,
          taskId,
          agent: agentType,
          reason: avail.reason,
        });
      }
      task.assignedAgent = agentType;
      task.modelVariant = task.complexity ? selectModelVariant(task.complexity, agentType) : undefined;
      break;
    }
  }

  broadcastPlan(plan);
  return plan;
}

// --- Agent execution with availability + fallback ---

async function resolveExecutorAgent(
  agentType: AgentType,
  planId: string,
): Promise<AgentType> {
  const avail = checkAgentAvailability(agentType);
  if (avail.available) return agentType;

  // Notify renderer of the downshift
  broadcast('conductor:agent-unavailable', {
    planId,
    agent: agentType,
    reason: avail.reason,
    fallback: null,
  });

  // Find best available fallback
  const allAvail = getAvailableAgents();
  const fallbacks: AgentType[] = ['claude', 'gemini', 'codex', 'copilot', 'ollama'];
  for (const fallback of fallbacks) {
    if (fallback !== agentType && allAvail.find((a) => a.agent === fallback && a.available)) {
      broadcast('conductor:agent-downshifted', {
        planId,
        from: agentType,
        to: fallback,
        reason: avail.reason ?? 'Agent unavailable',
      });
      return fallback;
    }
  }

  // No available agents — return original and let it fail gracefully
  return agentType;
}

async function runAgentNonInteractive(opts: {
  agentType: AgentType;
  projectPath: string;
  prompt: string;
  plan: ConductorPlan;
  taskId: string;
}): Promise<{ output: string; filesChanged: string[] }> {
  const { agentType, projectPath, prompt, plan, taskId } = opts;
  const config = AGENTS[agentType];

  // --- Copilot: uses 'gh copilot suggest' ---
  if (agentType === 'copilot') {
    try {
      const safePrompt = prompt.slice(0, 500).replace(/"/g, '\\"');
      const output = await runCommand(
        `gh copilot suggest -t shell "${safePrompt}" 2>&1 || true`,
        { cwd: projectPath, timeout: 30000 },
      );
      return { output: output || '(Copilot: no suggestion produced)', filesChanged: [] };
    } catch (err) {
      return {
        output: `GitHub Copilot failed: ${err instanceof Error ? err.message : String(err)}. For complex coding tasks, consider using Claude or Gemini instead.`,
        filesChanged: [],
      };
    }
  }

  // --- Ollama: use ollama run ---
  if (agentType === 'ollama') {
    try {
      const modelList = await runCommand('ollama list 2>/dev/null | tail -n +2 | head -1 | awk \'{print $1}\'', { timeout: 5000 });
      const ollamaModel = modelList.trim() || 'codellama';
      const safePrompt = prompt.slice(0, 2000).replace(/'/g, "'\\''");
      const output = await runCommand(
        `ollama run ${ollamaModel} '${safePrompt}' 2>&1`,
        { cwd: projectPath, timeout: 120000 },
      );
      return { output: output.slice(0, 10000), filesChanged: [] };
    } catch (err) {
      return { output: `Ollama failed: ${err instanceof Error ? err.message : String(err)}`, filesChanged: [] };
    }
  }

  // --- Standard agents (claude, gemini, codex) ---
  let agentBin = config.command;
  try {
    const resolved = await runCommand(`which ${config.command}`, { timeout: 5000 });
    if (resolved) agentBin = resolved;
  } catch {
    // Also try ~/.npm-global/bin
    const npmGlobalBin = `${process.env.HOME ?? '~'}/.npm-global/bin/${config.command}`;
    try {
      await runCommand(`test -x "${npmGlobalBin}"`, { timeout: 2000 });
      agentBin = npmGlobalBin;
    } catch { /* use default */ }
  }

  const args = agentType === 'codex' ? [prompt] : ['-p', prompt];

  const output = await new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    const proc = spawn(agentBin, args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const onData = (d: Buffer) => {
      const chunk = d.toString();
      chunks.push(chunk);
      broadcastStream(plan, taskId, chunk);
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Agent timed out after 5 minutes`));
    }, 5 * 60 * 1000);

    proc.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0 || chunks.length > 0) {
        resolve(chunks.join(''));
      } else {
        reject(new Error(`Agent exited with code ${code}`));
      }
    });
    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Get changed files
  let filesChanged: string[] = [];
  try {
    await runCommand('git add -A', { cwd: projectPath, timeout: 5000 });
    const statusOut = await runCommand('git diff --name-only --cached', { cwd: projectPath, timeout: 5000 });
    filesChanged = statusOut.split('\n').filter(Boolean);

    if (filesChanged.length > 0) {
      await runCommand('git commit -m "[conductor] task complete"', { cwd: projectPath, timeout: 10000 });
    }
  } catch { /* git might not be set up */ }

  return { output: output.slice(0, 10000), filesChanged };
}

// --- Single task execution (extracted for parallel use) ---

async function executeSingleTask(
  state: ExecutionState,
  station: ConductorStation,
  task: ConductorTask,
): Promise<void> {
  const { plan, projectPath } = state;

  // Budget check
  const budgetEnforcement = tokenBucketService.getBudgetEnforcement();
  if (budgetEnforcement.shouldBlock || tokenBucketService.isMonthlyCapExceeded()) {
    task.status = 'failed';
    task.error = 'Budget limit reached. All paid API usage is blocked until the daily budget resets.';
    broadcastTask(plan, station, task);
    broadcast('conductor:budget-exceeded', {
      planId: plan.id,
      percentUsed: budgetEnforcement.percentUsed,
      at100Action: budgetEnforcement.at100Action,
    });
    state.paused = true;
    plan.status = 'paused';
    broadcastPlan(plan);
    while (state.paused && !state.stopped) await sleep(500);
    if (state.stopped) return;
    const recheckEnforcement = tokenBucketService.getBudgetEnforcement();
    if (recheckEnforcement.shouldBlock) return;
  }

  // Downshift to free agent if budget is tight
  if (budgetEnforcement.shouldDownshift && task.assignedAgent !== 'ollama') {
    const freeAlternative = findFreeAlternative(task.assignedAgent);
    if (freeAlternative) {
      broadcast('conductor:agent-downshifted', {
        planId: plan.id,
        taskId: task.id,
        from: task.assignedAgent,
        to: freeAlternative,
        reason: 'budget-threshold',
      });
      task.assignedAgent = freeAlternative;
      task.modelVariant = task.complexity ? selectModelVariant(task.complexity, freeAlternative) : undefined;
    }
  }

  // Availability check — swap to best available if current agent is down
  const resolvedAgent = await resolveExecutorAgent(task.assignedAgent, plan.id);
  if (resolvedAgent !== task.assignedAgent) {
    task.assignedAgent = resolvedAgent;
    task.modelVariant = task.complexity ? selectModelVariant(task.complexity, resolvedAgent) : undefined;
  }

  task.status = 'running';
  task.liveOutput = '';
  broadcastTask(plan, station, task);
  broadcastPlan(plan);

  // Sync to blackboard
  const bbTaskId = state.blackboardIdMap.get(task.id);
  if (bbTaskId) {
    blackboardService.claimTask(projectPath, bbTaskId, task.assignedAgent).catch(() => {});
    blackboardService.updateTaskStatus(projectPath, bbTaskId, 'in-progress').catch(() => {});
    blackboardService.sendMessage(projectPath, {
      from: 'conductor',
      to: task.assignedAgent,
      type: 'system',
      subject: `Task assigned: ${task.description.slice(0, 60)}`,
      body: `You have been assigned blackboard task ${bbTaskId}.`,
    }).catch(() => {});
  }

  const startTime = Date.now();
  let success = false;
  let retryCount = 0;

  while (!success && retryCount < 2 && !state.stopped) {
    try {
      const result = await runAgentNonInteractive({
        agentType: task.assignedAgent,
        projectPath,
        prompt: buildTaskPrompt(plan, station, task),
        plan,
        taskId: task.id,
      });

      task.status = 'completed';
      task.duration = Date.now() - startTime;
      task.filesChanged = result.filesChanged;
      task.output = result.output;
      task.liveOutput = undefined;
      success = true;

      if (bbTaskId) {
        blackboardService.completeTask(projectPath, bbTaskId, [], result.filesChanged).catch(() => {});
        if (result.output.length > 100) {
          blackboardService.postArtifact(projectPath, `${task.id}-output.txt`, result.output).catch(() => {});
        }
      }

      const tokensOut = Math.ceil(result.output.length / 4);
      const tokensIn = Math.ceil(task.prompt.length / 4);
      const fuelEntry = fuelService.recordUsage({
        provider: task.assignedAgent,
        model: task.modelVariant ?? task.assignedAgent,
        tokensIn,
        tokensOut,
        projectId: plan.projectId,
        taskType: 'conductor-task',
      });
      plan.tokenUsage.used += fuelEntry.cost;
      plan.tokenUsage.saved += fuelEntry.savedAmount;

    } catch (err) {
      retryCount++;
      if (retryCount < 2) {
        task.prompt = `[Retry attempt ${retryCount}] ${task.prompt}`;
        await sleep(2000);
      } else {
        task.status = 'failed';
        task.error = err instanceof Error ? err.message : String(err);
        task.liveOutput = undefined;

        if (bbTaskId) {
          blackboardService.failTask(projectPath, bbTaskId, task.error ?? 'unknown error').catch(() => {});
        }

        // Express mode: auto-fallback to another available agent
        if (plan.controlLevel === 'express') {
          const fallbackAgent = await resolveExecutorAgent(getFallbackAgent(task.assignedAgent) ?? 'ollama', plan.id);
          if (fallbackAgent && fallbackAgent !== task.assignedAgent) {
            task.assignedAgent = fallbackAgent;
            task.modelVariant = task.complexity ? selectModelVariant(task.complexity, fallbackAgent) : undefined;
            task.status = 'running';
            broadcastTask(plan, station, task);
            try {
              const result = await runAgentNonInteractive({
                agentType: task.assignedAgent,
                projectPath,
                prompt: buildTaskPrompt(plan, station, task),
                plan,
                taskId: task.id,
              });
              task.status = 'completed';
              task.duration = Date.now() - startTime;
              task.filesChanged = result.filesChanged;
              task.output = result.output;
              task.liveOutput = undefined;
              success = true;
            } catch {
              task.status = 'failed';
            }
          }
        }
      }
    }
  }

  broadcastTask(plan, station, task);

  // Learning annotation (non-blocking)
  if (plan.learningEnabled && task.status === 'completed') {
    const planningModel = getPreferredPlanningModel('cheap');
    generateLearningAnnotation(task, planningModel).then((annotation) => {
      if (!plan.learningAnnotations) plan.learningAnnotations = {};
      plan.learningAnnotations[task.id] = annotation;
      store.saveConductorPlan(plan.projectId, plan);
      broadcastPlan(plan);
    }).catch(() => {});
  }

  // In Guided/Full Control: pause on task failure
  if (task.status === 'failed' && plan.controlLevel !== 'express') {
    state.paused = true;
    broadcast('conductor:task-failed', { planId: plan.id, task, message: task.error });
    while (state.paused && !state.stopped) await sleep(500);
  }

  broadcastPlan(plan);
}

// --- Execution Engine ---

export async function startExecution(opts: {
  planId: string;
  projectId: string;
  projectPath: string;
}): Promise<void> {
  const { projectId, projectPath } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  // Broadcast current availability before starting
  broadcast('conductor:availability', {
    projectId,
    availability: getAvailableAgents(),
  });

  plan.status = 'executing';
  broadcastPlan(plan);

  timelineService.addEvent(projectId, {
    type: 'conductor-start',
    description: `Conductor started: "${plan.goal}"`,
    details: {},
  });

  const state: ExecutionState = {
    plan,
    projectPath,
    paused: false,
    stopped: false,
    checkpointDecision: null,
    checkpointResolve: null,
    blackboardIdMap: new Map(),
  };
  activeExecutions.set(plan.id, state);

  // Sync plan tasks to blackboard
  try {
    const allTasks = plan.stations.flatMap((station) =>
      station.tasks.map((task) => ({
        taskId: task.id,
        title: task.description,
        description: task.prompt,
        agent: task.assignedAgent,
        stationId: station.id,
        stationName: station.name,
        estimatedMinutes: station.estimatedMinutes,
        dependencies: [] as string[],
      })),
    );
    const idMap = await blackboardService.syncPlanToBlackboard(projectPath, allTasks);
    for (const [k, v] of idMap) state.blackboardIdMap.set(k, v);
  } catch (err) {
    console.warn('[conductor] Could not sync to blackboard:', err);
  }

  executeAll(state).catch((err) => {
    plan.status = 'failed';
    broadcastPlan(plan);
    console.error('[conductor] Execution failed:', err);
  });
}

async function executeAll(state: ExecutionState): Promise<void> {
  const { plan, projectPath } = state;

  for (let si = plan.currentStationIndex; si < plan.stations.length; si++) {
    if (state.stopped) break;

    const station = plan.stations[si];
    plan.currentStationIndex = si;
    station.status = 'active';

    // Snapshot before station
    try {
      const snap = await timeMachineService.createSnapshot({
        projectId: plan.projectId,
        projectPath,
        label: `Before: ${station.name}`,
        trigger: 'conductor',
      });
      station.startSnapshotId = snap.id;
    } catch { /* ignore */ }

    broadcastPlan(plan);

    // ── Parallel task execution within station ──────────────────────────────
    const userMax = store.getPreferences()?.conductorMaxParallel ?? MAX_PARALLEL_TASKS;
    const concurrency = Math.max(1, Math.min(userMax, MAX_PARALLEL_TASKS));
    const semaphore = createSemaphore(concurrency);

    await Promise.all(
      station.tasks.map((task) =>
        semaphore(async () => {
          if (state.stopped) return;
          // Wait if globally paused
          while (state.paused && !state.stopped) await sleep(300);
          if (state.stopped) return;
          await executeSingleTask(state, station, task);
        }),
      ),
    );

    if (state.stopped) break;

    station.status = station.tasks.every((t) => t.status !== 'failed') ? 'completed' : 'failed';

    // Snapshot after station
    try {
      await timeMachineService.createSnapshot({
        projectId: plan.projectId,
        projectPath,
        label: `After: ${station.name}`,
        trigger: 'conductor',
        agentType: station.tasks[0]?.assignedAgent,
      });
    } catch { /* ignore */ }

    broadcastPlan(plan);

    timelineService.addEvent(plan.projectId, {
      type: 'conductor-station',
      description: `Station complete: ${station.name}`,
      details: {
        filesChanged: station.tasks.flatMap((t) => t.filesChanged ?? []),
      },
    });

    // Checkpoint pause
    if (station.hasCheckpoint && !state.stopped) {
      plan.status = 'checkpoint';
      broadcastPlan(plan);

      await new Promise<void>((resolve) => {
        state.checkpointResolve = resolve;
        if (plan.controlLevel === 'express') {
          setTimeout(() => {
            if (!state.checkpointDecision) state.checkpointDecision = 'continue';
            resolve();
          }, 5000);
        }
      });

      const decision = state.checkpointDecision ?? 'continue';
      state.checkpointDecision = null;
      state.checkpointResolve = null;

      if (decision === 'stop') { state.stopped = true; break; }

      if (decision === 'revert') {
        if (station.startSnapshotId) {
          try {
            await timeMachineService.revertToSnapshot({
              projectId: plan.projectId,
              projectPath,
              snapshotId: station.startSnapshotId,
            });
          } catch { /* ignore */ }
        }
        station.status = 'pending';
        for (const task of station.tasks) {
          task.status = 'pending';
          task.output = undefined;
          task.error = undefined;
          task.liveOutput = undefined;
          task.filesChanged = undefined;
        }
        si--;
        broadcastPlan(plan);
        continue;
      }

      if (decision === 'pause') {
        state.paused = true;
        plan.status = 'paused';
        broadcastPlan(plan);
        while (state.paused && !state.stopped) await sleep(500);
        if (state.stopped) break;
      }

      plan.status = 'executing';
      broadcastPlan(plan);
    }
  }

  if (!state.stopped) {
    plan.status = 'completed';
    plan.completedAt = new Date().toISOString();

    await saveLearningSession(projectPath, plan);

    try {
      await timeMachineService.createSnapshot({
        projectId: plan.projectId,
        projectPath,
        label: `Conductor complete: ${plan.goal}`,
        trigger: 'conductor',
      });
    } catch { /* ignore */ }

    try {
      await runCommand(`cd "${projectPath}" && git add -A && git commit -m "Conductor: ${plan.goal.replace(/"/g, '\\"')}" --allow-empty`, { timeout: 10000 });
    } catch { /* ignore */ }

    timelineService.addEvent(plan.projectId, {
      type: 'conductor-complete',
      description: `Conductor complete: "${plan.goal}"`,
      details: {
        filesChanged: plan.stations.flatMap((s) => s.tasks.flatMap((t) => t.filesChanged ?? [])),
        duration: Date.now() - new Date(plan.createdAt).getTime(),
      },
    });
  } else {
    plan.status = 'failed';
  }

  broadcastPlan(plan);
  activeExecutions.delete(plan.id);
}

function buildTaskPrompt(plan: ConductorPlan, station: ConductorStation, task: ConductorTask): string {
  const completedTasks = station.tasks
    .filter((t) => t.status === 'completed' && t.id !== task.id)
    .map((t) => `- ${t.description}: DONE`)
    .join('\n');

  const modelNote = task.modelVariant ? `[Running on: ${task.modelVariant}]` : '';

  return [
    `You are working on: "${plan.goal}"`,
    `Current station: ${station.name}`,
    modelNote,
    completedTasks ? `Completed in this station:\n${completedTasks}` : '',
    `Your task: ${task.description}`,
    ``,
    task.prompt,
    ``,
    `After completing the task, briefly summarize what you did and what files you changed.`,
  ].filter(Boolean).join('\n');
}

function getFallbackAgent(agentType: AgentType): AgentType | null {
  const fallbacks: Record<AgentType, AgentType | null> = {
    claude: 'gemini',
    gemini: 'claude',
    codex: 'claude',
    copilot: 'claude',
    ollama: null,
  };
  return fallbacks[agentType];
}

function findFreeAlternative(agentType: AgentType): AgentType | null {
  if (agentType === 'ollama') return null;
  return 'ollama';
}

// --- Contract Net Protocol integration ---

export async function requestBidsForPlan(projectId: string): Promise<import('../../shared/types').BidRound[]> {
  const plan = store.getConductorPlan(projectId);
  if (!plan) return [];

  // Only bid with available agents
  const allAvail = getAvailableAgents();
  const availableAgentTypes: AgentType[] = allAvail
    .filter((a) => a.available)
    .map((a) => a.agent);

  const pendingTasks = plan.stations.flatMap((s) => s.tasks).filter((t) => t.status === 'pending');
  if (pendingTasks.length === 0 || availableAgentTypes.length === 0) return [];

  const rounds = await contractNetService.runBidRounds(
    projectId,
    pendingTasks.map((t) => ({ id: t.id, description: t.description, prompt: t.prompt })),
    availableAgentTypes,
  );

  broadcast('conductor:bid-results', { projectId, rounds });
  return rounds;
}

export function applyBidAward(projectId: string, taskId: string, agent: AgentType): ConductorPlan | null {
  return reassignTask({ projectId, taskId, agentType: agent });
}

// --- Control Methods ---

export function pausePlan(planId: string): void {
  const state = activeExecutions.get(planId);
  if (state) {
    state.paused = true;
    state.plan.status = 'paused';
    broadcastPlan(state.plan);
  }
}

export function resumePlan(planId: string): void {
  const state = activeExecutions.get(planId);
  if (state) {
    state.paused = false;
    state.plan.status = 'executing';
    broadcastPlan(state.plan);
  }
}

export function skipTask(planId: string): void {
  const state = activeExecutions.get(planId);
  if (!state) return;
  const { plan } = state;
  const station = plan.stations[plan.currentStationIndex];
  if (station) {
    // Skip all currently running tasks
    for (const task of station.tasks) {
      if (task.status === 'running' || task.status === 'pending') {
        task.status = 'skipped';
        broadcastTask(plan, station, task);
      }
    }
  }
  state.paused = false;
}

export function stopPlan(planId: string): void {
  const state = activeExecutions.get(planId);
  if (state) {
    state.stopped = true;
    state.paused = false;
    state.plan.status = 'failed';
    broadcastPlan(state.plan);
  }
}

export function resolveCheckpoint(planId: string, decision: CheckpointDecision): void {
  const state = activeExecutions.get(planId);
  if (!state) return;
  state.checkpointDecision = decision;
  if (state.checkpointResolve) state.checkpointResolve();
}

export function getPlan(projectId: string): ConductorPlan | null {
  return store.getConductorPlan(projectId);
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
