import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OllamaModel, OllamaPullProgress, HardwareInfo } from '../../shared/types';

const api = window.electronAPI;

interface CatalogModel {
  name: string;
  display: string;
  sizeGb: number;
  category: 'coding' | 'general' | 'reasoning' | 'small';
  minRamGb: number;
  minVramGb: number;
  description: string;
  stars: number;
}

const MODEL_CATALOG: CatalogModel[] = [
  { name: 'llama3.2:3b', display: 'Llama 3.2 3B', sizeGb: 2.0, category: 'small', minRamGb: 4, minVramGb: 0, description: 'Fast, lightweight. Good for quick tasks and summaries.', stars: 3 },
  { name: 'phi3:mini', display: 'Phi-3 Mini', sizeGb: 2.3, category: 'small', minRamGb: 4, minVramGb: 0, description: 'Microsoft small model. Efficient for general use.', stars: 3 },
  { name: 'mistral:7b', display: 'Mistral 7B', sizeGb: 4.1, category: 'general', minRamGb: 8, minVramGb: 0, description: 'Excellent general-purpose model, fast on CPU.', stars: 4 },
  { name: 'llama3:8b', display: 'Llama 3 8B', sizeGb: 4.7, category: 'general', minRamGb: 8, minVramGb: 0, description: 'Meta flagship small model. Strong on instruction following.', stars: 4 },
  { name: 'qwen2.5-coder:7b', display: 'Qwen2.5 Coder 7B', sizeGb: 4.4, category: 'coding', minRamGb: 8, minVramGb: 6, description: 'Best-in-class local coding model. Strong code completion.', stars: 5 },
  { name: 'deepseek-r1:14b', display: 'DeepSeek R1 14B', sizeGb: 8.9, category: 'reasoning', minRamGb: 16, minVramGb: 6, description: 'Powerful reasoning and problem solving.', stars: 4 },
  { name: 'phi4:14b', display: 'Phi-4 14B', sizeGb: 8.9, category: 'general', minRamGb: 16, minVramGb: 8, description: 'Microsoft latest. Punches above its size.', stars: 4 },
  { name: 'qwen2.5:32b', display: 'Qwen2.5 32B', sizeGb: 20.0, category: 'general', minRamGb: 32, minVramGb: 20, description: 'Large, highly capable general model.', stars: 5 },
];

const CATEGORIES = ['all', 'coding', 'general', 'reasoning', 'small'] as const;
type Category = typeof CATEGORIES[number];

function getRecommended(hardware: HardwareInfo, installed: OllamaModel[]): CatalogModel[] {
  const installedNames = new Set(installed.map(m => m.name));
  const { gpuVramGb, totalRamGb } = hardware;

  let maxSizeGb = 2;
  if (gpuVramGb >= 20 || totalRamGb >= 32) maxSizeGb = 40;
  else if (gpuVramGb >= 12 || totalRamGb >= 24) maxSizeGb = 15;
  else if (gpuVramGb >= 6 || totalRamGb >= 16) maxSizeGb = 10;
  else if (totalRamGb >= 8) maxSizeGb = 5;

  return MODEL_CATALOG.filter(m =>
    !installedNames.has(m.name) &&
    m.sizeGb <= maxSizeGb,
  ).slice(0, 4);
}

function fitsHardware(model: CatalogModel, hardware: HardwareInfo): boolean {
  const { gpuVramGb, totalRamGb } = hardware;
  if (gpuVramGb >= model.minVramGb) return true;
  // CPU fallback: needs more RAM
  return totalRamGb >= model.minRamGb + (model.minVramGb > 0 ? 4 : 0);
}

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="text-[9px] text-amber-400 font-mono">
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  );
}

interface InstallState {
  status: 'idle' | 'installing' | 'done' | 'error';
  percent?: number;
  downloadedGb?: number;
  totalGb?: number;
  statusText?: string;
  error?: string;
}

interface ModelBrowserProps {
  open: boolean;
  onClose: () => void;
}

