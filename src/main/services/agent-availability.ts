/**
 * agent-availability.ts
 * Real-time agent availability checking.
 * Called before Conductor assigns any task to ensure we only pick from
 * agents that are actually installed, authenticated, and within budget.
 */

import { execSync } from 'node:child_process';
import type { AgentType } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import * as store from '../store';

export interface AgentAvailability {
  agent: AgentType;
  available: boolean;
  reason?: string;
  isFree: boolean;
}

export interface GitHubModelsInfo {
  available: boolean;
  token: string | null;
  preferredModel: string;
  cheapModel: string;
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { timeout: 4000, stdio: 'pipe' }).toString().trim();
  } catch {
    return null;
  }
}

function binaryExists(cmd: string): boolean {
  return tryExec(`which ${cmd}`) !== null;
}

export function checkAgentAvailability(agent: AgentType): AgentAvailability {
  const config = AGENTS[agent];

  if (agent === 'claude') {
    if (!binaryExists('claude')) {
      return { agent, available: false, isFree: false, reason: 'Claude Code not installed. Run: npm install -g @anthropic-ai/claude-code' };
    }
    const version = tryExec('claude --version');
    if (!version) {
      return { agent, available: false, isFree: false, reason: 'Claude Code not responding. Try running: claude' };
    }
    const hasApiKey = !!store.getApiKey('anthropic');
    return { agent, available: true, isFree: false, reason: hasApiKey ? 'Using Anthropic API key' : 'Using Claude Code CLI auth' };
  }

  if (agent === 'gemini') {
    if (!binaryExists('gemini')) {
      return { agent, available: false, isFree: false, reason: 'Gemini CLI not installed. Run: npm install -g @google/gemini-cli' };
    }
    const version = tryExec('gemini --version');
    if (!version) {
      return { agent, available: false, isFree: false, reason: 'Gemini CLI not responding. Try running: gemini' };
    }
    const hasGoogleKey = !!store.getApiKey('google');
    return { agent, available: true, isFree: !hasGoogleKey, reason: hasGoogleKey ? 'Using Google API key' : 'Using Gemini free tier' };
  }

  if (agent === 'codex') {
    if (!binaryExists('codex')) {
      return { agent, available: false, isFree: false, reason: 'OpenAI Codex not installed. Run: npm install -g @openai/codex' };
    }
    const hasKey = !!store.getApiKey('openai');
    if (!hasKey) {
      const envKey = process.env.OPENAI_API_KEY;
      if (!envKey) {
        return { agent, available: false, isFree: false, reason: 'No OpenAI API key. Set OPENAI_API_KEY or add key in Settings → Fuel.' };
      }
    }
    return { agent, available: true, isFree: false };
  }

  if (agent === 'copilot') {
    if (!binaryExists('gh')) {
      return { agent, available: false, isFree: false, reason: 'GitHub CLI not installed. Run: https://cli.github.com/' };
    }
    const authStatus = tryExec('gh auth status 2>&1');
    if (!authStatus || (!authStatus.includes('Logged in') && !authStatus.includes('✓') && !authStatus.includes('github.com'))) {
      return { agent, available: false, isFree: false, reason: 'Not authenticated with GitHub. Run: gh auth login' };
    }
    const copilotVersion = tryExec('gh copilot --version 2>&1');
    if (!copilotVersion) {
      return { agent, available: false, isFree: false, reason: 'GitHub Copilot extension not installed. Run: gh extension install github/gh-copilot' };
    }
    return { agent, available: true, isFree: true, reason: 'Using GitHub Copilot (free with subscription)' };
  }

  if (agent === 'ollama') {
    if (!binaryExists('ollama')) {
      return { agent, available: false, isFree: true, reason: 'Ollama not installed. Get it at: https://ollama.com' };
    }
    const modelList = tryExec('ollama list 2>/dev/null');
    if (!modelList || !modelList.includes(':')) {
      return { agent, available: false, isFree: true, reason: 'Ollama installed but no models pulled. Run: ollama pull codellama' };
    }
    return { agent, available: true, isFree: true, reason: 'Using local Ollama model (free)' };
  }

  return { agent, available: false, isFree: false, reason: 'Unknown agent type' };
}

export function getAvailableAgents(): AgentAvailability[] {
  const agents: AgentType[] = ['claude', 'gemini', 'codex', 'copilot', 'ollama'];
  return agents.map(checkAgentAvailability);
}

export function getAvailableGitHubModels(): GitHubModelsInfo {
  const token = tryExec('gh auth token 2>/dev/null');
  if (!token || token.length < 10) {
    return { available: false, token: null, preferredModel: 'gpt-4o', cheapModel: 'gpt-4o-mini' };
  }
  return {
    available: true,
    token,
    preferredModel: 'gpt-4o',
    cheapModel: 'gpt-4o-mini',
  };
}

/**
 * Returns the best available model choice for Conductor planning/review.
 * Priority: GitHub Models (free) → Anthropic → OpenAI → error.
 */
export function getPreferredPlanningModel(quality: 'best' | 'balanced' | 'cheap' = 'balanced'): {
  provider: string; model: string; baseUrl?: string; apiKey?: string; isFree: boolean; displayName: string;
} {
  const gh = getAvailableGitHubModels();
  if (gh.available && gh.token) {
    const model = quality === 'cheap' ? gh.cheapModel : gh.preferredModel;
    return {
      provider: 'github',
      model,
      baseUrl: 'https://models.inference.ai.azure.com',
      apiKey: gh.token,
      isFree: true,
      displayName: `${model} via GitHub Models (free)`,
    };
  }

  const anthropicKey = store.getApiKey('anthropic');
  if (anthropicKey) {
    const model = quality === 'best' ? 'claude-opus-4-7' : quality === 'cheap' ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6';
    return { provider: 'anthropic', model, apiKey: anthropicKey, isFree: false, displayName: `${model} (Anthropic)` };
  }

  const openaiKey = store.getApiKey('openai');
  if (openaiKey) {
    const model = quality === 'cheap' ? 'gpt-4o-mini' : 'gpt-4o';
    return { provider: 'openai', model, apiKey: openaiKey, isFree: false, displayName: `${model} (OpenAI)` };
  }

  throw new Error('No AI provider connected. Please connect GitHub, Claude, or OpenAI in Settings → Fuel to use Conductor Mode.');
}

/**
 * Selects the best model variant for a given task complexity and available agents.
 * Returns the model string to use for that task (used in fuel tracking + prompts).
 */
export function selectModelVariant(
  complexity: 'easy' | 'medium' | 'hard',
  agent: AgentType,
): string {
  const gh = getAvailableGitHubModels();

  if (agent === 'claude') {
    const anthropicKey = store.getApiKey('anthropic');
    if (!anthropicKey && gh.available) {
      return complexity === 'easy' ? 'gpt-4o-mini' : 'gpt-4o'; // fallback via GitHub
    }
    return complexity === 'hard' ? 'claude-opus-4-7' : complexity === 'medium' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
  }

  if (agent === 'gemini') {
    return complexity === 'hard' ? 'gemini-2.0-pro' : 'gemini-2.0-flash';
  }

  if (agent === 'codex' || agent === 'copilot') {
    const openaiKey = store.getApiKey('openai');
    if (!openaiKey && gh.available) return 'gpt-4o';
    return complexity === 'hard' ? 'gpt-4o' : 'gpt-4o-mini';
  }

  if (agent === 'ollama') {
    return 'codellama'; // local model
  }

  return 'unknown';
}
