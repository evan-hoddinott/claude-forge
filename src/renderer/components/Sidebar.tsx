import { motion } from 'framer-motion';
import type { Page } from '../App';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewProject: () => void;
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  collapsed,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        active
          ? 'bg-white/8 text-text-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
      }`}
    >
      <span className="shrink-0 w-5 h-5 flex items-center justify-center">
        {icon}
      </span>
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

export default function Sidebar({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onNewProject,
}: SidebarProps) {
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full flex flex-col border-r border-white/6 bg-surface overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-accent/12 flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4 text-accent"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M3 10h10v1.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 013 11.5V10z" />
            <path d="M2 8.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5V10H2V8.5z" />
            <path
              d="M4.5 5h7a1.5 1.5 0 011.5 1.5V8H3V6.5A1.5 1.5 0 014.5 5z"
              opacity="0.6"
            />
            <rect x="6" y="13" width="4" height="1.5" rx="0.5" />
          </svg>
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight whitespace-nowrap text-text-primary">
            Claude Forge
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        <NavItem
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <rect x="1.5" y="1.5" width="5" height="5" rx="1.2" />
              <rect x="9.5" y="1.5" width="5" height="5" rx="1.2" />
              <rect x="1.5" y="9.5" width="5" height="5" rx="1.2" />
              <rect x="9.5" y="9.5" width="5" height="5" rx="1.2" />
            </svg>
          }
          label="Dashboard"
          active={activePage === 'dashboard'}
          onClick={() => onNavigate('dashboard')}
          collapsed={collapsed}
        />
        <NavItem
          icon={
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              className="w-4 h-4"
            >
              <line x1="2" y1="5" x2="14" y2="5" />
              <line x1="2" y1="11" x2="14" y2="11" />
              <circle cx="5.5" cy="5" r="1.8" fill="currentColor" />
              <circle cx="10.5" cy="11" r="1.8" fill="currentColor" />
            </svg>
          }
          label="Settings"
          active={activePage === 'settings'}
          onClick={() => onNavigate('settings')}
          collapsed={collapsed}
        />
      </nav>

      {/* New Project Button */}
      <div className="px-2 py-2 shrink-0">
        <button
          onClick={onNewProject}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-semibold transition-all hover:shadow-[0_0_20px_var(--color-accent-glow)]"
        >
          <svg
            className="w-4 h-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          {!collapsed && <span className="whitespace-nowrap">New Project</span>}
        </button>
      </div>

      {/* GitHub Connection Status */}
      <div className="px-3 py-3 border-t border-white/6 shrink-0">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-text-muted shrink-0"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          {!collapsed && (
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-status-ready" />
              Connected
            </div>
          )}
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggleCollapse}
        className="flex items-center justify-center py-2.5 border-t border-white/6 text-text-muted hover:text-text-secondary transition-colors shrink-0"
      >
        <motion.svg
          animate={{ rotate: collapsed ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 4L6 8l4 4" />
        </motion.svg>
      </button>
    </motion.aside>
  );
}