export default function ModelBrowser({ open, onClose }: ModelBrowserProps) {
  const [installed, setInstalled] = useState<OllamaModel[]>([]);
  const [hardware, setHardware] = useState<HardwareInfo | null>(null);
  const [category, setCategory] = useState<Category>('all');
  const [search, setSearch] = useState('');
  const [installStates, setInstallStates] = useState<Record<string, InstallState>>({});
  const [deletingModels, setDeletingModels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      api.ollama.getStatus(),
      api.ollama.detectHardware(),
    ]).then(([status, hw]) => {
      setInstalled(status.models);
      setHardware(hw);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [open]);

  // Listen for pull progress events
  useEffect(() => {
    if (!open) return;
    api.ollama.onPullProgress((raw) => {
      const data = raw as OllamaPullProgress;
      setInstallStates(prev => ({
        ...prev,
        [data.modelName]: {
          status: data.done ? (data.error ? 'error' : 'done') : 'installing',
          percent: data.percent,
          downloadedGb: data.downloadedGb,
          totalGb: data.totalGb,
          statusText: data.status,
          error: data.error,
        },
      }));
      if (data.done && !data.error) {
        // Refresh installed list
        api.ollama.getStatus().then(s => setInstalled(s.models));
      }
    });
    return () => api.ollama.offPullProgress();
  }, [open]);

  async function handleInstall(modelName: string) {
    setInstallStates(prev => ({
      ...prev,
      [modelName]: { status: 'installing', statusText: 'Starting download...' },
    }));
    try {
      await api.ollama.pullModel(modelName);
    } catch {
      setInstallStates(prev => ({
        ...prev,
        [modelName]: { status: 'error', error: 'Download failed' },
      }));
    }
  }

  async function handleDelete(modelName: string) {
    setDeletingModels(prev => new Set([...prev, modelName]));
    const result = await api.ollama.deleteModel(modelName);
    setDeletingModels(prev => { const s = new Set(prev); s.delete(modelName); return s; });
    if (result.success) {
      setInstalled(prev => prev.filter(m => m.name !== modelName));
    }
  }

  const recommended = hardware ? getRecommended(hardware, installed) : [];
  const installedNames = new Set(installed.map(m => m.name));

  const filteredCatalog = MODEL_CATALOG.filter(m => {
    if (category !== 'all' && m.category !== category) return false;
    if (search && !m.display.toLowerCase().includes(search.toLowerCase()) && !m.name.includes(search.toLowerCase())) return false;
    return true;
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 8 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-2xl max-h-[85vh] bg-surface border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
          style={{ borderRadius: 2 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono font-semibold text-text-primary">🖥️ Local Model Browser</span>
              {hardware && (
                <span className="text-[9px] font-mono text-text-muted border border-white/10 px-1.5 py-0.5">
                  {hardware.totalRamGb} GB RAM
                  {hardware.gpuVramGb > 0 && ` · ${hardware.gpuName ?? 'GPU'} ${hardware.gpuVramGb} GB VRAM`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search models..."
                className="bg-black/20 border border-white/10 px-2 py-1 text-[10px] font-mono text-text-primary placeholder-text-muted focus:outline-none focus:border-white/25 w-36"
              />
              <button
                onClick={onClose}
                className="w-6 h-6 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 1l8 8M9 1l-8 8" />
                </svg>
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs font-mono text-text-muted animate-pulse">Scanning local models...</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {/* Installed */}
              {installed.length > 0 && (
                <section className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-[9px] font-mono text-text-muted uppercase tracking-wider mb-3">
                    Installed ({installed.length})
                  </h3>
                  <div className="space-y-2">
                    {installed.map(model => (
                      <div key={model.name} className="flex items-center gap-3 p-2.5 border border-white/[0.06] bg-white/[0.02]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono font-medium text-text-primary">{model.displayName}</span>
                            <span className="text-[9px] font-mono text-text-muted">{model.sizeGb} GB</span>
                            {model.quantization && (
                              <span className="text-[8px] font-mono bg-white/[0.05] text-text-muted px-1 border border-white/[0.08]">{model.quantization}</span>
                            )}
                          </div>
                          <p className="text-[9px] font-mono text-text-muted mt-0.5">{model.name}</p>
                        </div>
                        <button
                          onClick={() => handleDelete(model.name)}
                          disabled={deletingModels.has(model.name)}
                          className="text-[9px] font-mono px-2 py-1 border border-status-error/40 text-status-error/70 hover:border-status-error hover:text-status-error transition-colors disabled:opacity-40"
                        >
                          {deletingModels.has(model.name) ? 'Removing...' : 'Delete'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Recommended */}
              {recommended.length > 0 && (
                <section className="p-4 border-b border-white/[0.06]">
                  <h3 className="text-[9px] font-mono text-text-muted uppercase tracking-wider mb-3">
                    Recommended for Your Hardware
                  </h3>
                  <div className="space-y-2">
                    {recommended.map(model => (
                      <ModelCard
                        key={model.name}
                        model={model}
                        hardware={hardware}
                        installState={installStates[model.name]}
                        isInstalled={installedNames.has(model.name)}
                        onInstall={() => handleInstall(model.name)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* All models */}
              <section className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[9px] font-mono text-text-muted uppercase tracking-wider">All Models</h3>
                  <div className="flex items-center gap-1 ml-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`text-[8px] font-mono px-1.5 py-0.5 border transition-colors capitalize ${
                          category === cat
                            ? 'border-accent text-accent bg-accent/10'
                            : 'border-white/[0.08] text-text-muted hover:border-white/20 hover:text-text-secondary'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  {filteredCatalog.map(model => (
                    <ModelCard
                      key={model.name}
                      model={model}
                      hardware={hardware}
                      installState={installStates[model.name]}
                      isInstalled={installedNames.has(model.name)}
                      onInstall={() => handleInstall(model.name)}
                    />
                  ))}
                </div>
              </section>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ModelCard({
  model,
  hardware,
  installState,
  isInstalled,
  onInstall,
}: {
  model: CatalogModel;
  hardware: HardwareInfo | null;
  installState?: InstallState;
  isInstalled: boolean;
  onInstall: () => void;
}) {
  const fits = hardware ? fitsHardware(model, hardware) : true;
  const isInstalling = installState?.status === 'installing';
  const isDone = installState?.status === 'done' || isInstalled;
  const isError = installState?.status === 'error';

  return (
    <div className={`p-2.5 border ${isDone ? 'border-green-900/40 bg-green-900/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-mono font-medium text-text-primary">{model.display}</span>
            <span className="text-[9px] font-mono text-text-muted">{model.sizeGb} GB</span>
            <span className={`text-[8px] font-mono px-1 border capitalize ${
              model.category === 'coding' ? 'border-blue-900/50 text-blue-400 bg-blue-900/10' :
              model.category === 'reasoning' ? 'border-purple-900/50 text-purple-400 bg-purple-900/10' :
              model.category === 'small' ? 'border-green-900/50 text-green-400 bg-green-900/10' :
              'border-white/[0.08] text-text-muted'
            }`}>
              {model.category}
            </span>
            <StarRating stars={model.stars} />
          </div>
          <p className="text-[9px] text-text-muted mt-0.5">{model.description}</p>
          {!fits && hardware && (
            <p className="text-[9px] text-amber-400 mt-0.5">
              ⚠ Needs ~{model.minVramGb > 0 ? `${model.minVramGb} GB VRAM` : `${model.minRamGb} GB RAM`} — will run on CPU (slower)
            </p>
          )}
          {isInstalling && (
            <div className="mt-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[9px] font-mono text-text-muted">{installState?.statusText}</span>
                {installState?.percent !== undefined && (
                  <span className="text-[9px] font-mono text-accent ml-auto">{installState.percent}%</span>
                )}
              </div>
              {installState?.percent !== undefined && (
                <div className="h-0.5 bg-white/10 w-full">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${installState.percent}%` }}
                  />
                </div>
              )}
              {installState?.downloadedGb !== undefined && installState.totalGb && (
                <p className="text-[9px] font-mono text-text-muted mt-0.5">
                  {installState.downloadedGb} / {installState.totalGb} GB
                </p>
              )}
            </div>
          )}
          {isError && (
            <p className="text-[9px] text-status-error mt-0.5">{installState?.error ?? 'Download failed'}</p>
          )}
        </div>
        <div className="shrink-0">
          {isDone ? (
            <span className="text-[9px] font-mono text-green-400 border border-green-900/50 px-2 py-1">✓ Installed</span>
          ) : isInstalling ? (
            <span className="text-[9px] font-mono text-text-muted animate-pulse">Downloading...</span>
          ) : (
            <button
              onClick={onInstall}
              className="text-[9px] font-mono px-2 py-1 border border-accent/50 text-accent hover:bg-accent/10 transition-colors"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
