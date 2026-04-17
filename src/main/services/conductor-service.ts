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
} from '../../shared/types';
import { AGENTS } from '../../shared/types';
import * as store from '../store';
import * as fuelService from './fuel-service';
import * as timeMachineService from './time-machine-service';
import * as timelineService from './timeline-service';
import { runCommand, runExecFile } from '../utils/run-command';
import * as blackboardService from './blackboard-service';
import * as tokenBucketService from './token-bucket';
import * as contractNetService from './contract-net';

// --- State ---

type CheckpointDecision = 'continue' | 'pause' | 'revert' | 'stop';

interface ExecutionState {
  plan: ConductorPlan;
  projectPath: string;
  paused: boolean;
  stopped: boolean;
  checkpointDecision: CheckpointDecision | null;
  checkpointResolve: (() => void) | null;
  /** Maps ConductorTask.id → blackboard task id for live sync */
  blackboardIdMap: Map<string, string>;
}

const activeExecutions = new Map<string, ExecutionState>();

// --- Broadcast helpers ---

function broadcast(channel: string, data: unknown): void {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data);
    }
  }
}

function broadcastPlan(plan: ConductorPlan): void {
  broadcast('conductor:status-update', { planId: plan.id, plan });
  store.saveConductorPlan(plan.projectId, plan);
}

function broadcastTask(plan: ConductorPlan, station: ConductorStation, task: ConductorTask): void {
  broadcast('conductor:task-update', { planId: plan.id, stationId: station.id, task });
}

// --- Model selection for planning ---

function getApiKey(providerId: string): string | null {
  return store.getApiKey(providerId);
}

interface LLMChoice {
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

function selectPlanningModel(): LLMChoice {
  // Priority: GitHub Models (free) → Claude Sonnet → GPT-4o
  const githubToken = (() => {
    try {
      return execSync('gh auth token', { timeout: 5000 }).toString().trim();
    } catch { return null; }
  })();

  if (githubToken) {
    return {
      provider: 'github',
      model: 'gpt-4o',
      baseUrl: 'https://models.inference.ai.azure.com',
      apiKey: githubToken,
    };
  }

  const anthropicKey = getApiKey('anthropic');
  if (anthropicKey) {
    return { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: anthropicKey };
  }

  const openaiKey = getApiKey('openai');
  if (openaiKey) {
    return { provider: 'openai', model: 'gpt-4o', apiKey: openaiKey };
  }

  throw new Error('No AI provider connected. Please connect GitHub, Claude, or OpenAI in Settings → Fuel to use Conductor Mode.');
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
      headers: {
        Authorization: `Bearer ${choice.apiKey}`,
        'Content-Type': 'application/json',
      },
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
  // Try to extract JSON from markdown code blocks or raw JSON
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = match ? match[1] : text;
  return JSON.parse(raw.trim());
}

// --- Planning Phase ---

export async function startPlan(opts: {
  projectId: string;
  projectPath: string;
  goal: string;
  controlLevel: ControlLevel;
}): Promise<ConductorPlan> {
  const { projectId, projectPath, goal, controlLevel } = opts;
  const model = selectPlanningModel();

  // Read project context
  let contextContent = '';
  try {
    const contextPath = nodePath.join(projectPath, 'CLAUDE.md');
    contextContent = await fs.readFile(contextPath, 'utf-8');
  } catch {
    // No context file yet
  }

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
    // Generate clarifying questions
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
    } catch (err) {
      // If Q&A fails, skip to plan generation
      plan.questions = [];
      plan.status = 'reviewing';
    }
  }

  if (plan.questions && plan.questions.length > 0) {
    plan.status = 'answering';
  } else {
    // Auto-generate the plan without answers
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
    const contextPath = nodePath.join(project?.path ?? '', 'CLAUDE.md');
    contextContent = await fs.readFile(contextPath, 'utf-8');
  } catch {
    // no context
  }

  const model = selectPlanningModel();
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

  // Format answers for context
  const answersText = (plan.answers ?? [])
    .map((a) => {
      const q = plan.questions?.find((q) => q.id === a.questionId);
      const opt = q?.options.find((o) => o.id === a.optionId);
      return `- ${q?.text ?? a.questionId}: ${opt?.label ?? a.optionId}`;
    })
    .join('\n');

  const systemPrompt = `You are a senior software architect. Create a detailed implementation plan broken into stations (phases) and tasks. Each task should be assigned to the most appropriate AI agent.

Available agents: claude (complex logic, architecture), gemini (UI components, frontend), codex (tests, boilerplate), copilot (docs, simple scripts).

Return ONLY valid JSON in this exact format:
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
- Agent prompts should reference the CLAUDE.md / GEMINI.md context file`;

  const userMessage = [
    `Project context:\n${contextContent || '(new project)'}`,
    `User goal: ${plan.goal}`,
    answersText ? `User choices:\n${answersText}` : '',
    `Create a detailed implementation plan.`,
  ].filter(Boolean).join('\n\n');

  const response = await callLLM(model, systemPrompt, userMessage);
  const parsed = extractJSON(response) as { stations: Array<{
    id: string; name: string; estimatedMinutes?: number; hasCheckpoint?: boolean;
    tasks: Array<{ id: string; description: string; assignedAgent: string; prompt: string }>;
  }> };

  const stations: ConductorStation[] = (parsed.stations ?? []).map((s) => ({
    id: s.id || uuidv4(),
    name: s.name,
    estimatedMinutes: s.estimatedMinutes,
    hasCheckpoint: s.hasCheckpoint ?? false,
    tasks: (s.tasks ?? []).map((t) => ({
      id: t.id || uuidv4(),
      description: t.description,
      assignedAgent: (t.assignedAgent as AgentType) || 'claude',
      prompt: t.prompt,
      status: 'pending' as const,
    })),
    status: 'pending' as const,
  }));

  // Estimate token usage (rough: 1000 tokens per task * 3 for avg interaction)
  const taskCount = stations.reduce((sum, s) => sum + s.tasks.length, 0);
  const estimatedTokens = taskCount * 3000;
  const estimatedCost = fuelService.estimateCost(model.model, estimatedTokens, estimatedTokens).cost;

  return {
    stations,
    tokenUsage: { used: 0, estimated: estimatedCost, saved: 0 },
  };
}

