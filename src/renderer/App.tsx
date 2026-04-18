import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TitleBar from './components/TitleBar';
import Taskbar from './components/Taskbar';
import ContextMenu from './components/ContextMenu';
import UpdateNotification from './components/UpdateNotification';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import { useToast } from './components/Toast';
import { useAPI, useQuery } from './hooks/useAPI';
import { useReduceMotion } from './hooks/usePerformance';
import type { Project, AppMode } from '../shared/types';

const NewProjectWizard = lazy(() => import('./components/NewProjectWizard'));
const ImportProjectDialog = lazy(() => import('./components/ImportProjectDialog'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const SetupAssistant = lazy(() => import('./components/SetupAssistant'));
const OnboardingTutorial = lazy(() => import('./components/OnboardingTutorial'));
const Settings = lazy(() => import('./pages/Settings'));
const Store = lazy(() => import('./pages/Store'));
const Hub = lazy(() => import('./pages/Hub'));
const SplashScreen = lazy(() => import('./components/SplashScreen'));
const ChatPanel = lazy(() => import('./components/ChatPanel'));
const ExportVibeDialog = lazy(() => import('./components/ExportVibeDialog'));
const ImportVibeDialog = lazy(() => import('./components/ImportVibeDialog'));
const ExportSnapshotDialog = lazy(() => import('./components/ExportSnapshotDialog'));
const ImportSnapshotDialog = lazy(() => import('./components/ImportSnapshotDialog'));

export type Page = 'dashboard' | 'settings' | 'store' | 'hub';

export interface WindowTab {
  id: string;
  type: 'dashboard' | 'settings' | 'hub' | 'store' | 'project';
  label: string;
  projectId?: string;
}

const DASHBOARD_TAB: WindowTab = { id: 'dashboard', type: 'dashboard', label: 'Dashboard' };

const PAGE_LABELS: Record<string, string> = {
  settings: 'Settings',
  hub: 'Caboo Hub',
  store: 'Skills Store',
};

const slideVariantsAnimated = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, x: -16, transition: { duration: 0.12 } },
};

const slideVariantsInstant = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.05 } },
};

const LazyFallback = (
  <div className="h-full flex items-center justify-center">
    <span className="station-loading-train">
      <span className="station-loading-train-icon">🚂</span>
      <span>Loading tracks...</span>
    </span>
  </div>
);

export default function App() {
  return <AppInner />;
}

