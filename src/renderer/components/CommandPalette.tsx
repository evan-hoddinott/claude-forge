import { useState, useEffect, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import type { Page } from '../App';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  section: 'action' | 'project';
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onNewProject: () => void;
  onNavigate: (page: Page) => void;
  onOpenProject: (id: string) => void;
  onStartConductor?: (projectId: string) => void;
  activeProjectId?: string | null;
}

export default function CommandPalette({
  open,
  onClose,
  onNewProject,
  onNavigate,
  onOpenProject,
  onStartConductor,
  activeProjectId,
}: CommandPaletteProps) {
  const api = useAPI();
  const { data: projects } = useQuery(() => api.projects.list());
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo(() => {
    const actions: CommandItem[] = [
      {
        id: 'new-project',
        label: 'New Project',
        hint: 'Ctrl+N',
        section: 'action',
        icon: <PlusIcon />,
        action: () => { onNewProject(); onClose(); },
      },
      {
        id: 'settings',
        label: 'Open Settings',
        hint: 'Ctrl+,',
        section: 'action',
        icon: <SettingsIcon />,
        action: () => { onNavigate('settings'); onClose(); },
      },
      {
        id: 'dashboard',
        label: 'Go to Dashboard',
        section: 'action',
        icon: <GridIcon />,
        action: () => { onNavigate('dashboard'); onClose(); },
      },
      ...(onStartConductor && activeProjectId ? [{
        id: 'conductor-start',
        label: '🚂 Start Conductor',
        hint: 'AI orchestration',
        section: 'action' as const,
        icon: <TrainIcon />,
        action: () => { onStartConductor(activeProjectId); onClose(); },
      }] : []),
    ];

    const projectItems: CommandItem[] = (projects || [])
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((p) => ({
        id: p.id,
        label: p.name,
        hint: p.description || p.path,
        section: 'project' as const,
        icon: <FolderIcon />,
        action: () => { onOpenProject(p.id); onClose(); },
      }));

    const all = [...actions, ...projectItems];
    if (!query.trim()) return all;

    const q = query.toLowerCase();
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.hint?.toLowerCase().includes(q),
    );
  }, [query, projects, onNewProject, onNavigate, onOpenProject, onClose, onStartConductor, activeProjectId]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const el = list.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && items[selectedIndex]) {
      e.preventDefault();
      items[selectedIndex].action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -8 }}
          transition={{ duration: 0.15 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full max-w-lg rounded-xl bg-surface border border-white/[0.1] shadow-2xl overflow-hidden"
        >
          {/* Search */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
            <SearchIcon />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search projects and actions..."
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <kbd className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-text-muted font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">
                No results found
              </div>
            ) : (
              items.map((item, i) => {
                const prevSection = i > 0 ? items[i - 1].section : null;
                const showHeader = item.section !== prevSection;
                return (
                  <div key={item.id}>
                    {showHeader && (
                      <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                        {item.section === 'action' ? 'Actions' : 'Projects'}
                      </div>
                    )}
                    <button
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === selectedIndex
                          ? 'bg-white/[0.06]'
                          : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className="shrink-0 w-5 h-5 flex items-center justify-center text-text-muted">
                        {item.icon}
                      </span>
                      <span className="flex-1 text-sm text-text-primary truncate">
                        {item.label}
                      </span>
                      {item.hint && (
                        <span className="text-xs text-text-muted truncate max-w-[180px]">
                          {item.hint}
                        </span>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-4 px-4 py-2 border-t border-white/[0.06] text-[10px] text-text-muted">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 font-mono">&uarr;&darr;</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-white/5 font-mono">&crarr;</kbd>
              select
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

function SearchIcon() {
  return (
    <svg className="w-4 h-4 text-text-muted shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="2" y1="5" x2="14" y2="5" />
      <line x1="2" y1="11" x2="14" y2="11" />
      <circle cx="5.5" cy="5" r="1.8" fill="currentColor" />
      <circle cx="10.5" cy="11" r="1.8" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1.2" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1.2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4.5A1.5 1.5 0 013.5 3h2.379a1.5 1.5 0 011.06.44l.622.62a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 6v5.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5v-7z" />
    </svg>
  );
}

function TrainIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 10h2l1-4h8l1 4h2v1H1v-1zm3.5-4L6 3h4l1.5 3H4.5z" />
      <circle cx="4" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
    </svg>
  );
}
