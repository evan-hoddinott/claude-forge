/**
 * contract-net.ts
 * Contract Net Protocol for intelligent task assignment.
 * Agents bid on tasks; the Conductor awards to the highest scorer.
 *
 * Scoring: score = (confidence × 0.3) + (1/normalizedCost × 0.3) +
 *                  (contextRelevance × 0.2) + (1/normalizedTime × 0.1) +
 *                  (trackRecord × 0.1)
 */

import { execSync } from 'node:child_process';
import type { AgentType, AgentBid, ScoredBid, BidRound } from '../../shared/types';
import * as store from '../store';

// ─── Agent descriptions for the bid prompt ───────────────────────────────────

const AGENT_STRENGTHS: Partial<Record<AgentType, string>> = {
  claude:  'Complex logic, architecture, TypeScript, long-context reasoning, API design',
  gemini:  'UI components, React frontend, visual design, CSS, user-facing features',
  codex:   'Tests, boilerplate, repetitive patterns, structured code generation',
  copilot: 'Documentation, comments, simple scripts, file organisation',
  ollama:  'Low-complexity tasks, privacy-sensitive work, offline operation',
};

// ─── LLM plumbing (mirror of conductor-service pattern) ──────────────────────

interface LLMChoice { provider: string; model: string; baseUrl?: string; apiKey?: string; }

function selectModel(): LLMChoice {
  const githubToken = (() => {
    try { return execSync('gh auth token', { timeout: 5000 }).toString().trim(); } catch { return null; }
  })();
  if (githubToken) {
    return { provider: 'github', model: 'gpt-4o', baseUrl: 'https://models.inference.ai.azure.com', apiKey: githubToken };
  }
  const anthropicKey = store.getApiKey('anthropic');
  if (anthropicKey) return { provider: 'anthropic', model: 'claude-sonnet-4-6', apiKey: anthropicKey };
  const openaiKey = store.getApiKey('openai');
  if (openaiKey) return { provider: 'openai', model: 'gpt-4o', apiKey: openaiKey };
  throw new Error('No AI provider available for CNP bidding');
}

async function callLLM(choice: LLMChoice, system: string, user: string): Promise<string> {
  const messages = [{ role: 'system', content: system }, { role: 'user', content: user }];

  if (choice.provider === 'github' || choice.provider === 'openai') {
    const base = choice.baseUrl ?? 'https://api.openai.com/v1';
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${choice.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: choice.model, messages, max_tokens: 3000 }),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return ((await res.json()) as { choices: Array<{ message: { content: string } }> }).choices[0]?.message?.content ?? '';
  }

  if (choice.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': choice.apiKey!, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: choice.model, max_tokens: 3000, messages: [{ role: 'user', content: user }], system }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return ((await res.json()) as { content: Array<{ text: string }> }).content[0]?.text ?? '';
  }

  throw new Error(`Unknown provider: ${choice.provider}`);
}

function extractJSON(text: string): unknown {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse((m ? m[1] : text).trim());
}

// ─── Track record ─────────────────────────────────────────────────────────────

export function getTrackRecord(agent: AgentType, projectId: string): number {
  const plan = store.getConductorPlan(projectId);
  if (!plan) return 0.5;
  const tasks = plan.stations.flatMap(s => s.tasks).filter(t => t.assignedAgent === agent);
  if (tasks.length === 0) return 0.5;
  return tasks.filter(t => t.status === 'completed').length / tasks.length;
}

// ─── Bid evaluation ───────────────────────────────────────────────────────────

export function evaluateBids(bids: AgentBid[], projectId: string): ScoredBid[] {
  if (bids.length === 0) return [];
  const maxTokens = Math.max(...bids.map(b => b.estimatedTokens), 1);
  const maxTime   = Math.max(...bids.map(b => b.estimatedMinutes), 1);

  return bids
    .map(bid => ({
      ...bid,
      score:
        bid.confidence               * 0.3 +
        (1 - bid.estimatedTokens / maxTokens) * 0.3 +
        bid.contextRelevance         * 0.2 +
        (1 - bid.estimatedMinutes / maxTime)  * 0.1 +
        getTrackRecord(bid.agent, projectId)  * 0.1,
    }))
    .sort((a, b) => b.score - a.score);
}

// ─── Main: collect bids via one LLM call ─────────────────────────────────────

export async function runBidRounds(
  projectId: string,
  tasks: Array<{ id: string; description: string; prompt: string }>,
  availableAgents: AgentType[],
): Promise<BidRound[]> {
  if (tasks.length === 0) return [];

  const agentBlock = availableAgents
    .map(a => `  - ${a}: ${AGENT_STRENGTHS[a] ?? 'general purpose'}`)
    .join('\n');

  const taskBlock = tasks
    .map((t, i) => `  [${i + 1}] id="${t.id}" — ${t.description}`)
    .join('\n');

  const system = `You are simulating a Contract Net Protocol bidding system.
Each AI agent bids on tasks based on their documented strengths.
Return ONLY valid JSON with no markdown or commentary.`;

  const user = `Available agents:\n${agentBlock}\n\nTasks:\n${taskBlock}\n\n` +
    `For EVERY task × agent combination, generate one bid.\n` +
    `Return: { "bids": [ { "taskId": string, "agent": string, "confidence": 0-1, ` +
    `"estimatedTokens": 1000-8000, "estimatedMinutes": 1-15, ` +
    `"reasoning": string, "contextRelevance": 0-1 } ] }\n\n` +
    `Reflect each agent's genuine strengths. Winning bids should have confidence 0.75-0.97.`;

  let rawBids: AgentBid[] = [];
  try {
    const model = selectModel();
    const response = await callLLM(model, system, user);
    const parsed = extractJSON(response) as { bids: AgentBid[] };
    rawBids = Array.isArray(parsed?.bids) ? parsed.bids : [];
  } catch (err) {
    console.warn('[contract-net] Bid collection failed:', err);
    // Return empty rounds; caller falls back to static assignment
    return tasks.map(t => ({ taskId: t.id, taskDescription: t.description, bids: [], awarded: null }));
  }

  return tasks.map(task => {
    const taskBids = rawBids.filter(b => b.taskId === task.id && availableAgents.includes(b.agent as AgentType));
    const scored = evaluateBids(taskBids, projectId);
    return { taskId: task.id, taskDescription: task.description, bids: scored, awarded: scored[0]?.agent ?? null };
  });
}
