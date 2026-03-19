import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './components/Sidebar';
import TitleBar from './components/TitleBar';
import NewProjectWizard from './components/NewProjectWizard';
import CommandPalette from './components/CommandPalette';
import ContextMenu from './components/ContextMenu';
import SetupAssistant from './components/SetupAssistant';
import OnboardingTutorial from './components/OnboardingTutorial';
import UpdateNotification from './components/UpdateNotification';
import Dashboard from './pages/Dashboard';
import ProjectDetail from './pages/ProjectDetail';
import Settings from './pages/Settings';
import { useToast } from './components/Toast';
import { useAPI } from './hooks/useAPI';
import type { Project, AppMode } from '../shared/types';

export type Page = 'dashboard' | 'settings';

const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

export default function App() {
  const api = useAPI();
  const { toast } = useToast();
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSetup, setShowSetup] = useState(false);
  const [setupChecked, setSetupChecked] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('simple');

  // Check if setup has been completed on first load
  useEffect(() => {
    api.preferences.get().then((prefs) => {
      if (!prefs.setupCompleted) {
        setShowSetup(true);
      }
      setAppMode(prefs.mode || 'simple');
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
      <TitleBar />
      <UpdateNotification mode={appMode} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          activePage={activePage}
          onNavigate={handleNavigate}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onNewProject={handleNewProject}
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
                  onOpenProject={setSelectedProjectId}
                  onContextMenu={handleContextMenu}
                />
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
                <Settings />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <NewProjectWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={handleProjectCreated}
      />

      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNewProject={() => { setShowCommandPalette(false); setShowWizard(true); }}
        onNavigate={(page) => { setShowCommandPalette(false); handleNavigate(page); }}
        onOpenProject={(id) => { setShowCommandPalette(false); setSelectedProjectId(id); }}
      />

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={contextMenu.project}
          onClose={() => setContextMenu(null)}
          onDelete={handleContextMenuDelete}
        />
      )}

      {showSetup && (
        <SetupAssistant onComplete={handleSetupComplete} />
      )}

      {showTutorial && !showSetup && (
        <OnboardingTutorial
          mode={appMode}
          onComplete={handleTutorialComplete}
          onRequestNewProject={handleNewProject}
        />
      )}
    </div>
  );
}
