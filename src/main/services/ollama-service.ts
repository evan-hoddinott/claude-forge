import { execSync, spawn } from 'node:child_process';
import * as os from 'node:os';
import type { OllamaModel, OllamaStatus, OllamaStats, HardwareInfo, OllamaPullProgress } from '../../shared/types';

const OLLAMA_BASE = 'http://localhost:11434';

export async function detectOllama(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return { running: false, installed: await isOllamaInstalled(), models: [] };
    }
    const data = await res.json() as { models?: Array<{ name: string; size: number; modified_at: string; details?: { quantization_level?: string } }> };
    const models: OllamaModel[] = (data.models ?? []).map((m) => ({
      name: m.name,
      displayName: formatModelName(m.name),
      sizeGb: Math.round((m.size / 1e9) * 10) / 10,
      quantization: m.details?.quantization_level,
      modifiedAt: m.modified_at,
    }));
    return { running: true, installed: true, models };
  } catch {
    return { running: false, installed: await isOllamaInstalled(), models: [] };
  }
}

export async function isOllamaInstalled(): Promise<boolean> {
  try {
    execSync('which ollama', { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

export async function startOllama(): Promise<{ success: boolean; error?: string }> {
  try {
    const child = spawn('ollama', ['serve'], { detached: true, stdio: 'ignore' });
    child.unref();
    // Wait up to 5s for it to start
    for (let i = 0; i < 10; i++) {
      await new Promise<void>(r => setTimeout(r, 500));
      const status = await detectOllama();
      if (status.running) return { success: true };
    }
    return { success: false, error: 'Ollama did not start in time' };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function getRunningStats(): Promise<OllamaStats> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/ps`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return {};
    const data = await res.json() as { models?: Array<{ name: string; size_vram: number }> };
    const model = data.models?.[0];
    if (!model) return {};
    return {
      modelName: model.name,
      vramUsedGb: Math.round((model.size_vram / 1e9) * 10) / 10,
    };
  } catch {
    return {};
  }
}

export async function pullModel(
  name: string,
  onProgress: (p: OllamaPullProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', name], { stdio: ['ignore', 'pipe', 'pipe'] });
    let totalGb = 0;

    child.stdout?.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split('\n')) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as { status?: string; completed?: number; total?: number };
          const pct = obj.total ? Math.round(((obj.completed ?? 0) / obj.total) * 100) : undefined;
          if (obj.total) {
            totalGb = Math.round((obj.total / 1e9) * 10) / 10;
          }
          onProgress({
            modelName: name,
            status: obj.status ?? '',
            downloadedGb: obj.completed ? Math.round((obj.completed / 1e9) * 10) / 10 : undefined,
            totalGb: totalGb || undefined,
            percent: pct,
            done: false,
          });
        } catch {
          // non-JSON line, skip
        }
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        onProgress({ modelName: name, status: 'success', done: true });
        resolve();
      } else {
        onProgress({ modelName: name, status: 'error', done: true, error: `exit code ${code}` });
        reject(new Error(`ollama pull exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      onProgress({ modelName: name, status: 'error', done: true, error: err.message });
      reject(err);
    });
  });
}

export async function deleteModel(name: string): Promise<{ success: boolean; error?: string }> {
  try {
    execSync(`ollama rm ${name}`, { timeout: 10000 });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

export async function detectHardware(): Promise<HardwareInfo> {
  const totalRamGb = Math.round(os.totalmem() / 1e9);
  let gpuVramGb = 0;
  let gpuName: string | undefined;
  try {
    const out = execSync(
      'nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits',
      { timeout: 3000 },
    ).toString().trim();
    const parts = out.split(',').map((s: string) => s.trim());
    gpuName = parts[0];
    gpuVramGb = Math.round(parseInt(parts[1] ?? '0', 10) / 1024);
  } catch {
    // no nvidia GPU — ignore
  }
  return { totalRamGb, gpuVramGb, gpuName };
}

function formatModelName(name: string): string {
  return name
    .replace(':', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
