/**
 * vault-service.ts
 * Tests API key connections for vault entries.
 * Uses Node.js native fetch (available in Node 18+ / Electron 41).
 */

interface TestResult {
  success: boolean;
  error?: string;
  models?: string[];
}

const TEST_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), ms),
    ),
  ]);
}

export async function testConnection(
  provider: string,
  apiKey: string,
  baseUrl?: string,
): Promise<TestResult> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'No API key provided' };
  }

  try {
    switch (provider) {
      case 'openai':
        return await withTimeout(testOpenAI(apiKey), TEST_TIMEOUT_MS);
      case 'google':
        return await withTimeout(testGoogle(apiKey), TEST_TIMEOUT_MS);
      case 'anthropic':
        return await withTimeout(testAnthropic(apiKey), TEST_TIMEOUT_MS);
      case 'custom':
        if (!baseUrl) return { success: false, error: 'Base URL required for custom providers' };
        return await withTimeout(testOpenAICompatible(apiKey, baseUrl), TEST_TIMEOUT_MS);
      default:
        return { success: false, error: `Unknown provider: ${provider}` };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

async function testOpenAI(apiKey: string): Promise<TestResult> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (res.status === 401) return { success: false, error: 'Invalid API key' };
  if (res.status === 429) return { success: false, error: 'Rate limited — key is valid' };
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

  const data = await res.json() as { data?: { id: string }[] };
  const models = (data.data ?? [])
    .map((m) => m.id)
    .filter((id) => /^gpt|^o[0-9]/.test(id))
    .slice(0, 10);

  return { success: true, models };
}

async function testGoogle(apiKey: string): Promise<TestResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );

  if (res.status === 400 || res.status === 401 || res.status === 403) {
    return { success: false, error: 'Invalid API key' };
  }
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

  const data = await res.json() as { models?: { name: string; displayName?: string }[] };
  const models = (data.models ?? [])
    .map((m) => m.name.replace('models/', ''))
    .filter((id) => id.startsWith('gemini'))
    .slice(0, 10);

  return { success: true, models };
}

async function testAnthropic(apiKey: string): Promise<TestResult> {
  // Use a minimal messages request to verify key validity
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }),
  });

  if (res.status === 401) return { success: false, error: 'Invalid API key' };
  if (res.status === 403) return { success: false, error: 'API key lacks permissions' };
  // 200 or 529 (overloaded) both indicate a valid key
  if (res.ok || res.status === 529) {
    return {
      success: true,
      models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    };
  }
  return { success: false, error: `HTTP ${res.status}` };
}

async function testOpenAICompatible(apiKey: string, baseUrl: string): Promise<TestResult> {
  // Normalise base URL — strip trailing /v1 or /v1/ so we can add it ourselves
  const base = baseUrl.replace(/\/v1\/?$/, '');
  const url = `${base}/v1/models`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (res.status === 401) return { success: false, error: 'Invalid API key' };
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` };

  let models: string[] = [];
  try {
    const data = await res.json() as { data?: { id: string }[] };
    models = (data.data ?? []).map((m) => m.id).slice(0, 20);
  } catch {
    // Some providers don't return JSON models list
  }

  return { success: true, models };
}
