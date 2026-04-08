import { execSync } from 'node:child_process';
import type { ChatMessage, ChatProviderInfo, ChatModelInfo } from '../../shared/types';

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: () => void;
  onError: (err: Error) => void;
}

// --- Model Registry ---

const GITHUB_MODELS: ChatModelInfo[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', providerId: 'github', isFree: true, isAvailable: true },
  { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', providerId: 'github', isFree: true, isAvailable: true },
  { id: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', providerId: 'github', isFree: true, isAvailable: true },
  { id: 'meta-llama-3.1-405b-instruct', displayName: 'Llama 3.1 405B', providerId: 'github', isFree: true, isAvailable: true },
  { id: 'meta-llama-3.1-70b-instruct', displayName: 'Llama 3.1 70B', providerId: 'github', isFree: true, isAvailable: true },
  { id: 'mistral-large', displayName: 'Mistral Large', providerId: 'github', isFree: true, isAvailable: true },
  { id: 'mistral-nemo', displayName: 'Mistral Nemo', providerId: 'github', isFree: true, isAvailable: true },
];

const OPENAI_MODELS: ChatModelInfo[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', providerId: 'openai', isFree: false, isAvailable: false },
  { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', providerId: 'openai', isFree: false, isAvailable: false },
  { id: 'o1-preview', displayName: 'o1-preview', providerId: 'openai', isFree: false, isAvailable: false },
  { id: 'o1-mini', displayName: 'o1-mini', providerId: 'openai', isFree: false, isAvailable: false },
];

const ANTHROPIC_MODELS: ChatModelInfo[] = [
  { id: 'claude-opus-4-6', displayName: 'Claude Opus 4.6', providerId: 'anthropic', isFree: false, isAvailable: false },
  { id: 'claude-sonnet-4-6', displayName: 'Claude Sonnet 4.6', providerId: 'anthropic', isFree: false, isAvailable: false },
  { id: 'claude-haiku-4-5-20251001', displayName: 'Claude Haiku 4.5', providerId: 'anthropic', isFree: false, isAvailable: false },
];

const GOOGLE_MODELS: ChatModelInfo[] = [
  { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', providerId: 'google', isFree: false, isAvailable: false },
  { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', providerId: 'google', isFree: false, isAvailable: false },
  { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', providerId: 'google', isFree: false, isAvailable: false },
];

function getGitHubToken(): string | null {
  try {
    return execSync('gh auth token', { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

function isGitHubAuthenticated(): boolean {
  try {
    execSync('gh auth status', { timeout: 5000, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getProviders(apiKeys: Record<string, string | null>): ChatProviderInfo[] {
  const ghAuthenticated = isGitHubAuthenticated();
  const hasOpenAI = Boolean(apiKeys['openai']);
  const hasAnthropic = Boolean(apiKeys['anthropic']);
  const hasGoogle = Boolean(apiKeys['google']);

  return [
    {
      id: 'github',
      name: 'GitHub Models',
      isFree: true,
      hasKey: ghAuthenticated,
      isAvailable: ghAuthenticated,
      models: GITHUB_MODELS.map(m => ({ ...m, isAvailable: ghAuthenticated })),
    },
    {
      id: 'openai',
      name: 'OpenAI',
      isFree: false,
      hasKey: hasOpenAI,
      isAvailable: hasOpenAI,
      models: OPENAI_MODELS.map(m => ({ ...m, isAvailable: hasOpenAI })),
    },
    {
      id: 'anthropic',
      name: 'Anthropic',
      isFree: false,
      hasKey: hasAnthropic,
      isAvailable: hasAnthropic,
      models: ANTHROPIC_MODELS.map(m => ({ ...m, isAvailable: hasAnthropic })),
    },
    {
      id: 'google',
      name: 'Google',
      isFree: false,
      hasKey: hasGoogle,
      isAvailable: hasGoogle,
      models: GOOGLE_MODELS.map(m => ({ ...m, isAvailable: hasGoogle })),
    },
  ];
}

// --- SSE Streaming Parser ---

async function* parseSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';
      for (const part of parts) {
        const lines = part.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            yield line.slice(6);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// --- Provider: GitHub Models ---

async function chatGitHubModels(
  model: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
): Promise<void> {
  const token = getGitHubToken();
  if (!token) throw new Error('GitHub not authenticated');

  const response = await fetch('https://models.inference.ai.azure.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub Models error ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!response.body) throw new Error('No response body');

  for await (const data of parseSSE(response.body)) {
    if (data === '[DONE]') break;
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        callbacks.onToken(delta);
      }
    } catch {
      // skip malformed SSE lines
    }
  }
}

// --- Provider: OpenAI ---

async function chatOpenAI(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!response.body) throw new Error('No response body');

  for await (const data of parseSSE(response.body)) {
    if (data === '[DONE]') break;
    try {
      const parsed = JSON.parse(data);
      const delta = parsed?.choices?.[0]?.delta?.content;
      if (typeof delta === 'string') {
        callbacks.onToken(delta);
      }
    } catch {
      // skip malformed
    }
  }
}

// --- Provider: Anthropic ---

async function chatAnthropic(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic error ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!response.body) throw new Error('No response body');

  for await (const data of parseSSE(response.body)) {
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === 'content_block_delta') {
        const text = parsed?.delta?.text;
        if (typeof text === 'string') {
          callbacks.onToken(text);
        }
      }
    } catch {
      // skip malformed
    }
  }
}

// --- Provider: Google ---

async function chatGoogle(
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google error ${response.status}: ${text.slice(0, 200)}`);
  }

  if (!response.body) throw new Error('No response body');

  for await (const data of parseSSE(response.body)) {
    try {
      const parsed = JSON.parse(data);
      const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === 'string') {
        callbacks.onToken(text);
      }
    } catch {
      // skip malformed
    }
  }
}

// --- Unified Entry Point ---

export async function sendChatMessage(
  providerId: string,
  model: string,
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  apiKeys: Record<string, string | null>,
): Promise<void> {
  try {
    switch (providerId) {
      case 'github':
        await chatGitHubModels(model, messages, callbacks);
        break;
      case 'openai': {
        const key = apiKeys['openai'];
        if (!key) throw new Error('OpenAI API key not configured');
        await chatOpenAI(model, messages, key, callbacks);
        break;
      }
      case 'anthropic': {
        const key = apiKeys['anthropic'];
        if (!key) throw new Error('Anthropic API key not configured');
        await chatAnthropic(model, messages, key, callbacks);
        break;
      }
      case 'google': {
        const key = apiKeys['google'];
        if (!key) throw new Error('Google API key not configured');
        await chatGoogle(model, messages, key, callbacks);
        break;
      }
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
    callbacks.onDone();
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

export async function testConnection(
  providerId: string,
  apiKeys: Record<string, string | null>,
): Promise<{ success: boolean; error?: string }> {
  const testMessage: ChatMessage[] = [
    { id: 'test', role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
  ];
  let gotToken = false;
  try {
    await sendChatMessage(providerId, getTestModel(providerId), testMessage, {
      onToken: () => { gotToken = true; },
      onDone: () => {},
      onError: (err) => { throw err; },
    }, apiKeys);
    return { success: gotToken };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function getTestModel(providerId: string): string {
  switch (providerId) {
    case 'github': return 'gpt-4o-mini';
    case 'openai': return 'gpt-4o-mini';
    case 'anthropic': return 'claude-haiku-4-5-20251001';
    case 'google': return 'gemini-1.5-flash';
    default: return '';
  }
}
