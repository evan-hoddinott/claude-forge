import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import type {
  DependencyStatus,
  SetupCheckResult,
  AgentType,
  AgentStatus,
  AppMode,
} from '../../shared/types';
import { AGENTS } from '../../shared/types';

interface SetupAssistantProps {
  onComplete: (opts?: { startTutorial?: boolean; openWizard?: boolean }) => void;
}

type WizardStep = 'welcome' | 'system-check' | 'accounts' | 'preferences' | 'ready';
const STEPS: WizardStep[] = ['welcome', 'system-check', 'accounts', 'preferences', 'ready'];

// ---------------------------------------------------------------------------
// Main wizard
// ---------------------------------------------------------------------------

export default function SetupAssistant({ onComplete }: SetupAssistantProps) {
  const api = useAPI();
  const [step, setStep] = useState<WizardStep>('welcome');

  // System check state
  const [checkResult, setCheckResult] = useState<SetupCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<AgentType, AgentStatus> | null>(null);
  const [installingAgent, setInstallingAgent] = useState<AgentType | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  // Accounts state
  const [ghAuth, setGhAuth] = useState<{ authenticated: boolean; username: string } | null>(null);

  // Preferences state
  const [projectDir, setProjectDir] = useState('');
  const [selectedMode, setSelectedMode] = useState<AppMode>('simple');

  // Load defaults
  useEffect(() => {
    api.preferences.get().then((prefs) => {
      setProjectDir(prefs.defaultProjectDir);
      setSelectedMode(prefs.mode || 'simple');
    });
  }, [api]);

  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      const [result, statuses] = await Promise.all([
        api.setup.checkDependencies(),
        api.agent.checkAllStatuses(),
      ]);
      setCheckResult(result);
      setAgentStatuses(statuses);
    } catch {
      // ignore
    } finally {
      setChecking(false);
    }
  }, [api]);

  const checkGitHub = useCallback(async () => {
    try {
      const auth = await api.system.checkGhAuth();
      setGhAuth(auth);
    } catch {
      setGhAuth({ authenticated: false, username: '' });
    }
  }, [api]);

  // Auto-run checks when reaching those steps
  useEffect(() => {
    if (step === 'system-check') runCheck();
    if (step === 'accounts') checkGitHub();
  }, [step, runCheck, checkGitHub]);

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }

  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  async function handleSkip() {
    await api.preferences.update({ setupCompleted: true });
    onComplete();
  }

  async function handleFinish(opts?: { startTutorial?: boolean; openWizard?: boolean }) {
    await api.preferences.update({
      setupCompleted: true,
      mode: selectedMode,
      defaultProjectDir: projectDir,
    });
    onComplete(opts);
  }

  async function handleInstallAgent(agentType: AgentType) {
    setInstallingAgent(agentType);
    setInstallError(null);
    api.agent.onInstallProgress(() => { /* progress tracked by spinner */ });
    const result = await api.agent.install(agentType);
    api.agent.offInstallProgress();
    setInstallingAgent(null);
    if (result.success) {
      // Refresh statuses
      const statuses = await api.agent.checkAllStatuses();
      setAgentStatuses(statuses);
    } else {
      setInstallError(result.error || 'Installation failed');
    }
  }

  async function handleInstallDep(dep: DependencyStatus) {
    await api.system.openExternal(dep.installUrl);
  }

  async function handlePickDir() {
    const selected = await api.system.selectDirectory();
    if (selected) setProjectDir(selected);
  }

  const stepIndex = STEPS.indexOf(step);
  const progress = ((stepIndex) / (STEPS.length - 1)) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
      >
        {/* Progress bar */}
        {step !== 'welcome' && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full transition-colors ${
                    i <= stepIndex ? 'bg-accent' : 'bg-white/10'
                  }`} />
                  {!['welcome'].includes(s) && i > 0 && (
                    <span className="text-[10px] text-text-muted hidden sm:inline">
                      {s === 'system-check' ? 'Tools' : s === 'accounts' ? 'Accounts' : s === 'preferences' ? 'Preferences' : 'Ready'}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <StepWelcome key="welcome" onNext={goNext} onSkip={handleSkip} />
            )}
            {step === 'system-check' && (
              <StepSystemCheck
                key="system-check"
                checkResult={checkResult}
                checking={checking}
                agentStatuses={agentStatuses}
                installingAgent={installingAgent}
                installError={installError}
                onRecheck={runCheck}
                onInstallDep={handleInstallDep}
                onInstallAgent={handleInstallAgent}
                onInstallWSL={() => api.system.openExternal('https://learn.microsoft.com/en-us/windows/wsl/install')}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {step === 'accounts' && (
              <StepAccounts
                key="accounts"
                api={api}
                ghAuth={ghAuth}
                agentStatuses={agentStatuses}
                onRefreshGh={checkGitHub}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {step === 'preferences' && (
              <StepPreferences
                key="preferences"
                projectDir={projectDir}
                selectedMode={selectedMode}
                onPickDir={handlePickDir}
                onSetMode={setSelectedMode}
                onDirChange={setProjectDir}
                onNext={goNext}
                onBack={goBack}
              />
            )}
            {step === 'ready' && (
              <StepReady
                key="ready"
                onFinish={handleFinish}
              />
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared animation variants
// ---------------------------------------------------------------------------

const stepVariants = {
  initial: { opacity: 0, x: 30 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, x: -30, transition: { duration: 0.15 } },
};

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  return (
    <motion.div variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center py-12">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-accent/10 mb-6 relative"
      >
        <svg className="w-10 h-10 text-accent" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4 15h16v2.25c0 1.24-1.01 2.25-2.25 2.25H6.25A2.25 2.25 0 014 17.25V15z" />
          <path d="M3 12.75a.75.75 0 01.75-.75h16.5a.75.75 0 01.75.75V15H3v-2.25z" />
          <path d="M6.75 7.5h10.5A2.25 2.25 0 0119.5 9.75V12h-15V9.75a2.25 2.25 0 012.25-2.25z" opacity="0.6" />
          <rect x="9" y="19.5" width="6" height="2.25" rx="0.75" />
        </svg>
        {/* Subtle glow */}
        <div className="absolute inset-0 rounded-2xl bg-accent/5 blur-xl" />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-2xl font-bold text-text-primary mb-3"
      >
        Welcome to Claude Forge
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-text-muted max-w-sm mx-auto mb-10"
      >
        Let's get you set up. This takes about 2 minutes.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <button
          onClick={onNext}
          className="px-8 py-3 rounded-xl bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all hover:shadow-[0_0_24px_var(--color-accent-glow)]"
        >
          Get Started
        </button>
        <div>
          <button
            onClick={onSkip}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            Skip setup
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: System Check
// ---------------------------------------------------------------------------

function StepSystemCheck({
  checkResult,
  checking,
  agentStatuses,
  installingAgent,
  installError,
  onRecheck,
  onInstallDep,
  onInstallAgent,
  onInstallWSL,
  onNext,
  onBack,
}: {
  checkResult: SetupCheckResult | null;
  checking: boolean;
  agentStatuses: Record<AgentType, AgentStatus> | null;
  installingAgent: AgentType | null;
  installError: string | null;
  onRecheck: () => void;
  onInstallDep: (dep: DependencyStatus) => void;
  onInstallAgent: (agentType: AgentType) => void;
  onInstallWSL: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const totalDeps = checkResult?.dependencies.length ?? 0;
  const installedDeps = checkResult?.dependencies.filter((d) => d.installed).length ?? 0;
  const installedAgents = agentStatuses
    ? (['claude', 'gemini', 'codex'] as AgentType[]).filter((a) => agentStatuses[a]?.installed).length
    : 0;
  const totalReady = installedDeps + installedAgents;
  const totalItems = totalDeps + 3; // 3 agents

  return (
    <motion.div variants={stepVariants} initial="initial" animate="animate" exit="exit">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          Let's make sure everything is ready
        </h2>
        <p className="text-sm text-text-muted">
          {checking ? 'Scanning your system...' : `${totalReady} of ${totalItems} ready`}
        </p>
      </div>

      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden mb-4">
        {/* Required tools */}
        <div className="px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            Required Tools
          </h3>
        </div>

        {checking && !checkResult ? (
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-lg bg-white/[0.02] animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {checkResult?.dependencies.map((dep) => (
              <DepRow key={dep.command} dep={dep} onInstall={() => onInstallDep(dep)} />
            ))}
          </div>
        )}

        {/* WSL recommendation */}
        {checkResult?.platform === 'native-windows' && !checkResult.wslAvailable && (
          <div className="px-4 py-3 border-t border-white/[0.06] bg-blue-500/[0.04]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WarningIcon className="w-4 h-4 text-blue-400" />
                <div>
                  <span className="text-xs font-medium text-blue-300">WSL (recommended)</span>
                  <p className="text-[10px] text-blue-300/60">Best experience for AI coding</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onInstallWSL}
                  className="px-3 py-1.5 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 text-xs font-medium text-blue-300 transition-colors"
                >
                  Install WSL
                </button>
                <span className="text-[10px] text-blue-300/40">or skip</span>
              </div>
            </div>
          </div>
        )}

        {/* AI Coding Agents */}
        <div className="px-4 py-3 border-t border-white/[0.06]">
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
            AI Coding Agents
          </h3>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {(['claude', 'gemini', 'codex'] as AgentType[]).map((agentType) => {
            const config = AGENTS[agentType];
            const status = agentStatuses?.[agentType];
            const isInstalling = installingAgent === agentType;

            return (
              <div key={agentType} className="px-4 py-3 flex items-center gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
                  status?.installed ? 'bg-status-ready/10' : 'bg-white/[0.04]'
                }`}>
                  {status?.installed ? (
                    <CheckIcon className="w-4 h-4 text-status-ready" />
                  ) : (
                    <XIcon className="w-4 h-4 text-text-muted" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{config.displayName}</span>
                    {status?.installed && status.version && (
                      <span className="text-xs text-text-muted">
                        {status.version.match(/(\d+\.\d+\.\d+)/)?.[1] ?? ''}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    {status?.installed ? 'Ready' : `npm i -g ${config.npmPackage}`}
                  </p>
                </div>
                {!status?.installed && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onInstallAgent(agentType)}
                      disabled={isInstalling || installingAgent !== null}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                      style={{
                        backgroundColor: config.color + '18',
                        color: config.color,
                      }}
                    >
                      {isInstalling ? 'Installing...' : 'Install'}
                    </button>
                    <button
                      onClick={() => {/* skip */}}
                      className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {installError && (
        <div className="mb-4 p-3 rounded-lg bg-status-error/10 border border-status-error/20">
          <p className="text-xs text-status-error">{installError}</p>
        </div>
      )}

      {/* Install All Missing button */}
      {checkResult && (installedDeps < totalDeps || installedAgents < 3) && (
        <div className="text-center mb-4">
          <button
            onClick={onRecheck}
            disabled={checking}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary transition-colors disabled:opacity-50"
          >
            {checking ? 'Checking...' : 'Re-check All'}
          </button>
        </div>
      )}

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Connect Accounts
// ---------------------------------------------------------------------------

function StepAccounts({
  api,
  ghAuth,
  agentStatuses,
  onRefreshGh,
  onNext,
  onBack,
}: {
  api: ReturnType<typeof useAPI>;
  ghAuth: { authenticated: boolean; username: string } | null;
  agentStatuses: Record<AgentType, AgentStatus> | null;
  onRefreshGh: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [loginState, setLoginState] = useState<'idle' | 'waiting' | 'polling'>('idle');
  const [deviceCode, setDeviceCode] = useState('');

  async function handleGitHubLogin() {
    setLoginState('waiting');
    const result = await api.github.loginStart();
    if ('error' in result) {
      setLoginState('idle');
      return;
    }
    setDeviceCode(result.code);
    setLoginState('polling');

    const poll = setInterval(async () => {
      const status = await api.github.checkAuth();
      if (status.authenticated) {
        clearInterval(poll);
        setLoginState('idle');
        setDeviceCode('');
        onRefreshGh();
      }
    }, 3000);

    // Timeout after 2 minutes
    setTimeout(() => {
      clearInterval(poll);
      if (loginState === 'polling') setLoginState('idle');
    }, 120000);
  }

  async function handleAgentLogin(agentType: AgentType) {
    await api.agent.login(agentType);
  }

  // Which agents are installed?
  const installedAgents = agentStatuses
    ? (['claude', 'gemini', 'codex'] as AgentType[]).filter((a) => agentStatuses[a]?.installed)
    : [];

  return (
    <motion.div variants={stepVariants} initial="initial" animate="animate" exit="exit">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          Connect your accounts
        </h2>
        <p className="text-sm text-text-muted">
          Link your services to create and manage projects. All optional.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* GitHub card */}
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-white/[0.05] flex items-center justify-center">
              <svg className="w-5 h-5 text-text-secondary" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary">GitHub</h3>
              <p className="text-xs text-text-muted">Link your code repos</p>
            </div>
          </div>

          <div className="flex-1" />

          {ghAuth?.authenticated ? (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-status-ready/8 border border-status-ready/15">
              <CheckIcon className="w-4 h-4 text-status-ready shrink-0" />
              <span className="text-xs font-medium text-status-ready">
                Connected as @{ghAuth.username}
              </span>
            </div>
          ) : loginState === 'polling' && deviceCode ? (
            <div className="space-y-2">
              <p className="text-[10px] text-text-muted">Enter this code in your browser:</p>
              <div className="bg-white/5 border border-white/8 rounded-lg px-3 py-2 text-center">
                <span className="text-base font-mono font-bold text-accent tracking-wider">
                  {deviceCode}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  className="w-3 h-3 border border-white/10 border-t-accent rounded-full"
                />
                <span className="text-[10px] text-text-muted">Waiting for authorization...</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleGitHubLogin}
                disabled={loginState !== 'idle'}
                className="flex-1 px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/15 text-xs font-medium text-accent transition-colors disabled:opacity-50"
              >
                {loginState === 'waiting' ? 'Starting...' : 'Connect with GitHub'}
              </button>
            </div>
          )}
        </div>

        {/* Agent cards — only show installed agents */}
        {installedAgents.map((agentType) => {
          const config = AGENTS[agentType];
          const status = agentStatuses![agentType];

          return (
            <div key={agentType} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: config.color + '15' }}
                >
                  <AgentIcon agentType={agentType} className="w-5 h-5" style={{ color: config.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{config.displayName}</h3>
                  <p className="text-xs text-text-muted">AI coding assistant</p>
                </div>
              </div>

              <div className="flex-1" />

              {status.authenticated ? (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-status-ready/8 border border-status-ready/15">
                  <CheckIcon className="w-4 h-4 text-status-ready shrink-0" />
                  <span className="text-xs font-medium text-status-ready">Connected</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAgentLogin(agentType)}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{
                      backgroundColor: config.color + '15',
                      color: config.color,
                    }}
                  >
                    Log In
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-text-muted mb-4">
        All accounts are optional — you can connect them anytime from the sidebar.
      </p>

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Preferences
// ---------------------------------------------------------------------------

function StepPreferences({
  projectDir,
  selectedMode,
  onPickDir,
  onSetMode,
  onDirChange,
  onNext,
  onBack,
}: {
  projectDir: string;
  selectedMode: AppMode;
  onPickDir: () => void;
  onSetMode: (m: AppMode) => void;
  onDirChange: (d: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <motion.div variants={stepVariants} initial="initial" animate="animate" exit="exit">
      <div className="text-center mb-6">
        <h2 className="text-lg font-bold text-text-primary mb-1">
          Almost done — a few quick preferences
        </h2>
      </div>

      {/* Project directory */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 mb-4">
        <label className="block text-xs font-medium text-text-muted mb-2">
          Where should projects be saved?
        </label>
        <div className="flex gap-2 mb-2">
          <input
            value={projectDir}
            onChange={(e) => onDirChange(e.target.value)}
            className="flex-1 bg-white/5 border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50 transition-colors font-mono"
          />
          <button
            onClick={onPickDir}
            className="shrink-0 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-text-secondary transition-colors"
          >
            Change...
          </button>
        </div>
        <p className="text-xs text-text-muted">
          This is the folder where your coding projects will live.
        </p>
      </div>

      {/* Experience mode */}
      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 mb-6">
        <label className="block text-xs font-medium text-text-muted mb-3">
          How technical are you?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => onSetMode('simple')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedMode === 'simple'
                ? 'border-accent bg-accent/5'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
            }`}
          >
            <div className="text-2xl mb-2">&#x1F331;</div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">I'm new to coding</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              I'll use friendly language and guide you through everything
            </p>
            {selectedMode === 'simple' && (
              <div className="mt-2">
                <CheckIcon className="w-4 h-4 text-accent" />
              </div>
            )}
          </button>

          <button
            onClick={() => onSetMode('developer')}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              selectedMode === 'developer'
                ? 'border-accent bg-accent/5'
                : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]'
            }`}
          >
            <div className="text-2xl mb-2">&#x1F4BB;</div>
            <h4 className="text-sm font-semibold text-text-primary mb-1">I'm a developer</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Show me the technical details. I know my way around a terminal
            </p>
            {selectedMode === 'developer' && (
              <div className="mt-2">
                <CheckIcon className="w-4 h-4 text-accent" />
              </div>
            )}
          </button>
        </div>
        <p className="text-xs text-text-muted mt-3">
          Can be changed anytime in Settings.
        </p>
      </div>

      <WizardNav onBack={onBack} onNext={onNext} nextLabel="Continue" />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Ready
// ---------------------------------------------------------------------------

function StepReady({
  onFinish,
}: {
  onFinish: (opts?: { startTutorial?: boolean; openWizard?: boolean }) => void;
}) {
  return (
    <motion.div variants={stepVariants} initial="initial" animate="animate" exit="exit" className="text-center py-10">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
        className="text-5xl mb-4"
      >
        &#x1F389;
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-xl font-bold text-text-primary mb-2"
      >
        You're all set!
      </motion.h2>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-sm text-text-muted mb-8"
      >
        Let's create your first project.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="space-y-3"
      >
        <button
          onClick={() => onFinish({ openWizard: true, startTutorial: true })}
          className="px-8 py-3 rounded-xl bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all hover:shadow-[0_0_24px_var(--color-accent-glow)] flex items-center gap-2 mx-auto"
        >
          Create My First Project
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>

        <button
          onClick={() => onFinish()}
          className="text-xs text-text-muted hover:text-text-secondary transition-colors"
        >
          Go to Dashboard
        </button>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function WizardNav({
  onBack,
  onNext,
  nextLabel = 'Continue',
}: {
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 4L6 8l4 4" />
        </svg>
        Back
      </button>
      <button
        onClick={onNext}
        className="px-6 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-colors"
      >
        {nextLabel}
      </button>
    </div>
  );
}

function DepRow({ dep, onInstall }: { dep: DependencyStatus; onInstall: () => void }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
        dep.installed ? 'bg-status-ready/10' : 'bg-white/[0.04]'
      }`}>
        {dep.installed ? (
          <CheckIcon className="w-4 h-4 text-status-ready" />
        ) : (
          <WarningIcon className="w-4 h-4 text-amber-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{dep.name}</span>
          {dep.installed && dep.version && (
            <span className="text-xs text-text-muted">
              {dep.version.match(/(\d+\.\d+\.\d+)/)?.[1] ?? dep.version}
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5">
          {dep.installed ? 'Ready' : dep.description}
        </p>
      </div>
      {!dep.installed && (
        <div className="flex items-center gap-2">
          <button
            onClick={onInstall}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-xs font-medium text-accent transition-colors"
          >
            Install Now
          </button>
          <span className="text-[10px] text-text-muted">or skip</span>
        </div>
      )}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function AgentIcon({ agentType, className, style }: { agentType: AgentType; className?: string; style?: React.CSSProperties }) {
  const cls = className || 'w-4 h-4';
  switch (agentType) {
    case 'claude':
      return (
        <svg className={cls} style={style} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1" y="2" width="14" height="12" rx="2" />
          <polyline points="4 7 6 9 4 11" />
          <line x1="8" y1="11" x2="12" y2="11" />
        </svg>
      );
    case 'gemini':
      return (
        <svg className={cls} style={style} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C8 4.42 4.42 8 0 8c4.42 0 8 3.58 8 8 0-4.42 3.58-8 8-8-4.42 0-8-3.58-8-8z" />
        </svg>
      );
    case 'codex':
      return (
        <svg className={cls} style={style} viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0L14.93 4v8L8 16 1.07 12V4L8 0zm0 1.6L2.47 4.8v6.4L8 14.4l5.53-3.2V4.8L8 1.6z" />
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      );
  }
}