function AppInner() {
  const api = useAPI();
  const { toast } = useToast();
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    document.documentElement.classList.add('theme-caboo');
  }, []);

  const slideVariants = reduceMotion ? slideVariantsInstant : slideVariantsAnimated;

  // Window management
  const [windowTabs, setWindowTabs] = useState<WindowTab[]>([DASHBOARD_TAB]);
  const [activeWindowId, setActiveWindowId] = useState('dashboard');

  // UI state
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState<'local' | 'clone' | null>(null);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('simple');
  const [showSplash, setShowSplash] = useState(false);
  const [chatPanelOpen, setChatPanelOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [exportVibeProject, setExportVibeProject] = useState<Project | null>(null);
  const [showImportVibe, setShowImportVibe] = useState(false);
  const [exportSnapshotProject, setExportSnapshotProject] = useState<Project | null>(null);
  const [showImportSnapshot, setShowImportSnapshot] = useState(false);

  const { data: allProjects } = useQuery(() => api.projects.list(), [refreshKey]);

  // Preferences / setup check on load
  useEffect(() => {
    api.preferences.get().then((prefs) => {
      if (!prefs.setupCompleted) setShowSetup(true);
      setAppMode(prefs.mode || 'simple');
      if (prefs.showSplash !== false) setShowSplash(true);
      setSetupChecked(true);
    }).catch(() => setSetupChecked(true));
  }, [api]);

  useEffect(() => {
    function handleOpenSetup()    { setShowSetup(true); }
    function handleOpenTutorial() { setShowTutorial(true); }
    window.addEventListener('open-setup-assistant', handleOpenSetup);
    window.addEventListener('open-tutorial', handleOpenTutorial);
    return () => {
      window.removeEventListener('open-setup-assistant', handleOpenSetup);
      window.removeEventListener('open-tutorial', handleOpenTutorial);
    };
  }, []);

  useEffect(() => {
    api.ollama.onConnectivity(({ online }: { online: boolean }) => setIsOffline(!online));
    return () => api.ollama.offConnectivity();
  }, [api]);

  useEffect(() => {
    api.ghostTest.onAutoResult(({ result }) => {
      if (result.status === 'passed') {
        toast('Ghost test passed — all clear', 'success');
      } else if (result.status === 'auto-fixed') {
        toast(`Ghost test passed — ${result.fixDescription ?? 'auto-fixed'}`, 'success');
      } else if (result.status === 'timeout') {
        toast('Ghost test timed out — code may have a long-running process', 'info');
      } else {
        toast('Ghost test found issues — open the project to see details', 'error');
      }
    });
    return () => { api.ghostTest.offAutoResult(); };
  }, [api, toast]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    project: Project;
  } | null>(null);

  // ── Window management helpers ────────────────────────────────────────────

  function openWindow(tab: WindowTab) {
    setWindowTabs((prev) => {
      if (prev.find((t) => t.id === tab.id)) return prev;
      return [...prev, tab];
    });
    setActiveWindowId(tab.id);
  }

  function closeWindow(id: string) {
    if (id === 'dashboard') return;
    setWindowTabs((prev) => prev.filter((t) => t.id !== id));
    if (activeWindowId === id) setActiveWindowId('dashboard');
  }

  function handleNavigate(dest: 'settings' | 'hub' | 'store') {
    openWindow({ id: dest, type: dest, label: PAGE_LABELS[dest] });
  }

  function handleOpenProject(id: string) {
    const project = allProjects?.find((p) => p.id === id);
    openWindow({
      id: `project-${id}`,
      type: 'project',
      label: project?.name ?? 'Project',
      projectId: id,
    });
  }

  function handleBackToDashboard() {
    setActiveWindowId('dashboard');
    setRefreshKey((k) => k + 1);
  }

  function handleProjectCreated() {
    setRefreshKey((k) => k + 1);
    setShowWizard(false);
    toast('Project created successfully');
  }

  // ── Context menu ─────────────────────────────────────────────────────────

  const handleContextMenu = useCallback((x: number, y: number, project: Project) => {
    setContextMenu({ x, y, project });
  }, []);

  const handleContextMenuExportVibe = useCallback((project: Project) => {
    setExportVibeProject(project);
    setContextMenu(null);
  }, []);

  const handleContextMenuExportSnapshot = useCallback((project: Project) => {
    setExportSnapshotProject(project);
    setContextMenu(null);
  }, []);

  const handleContextMenuDelete = useCallback(async (id: string) => {
    try {
      await api.projects.delete(id);
      toast('Project deleted');
      setRefreshKey((k) => k + 1);
    } catch {
      toast('Failed to delete project', 'error');
    }
    setContextMenu(null);
  }, [api, toast]);

  // ── Setup ────────────────────────────────────────────────────────────────

  function handleSetupComplete(opts?: { startTutorial?: boolean; openWizard?: boolean }) {
    setShowSetup(false);
    api.preferences.get().then((prefs) => setAppMode(prefs.mode || 'simple'));
    if (opts?.startTutorial) setShowTutorial(true);
    if (opts?.openWizard) setTimeout(() => setShowWizard(true), 400);
  }

  async function handleTutorialComplete() {
    setShowTutorial(false);
    await api.preferences.update({ tutorialCompleted: true });
  }

  // ── Keyboard shortcuts ───────────────────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }
      if (mod && e.key === 'n') {
        e.preventDefault();
        setShowWizard(true);
        return;
      }
      if (mod && e.key === ',') {
        e.preventDefault();
        handleNavigate('settings');
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setChatPanelOpen((v) => !v);
        return;
      }
      if (mod && e.key === 'f') {
        e.preventDefault();
        const el = document.getElementById('dashboard-search') as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
        return;
      }
      if (e.key === 'Escape') {
        if (showCommandPalette) { setShowCommandPalette(false); return; }
        if (contextMenu)        { setContextMenu(null); return; }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, contextMenu]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Determine active window content ──────────────────────────────────────

  const activeTab = windowTabs.find((t) => t.id === activeWindowId) ?? DASHBOARD_TAB;
  const activeProjectId = activeTab.type === 'project' ? (activeTab.projectId ?? null) : null;

  // ── Render ───────────────────────────────────────────────────────────────

  if (!setupChecked) return null;

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <TitleBar onToggleChat={() => setChatPanelOpen((v) => !v)} />
      <UpdateNotification mode={appMode} />

      {isOffline && (
        <div className="shrink-0 px-4 py-1 text-[10px] font-mono flex items-center gap-2"
          style={{ background: 'rgba(212,160,57,0.12)', borderBottom: '1px solid var(--station-signal-amber)', color: 'var(--station-signal-amber)' }}>
          <span>✈</span>
          <span>OFFLINE — using local models. Cloud features paused.</span>
        </div>
      )}

      {/* Main content — full width */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeWindowId}
            variants={slideVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="h-full"
          >
            {activeTab.type === 'project' && activeProjectId ? (
              <ProjectDetail
                projectId={activeProjectId}
                onBack={handleBackToDashboard}
              />
            ) : activeTab.type === 'dashboard' ? (
              <Dashboard
                key={`dashboard-${refreshKey}`}
                onNewProject={() => setShowWizard(true)}
                onImportProject={(mode) => setShowImport(mode)}
                onImportBundle={() => setShowImportVibe(true)}
                onImportSnapshot={() => setShowImportSnapshot(true)}
                onOpenProject={handleOpenProject}
                onContextMenu={handleContextMenu}
              />
            ) : activeTab.type === 'store' ? (
              <Suspense fallback={LazyFallback}>
                <Store projects={allProjects ?? []} />
              </Suspense>
            ) : activeTab.type === 'hub' ? (
              <Suspense fallback={LazyFallback}>
                <Hub projects={allProjects ?? []} />
              </Suspense>
            ) : (
              <Suspense fallback={LazyFallback}>
                <Settings />
              </Suspense>
            )}
          </motion.div>
        </AnimatePresence>

        <Suspense fallback={null}>
          <ChatPanel
            open={chatPanelOpen}
            onClose={() => setChatPanelOpen(false)}
            projectId={activeProjectId}
          />
        </Suspense>
      </main>

      {/* Bottom Taskbar */}
      <Taskbar
        windowTabs={windowTabs}
        activeWindowId={activeWindowId}
        onSwitchWindow={setActiveWindowId}
        onCloseWindow={closeWindow}
        onNavigate={handleNavigate}
        onNewProject={() => setShowWizard(true)}
      />

      {/* Modals */}
      <Suspense fallback={null}>
        {showWizard && (
          <NewProjectWizard
            open={showWizard}
            onClose={() => setShowWizard(false)}
            onCreated={handleProjectCreated}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showImport && (
          <ImportProjectDialog
            mode={showImport}
            onClose={() => setShowImport(null)}
            onImported={(project) => {
              setShowImport(null);
              setRefreshKey((k) => k + 1);
              handleOpenProject(project.id);
              toast(`"${project.name}" imported successfully`);
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showCommandPalette && (
          <CommandPalette
            open={showCommandPalette}
            onClose={() => setShowCommandPalette(false)}
            onNewProject={() => { setShowCommandPalette(false); setShowWizard(true); }}
            onNavigate={(page) => { setShowCommandPalette(false); handleNavigate(page as 'settings' | 'hub' | 'store'); }}
            onOpenProject={(id) => { setShowCommandPalette(false); handleOpenProject(id); }}
            activeProjectId={activeProjectId}
            onStartConductor={(projectId) => {
              setShowCommandPalette(false);
              handleOpenProject(projectId);
            }}
          />
        )}
      </Suspense>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={contextMenu.project}
          onClose={() => setContextMenu(null)}
          onDelete={handleContextMenuDelete}
          onExportVibe={handleContextMenuExportVibe}
          onExportSnapshot={handleContextMenuExportSnapshot}
        />
      )}

      <Suspense fallback={null}>
        {showSetup && <SetupAssistant onComplete={handleSetupComplete} />}
      </Suspense>

      <Suspense fallback={null}>
        {showTutorial && !showSetup && (
          <OnboardingTutorial
            mode={appMode}
            onComplete={handleTutorialComplete}
            onRequestNewProject={() => setShowWizard(true)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </Suspense>

      <Suspense fallback={null}>
        {exportVibeProject && (
          <ExportVibeDialog
            project={exportVibeProject}
            onClose={() => setExportVibeProject(null)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showImportVibe && (
          <ImportVibeDialog
            onClose={() => setShowImportVibe(false)}
            onImported={(project) => {
              setShowImportVibe(false);
              if (project) {
                setRefreshKey((k) => k + 1);
                handleOpenProject(project.id);
              }
            }}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {exportSnapshotProject && (
          <ExportSnapshotDialog
            project={exportSnapshotProject}
            onClose={() => setExportSnapshotProject(null)}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showImportSnapshot && (
          <ImportSnapshotDialog
            onClose={() => setShowImportSnapshot(false)}
            onImported={(project) => {
              setShowImportSnapshot(false);
              setRefreshKey((k) => k + 1);
              handleOpenProject(project.id);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