// --- Task Reordering & Reassignment ---

export function reorderTasks(opts: {
  projectId: string;
  stationId: string;
  taskIds: string[];
}): ConductorPlan {
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

export function reassignTask(opts: {
  projectId: string;
  taskId: string;
  agentType: AgentType;
}): ConductorPlan {
  const { projectId, taskId, agentType } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  for (const station of plan.stations) {
    const task = station.tasks.find((t) => t.id === taskId);
    if (task) {
      task.assignedAgent = agentType;
      break;
    }
  }

  broadcastPlan(plan);
  return plan;
}

// --- Execution Engine ---

async function runAgentNonInteractive(opts: {
  agentType: AgentType;
  projectPath: string;
  prompt: string;
}): Promise<{ output: string; filesChanged: string[] }> {
  const { agentType, projectPath, prompt } = opts;
  const config = AGENTS[agentType];

  // Get changed files before (unused but kept for potential future diffing)
  try {
    await runExecFile('git', ['diff', '--name-only', 'HEAD'], { cwd: projectPath, timeout: 5000 });
  } catch { /* ignore */ }

  // Resolve the agent binary
  let agentBin = config.command;
  try {
    agentBin = await runCommand(`which ${config.command}`, { timeout: 5000 });
  } catch { /* use default */ }

  const args = agentType === 'codex' ? [prompt] : ['-p', prompt];

  const output = await new Promise<string>((resolve, reject) => {
    const chunks: string[] = [];
    const proc = spawn(agentBin, args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    proc.stdout?.on('data', (d: Buffer) => chunks.push(d.toString()));
    proc.stderr?.on('data', (d: Buffer) => chunks.push(d.toString()));

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

  // Get changed files after
  let filesChanged: string[] = [];
  try {
    await runExecFile('git', ['add', '-A'], { cwd: projectPath, timeout: 5000 });
    const statusAfterResult = await runExecFile('git', ['diff', '--name-only', '--cached'], { cwd: projectPath, timeout: 5000 });
    filesChanged = statusAfterResult.stdout.split('\n').filter(Boolean);

    // Commit the changes
    if (filesChanged.length > 0) {
      await runExecFile('git', ['commit', '-m', `[conductor] task complete`], { cwd: projectPath, timeout: 10000 });
    }
  } catch { /* git might not be set up */ }

  return { output: output.slice(0, 10000), filesChanged }; // cap output at 10kb
}

export async function startExecution(opts: {
  planId: string;
  projectId: string;
  projectPath: string;
}): Promise<void> {
  const { projectId, projectPath } = opts;
  const plan = store.getConductorPlan(projectId);
  if (!plan) throw new Error('Plan not found');

  plan.status = 'executing';
  broadcastPlan(plan);

  // Log to timeline
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

  // Sync plan tasks to blackboard (best-effort — don't abort execution on failure)
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
        dependencies: [] as string[], // within-station deps resolved at start
      })),
    );
    const idMap = await blackboardService.syncPlanToBlackboard(projectPath, allTasks);
    for (const [k, v] of idMap) state.blackboardIdMap.set(k, v);
  } catch (err) {
    console.warn('[conductor] Could not sync to blackboard:', err);
  }

  // Run execution in background
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

    // Create snapshot before station
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

    // Execute tasks in station
    for (let ti = 0; ti < station.tasks.length; ti++) {
      if (state.stopped) break;

      // Wait if paused
      while (state.paused && !state.stopped) {
        await sleep(500);
      }
      if (state.stopped) break;

      const task = station.tasks[ti];
      plan.currentTaskIndex = ti;

      // ── Token budget check ────────────────────────────────────────────────
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
        // Pause execution and wait for user intervention
        state.paused = true;
        plan.status = 'paused';
        broadcastPlan(plan);
        while (state.paused && !state.stopped) { await sleep(500); }
        if (state.stopped) break;
        // Re-check after user resumes — if still blocked, skip this task
        const recheckEnforcement = tokenBucketService.getBudgetEnforcement();
        if (recheckEnforcement.shouldBlock) { continue; }
      }

      // ── Downshift to free agent if budget is tight ────────────────────────
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
        }
      }

      task.status = 'running';
      broadcastTask(plan, station, task);

      // Sync running status to blackboard (best-effort)
      const bbTaskId = state.blackboardIdMap.get(task.id);
      if (bbTaskId) {
        blackboardService.claimTask(projectPath, bbTaskId, task.assignedAgent).catch(() => { /* best-effort blackboard sync */ });
        blackboardService.updateTaskStatus(projectPath, bbTaskId, 'in-progress').catch(() => { /* best-effort blackboard sync */ });
        // Notify the assigned agent's mailbox
        blackboardService.sendMessage(projectPath, {
          from: 'conductor',
          to: task.assignedAgent,
          type: 'system',
          subject: `Task assigned: ${task.description.slice(0, 60)}`,
          body: `You have been assigned blackboard task ${bbTaskId}. Check .forge/blackboard/artifacts/ for relevant artifacts from previous tasks.`,
        }).catch(() => { /* best-effort blackboard sync */ });
      }
      broadcastPlan(plan);

      const startTime = Date.now();
      let retryCount = 0;
      let success = false;

      while (!success && retryCount < 2) {
        try {
          const result = await runAgentNonInteractive({
            agentType: task.assignedAgent,
            projectPath,
            prompt: buildTaskPrompt(plan, station, task),
          });

          task.status = 'completed';
          task.duration = Date.now() - startTime;
          task.filesChanged = result.filesChanged;
          task.output = result.output;
          success = true;

          // Sync completion to blackboard
          if (bbTaskId) {
            blackboardService.completeTask(projectPath, bbTaskId, [], result.filesChanged).catch(() => { /* best-effort blackboard sync */ });
            // Post output as an artifact if substantive
            if (result.output.length > 100) {
              blackboardService.postArtifact(
                projectPath,
                `${task.id}-output.txt`,
                result.output,
              ).catch(() => { /* best-effort blackboard sync */ });
            }
          }

          // Record fuel usage (estimate tokens from output length)
          const tokensOut = Math.ceil(result.output.length / 4);
          const tokensIn = Math.ceil(task.prompt.length / 4);
          const fuelEntry = fuelService.recordUsage({
            provider: 'cli-agent',
            model: task.assignedAgent,
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
            // Retry with slightly different prompt
            task.prompt = `[Retry attempt ${retryCount}] ${task.prompt}`;
            await sleep(2000);
          } else {
            task.status = 'failed';
            task.error = err instanceof Error ? err.message : String(err);

            // Sync failure to blackboard
            if (bbTaskId) {
              blackboardService.failTask(projectPath, bbTaskId, task.error ?? 'unknown error').catch(() => { /* best-effort blackboard sync */ });
            }

            // In Express mode: try a different agent automatically
            if (plan.controlLevel === 'express') {
              const fallbackAgent = getFallbackAgent(task.assignedAgent);
              if (fallbackAgent) {
                task.assignedAgent = fallbackAgent;
                task.status = 'running';
                broadcastTask(plan, station, task);
                try {
                  const result = await runAgentNonInteractive({
                    agentType: task.assignedAgent,
                    projectPath,
                    prompt: buildTaskPrompt(plan, station, task),
                  });
                  task.status = 'completed';
                  task.duration = Date.now() - startTime;
                  task.filesChanged = result.filesChanged;
                  task.output = result.output;
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
      broadcastPlan(plan);

      // In Guided/Full Control: pause on task failure
      if (task.status === 'failed' && plan.controlLevel !== 'express') {
        state.paused = true;
        broadcast('conductor:task-failed', {
          planId: plan.id,
          task,
          message: task.error,
        });
        // Wait for user to resume or stop
        while (state.paused && !state.stopped) {
          await sleep(500);
        }
      }
    }

    if (state.stopped) break;

    station.status = station.tasks.every((t) => t.status !== 'failed') ? 'completed' : 'failed';

    // Create snapshot after station
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

    // Timeline event
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

      // Wait for checkpoint decision
      await new Promise<void>((resolve) => {
        state.checkpointResolve = resolve;
        // Timeout: auto-continue in Express mode after 5s
        if (plan.controlLevel === 'express') {
          setTimeout(() => {
            if (!state.checkpointDecision) {
              state.checkpointDecision = 'continue';
            }
            resolve();
          }, 5000);
        }
      });

      const decision = state.checkpointDecision ?? 'continue';
      state.checkpointDecision = null;
      state.checkpointResolve = null;

      if (decision === 'stop') {
        state.stopped = true;
        break;
      }

      if (decision === 'revert') {
        // Revert to start of this station
        if (station.startSnapshotId) {
          try {
            await timeMachineService.revertToSnapshot({
              projectId: plan.projectId,
              projectPath,
              snapshotId: station.startSnapshotId,
            });
          } catch { /* ignore */ }
        }
        // Reset station
        station.status = 'pending';
        for (const task of station.tasks) {
          task.status = 'pending';
          task.output = undefined;
          task.error = undefined;
          task.filesChanged = undefined;
        }
        si--; // re-run this station
        broadcastPlan(plan);
        continue;
      }

      if (decision === 'pause') {
        state.paused = true;
        plan.status = 'paused';
        broadcastPlan(plan);
        while (state.paused && !state.stopped) {
          await sleep(500);
        }
        if (state.stopped) break;
      }

      plan.status = 'executing';
      broadcastPlan(plan);
    }
  }

  if (!state.stopped) {
    plan.status = 'completed';
    plan.completedAt = new Date().toISOString();

    // Final snapshot
    try {
      await timeMachineService.createSnapshot({
        projectId: plan.projectId,
        projectPath,
        label: `Conductor complete: ${plan.goal}`,
        trigger: 'conductor',
      });
    } catch { /* ignore */ }

    // Final commit
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

  return [
    `You are working on: "${plan.goal}"`,
    `Current station: ${station.name}`,
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
  // Prefer ollama (truly local/free) if available, otherwise github-routed gemini
  if (agentType === 'ollama') return null;
  return 'ollama';
}

// --- Contract Net Protocol integration ---

export async function requestBidsForPlan(projectId: string): Promise<import('../../shared/types').BidRound[]> {
  const plan = store.getConductorPlan(projectId);
  if (!plan) return [];

  const pendingTasks = plan.stations
    .flatMap(s => s.tasks)
    .filter(t => t.status === 'pending');

  if (pendingTasks.length === 0) return [];

  const availableAgents: AgentType[] = ['claude', 'gemini', 'codex', 'copilot'];

  const rounds = await contractNetService.runBidRounds(
    projectId,
    pendingTasks.map(t => ({ id: t.id, description: t.description, prompt: t.prompt })),
    availableAgents,
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
    const task = station.tasks[plan.currentTaskIndex];
    if (task) {
      task.status = 'skipped';
      broadcastTask(plan, station, task);
    }
  }
  // Resume execution
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
  if (state.checkpointResolve) {
    state.checkpointResolve();
  }
}

export function getPlan(projectId: string): ConductorPlan | null {
  return store.getConductorPlan(projectId);
}

// --- Helpers ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
