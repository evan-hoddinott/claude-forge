import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import ContextMenu from './components/ContextMenu';
import UpdateNotification from './components/UpdateNotification';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import { useToast } from './components/Toast';
import { useAPI, useQuery } from './hooks/useAPI';
import { useReduceMotion } from './hooks/usePerformance';
import type { Project, AppMode } from '../shared/types';

// Lazy-load heavy components that aren't needed on initial render
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

const pageVariantsAnimated = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

const pageVariantsInstant = {
  initial: { opacity: 1 },
  animate: { opacity: 1 },
  exit: { opacity: 0, transition: { duration: 0.05 } },
};

const LazyFallback = <div className="h-full" />;

export default function App() {
  return <AppInner />;
}

function AppInner() {
  const api = useAPI();
  const { toast } = useToast();
  const reduceMotion = useReduceMotion();

  // Always apply caboo theme class
  useEffect(() => {
    document.documentElement.classList.add('theme-caboo');
  }, []);
  const pageVariants = reduceMotion ? pageVariantsInstant : pageVariantsAnimated;
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  // Projects list used by the Store page
  const { data: allProjects } = useQuery(() => api.projects.list(), [refreshKey]);

  // Check if setup has been completed on first load
  useEffect(() => {
    api.preferences.get().then((prefs) => {
      if (!prefs.setupCompleted) {
        setShowSetup(true);
      }
      setAppMode(prefs.mode || 'simple');
      // Show splash if enabled
      if (prefs.showSplash !== false) {
        setShowSplash(true);
      }
      setSetupChecked(true);
    }).catch(() => {
      setSetupChecked(true);
    });
  }, [api]);

  // Listen for Settings "Run Setup Assistant" button
  useEffect(() => {
    function handleOpenSetup() {
      setShowSetup(true);
    }
    function handleOpenTutorial() {
      setShowTutorial(true);
    }
    window.addEventListener('open-setup-assistant', handleOpenSetup);
    window.addEventListener('open-tutorial', handleOpenTutorial);
    return () => {
      window.removeEventListener('open-setup-assistant', handleOpenSetup);
      window.removeEventListener('open-tutorial', handleOpenTutorial);
    };
  }, []);

  // Listen for connectivity changes
  useEffect(() => {
    api.ollama.onConnectivity(({ online }: { online: boolean }) => setIsOffline(!online));
    return () => api.ollama.offConnectivity();
  }, [api]);

  // Listen for auto ghost test results (triggered after agent sessions)
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
    return () => {
      api.ghostTest.offAutoResult();
    };
  }, [api, toast]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    project: Project;
  } | null>(null);

  function handleProjectCreated() {
    setRefreshKey((k) => k + 1);
    setShowWizard(false);
    toast('Project created successfully');
  }

  function handleNewProject() {
    setShowWizard(true);
  }

  function handleNavigate(page: Page) {
    setActivePage(page);
    setSelectedProjectId(null);
  }

  function handleBackToDashboard() {
    setSelectedProjectId(null);
    setRefreshKey((k) => k + 1);
  }

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

  function handleSetupComplete(opts?: { startTutorial?: boolean; openWizard?: boolean }) {
    setShowSetup(false);
    // Refresh mode preference
    api.preferences.get().then((prefs) => {
      setAppMode(prefs.mode || 'simple');
    });
    if (opts?.startTutorial) {
      setShowTutorial(true);
    }
    if (opts?.openWizard) {
      // Delay slightly so the tutorial overlay is ready
      setTimeout(() => setShowWizard(true), 400);
    }
  }

  async function handleTutorialComplete() {
    setShowTutorial(false);
    await api.preferences.update({ tutorialCompleted: true });
  }

  // Global keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;

      // Cmd+K → Command palette
      if (mod && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }

      // Cmd+N → New project
      if (mod && e.key === 'n') {
        e.preventDefault();
        setShowWizard(true);
        return;
      }

      // Cmd+, → Settings
      if (mod && e.key === ',') {
        e.preventDefault();
        setActivePage('settings');
        setSelectedProjectId(null);
        return;
      }

      // Ctrl+Shift+C → Toggle chat panel
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        setChatPanelOpen((v) => !v);
        return;
      }

      // Cmd+F → Focus search
      if (mod && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('dashboard-search') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // Escape → Close modals / go back
      if (e.key === 'Escape') {
        if (showCommandPalette) {
          setShowCommandPalette(false);
          return;
        }
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        // Note: wizard and other modals handle their own Escape
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCommandPalette, contextMenu]);

  return (
    <div className="flex flex-col h-screen bg-bg overflow-hidden">
      <TitleBar onToggleChat={() => setChatPanelOpen((v) => !v)} />
      <UpdateNotification mode={appMode} />
      {isOffline && (
        <div className="shrink-0 bg-amber-900/80 border-b border-amber-600/40 px-4 py-1 text-[10px] font-mono text-amber-200 flex items-center gap-2">
          <span>✈️</span>
          <span>Offline Caboo Mode — using local models. Cloud features paused.</span>
        </div>
      )}
      <div className="flex flex-1 overflow-hidden relative">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onNewProject={handleNewProject}
          onImportProject={(mode) => setShowImport(mode)}
        />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedProjectId ? (
              <motion.div
                key={`project-${selectedProjectId}`}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                <ProjectDetail
                  projectId={selectedProjectId}
                  onBack={handleBackToDashboard}
                />
              </motion.div>
            ) : activePage === 'dashboard' ? (
              <motion.div
                key={`dashboard-${refreshKey}`}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                <Dashboard
                  onNewProject={handleNewProject}
                  onImportProject={(mode) => setShowImport(mode)}
                  onImportBundle={() => setShowImportVibe(true)}
                  onImportSnapshot={() => setShowImportSnapshot(true)}
                  onOpenProject={setSelectedProjectId}
                  onContextMenu={handleContextMenu}
                />
              </motion.div>
            ) : activePage === 'store' ? (
              <motion.div
                key="store"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                <Suspense fallback={LazyFallback}>
                  <Store projects={allProjects ?? []} />
                </Suspense>
              </motion.div>
            ) : activePage === 'hub' ? (
              <motion.div
                key="hub"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                <Suspense fallback={LazyFallback}>
                  <Hub projects={allProjects ?? []} />
                </Suspense>
              </motion.div>
            ) : (
              <motion.div
                key="settings"
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="h-full"
              >
                <Suspense fallback={LazyFallback}>
                  <Settings />
                </Suspense>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <Suspense fallback={null}>
          <ChatPanel
            open={chatPanelOpen}
            onClose={() => setChatPanelOpen(false)}
            projectId={selectedProjectId}
          />
        </Suspense>
      </div>

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
              setSelectedProjectId(project.id);
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
            onNavigate={(page) => { setShowCommandPalette(false); handleNavigate(page); }}
            onOpenProject={(id) => { setShowCommandPalette(false); setSelectedProjectId(id); }}
            activeProjectId={selectedProjectId}
            onStartConductor={(projectId) => {
              setShowCommandPalette(false);
              if (!selectedProjectId) setSelectedProjectId(projectId);
              // The ConductorOverlay is launched from ProjectDetail
              // so navigate to the project first
              setSelectedProjectId(projectId);
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
        {showSetup && (
          <SetupAssistant onComplete={handleSetupComplete} />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showTutorial && !showSetup && (
          <OnboardingTutorial
            mode={appMode}
            onComplete={handleTutorialComplete}
            onRequestNewProject={handleNewProject}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {showSplash && (
          <SplashScreen onComplete={() => setShowSplash(false)} />
        )}
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
                setSelectedProjectId(project.id);
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
              setSelectedProjectId(project.id);
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
