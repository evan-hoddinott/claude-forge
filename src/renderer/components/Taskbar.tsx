import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { WindowTab } from '../App';
import { useAPI } from '../hooks/useAPI';
import type { AgentType, AgentStatus } from '../../shared/types';
import { AGENTS } from '../../shared/types';

interface TaskbarProps {
  windowTabs: WindowTab[];
  activeWindowId: string;
  onSwitchWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onNavigate: (dest: 'settings' | 'hub' | 'store') => void;
  onNewProject: () => void;
}

const AGENT_ABBREVS: { type: AgentType; abbr: string }[] = [
  { type: 'claude', abbr: 'CC' },
  { type: 'gemini', abbr: 'GC' },
  { type: 'codex', abbr: 'CX' },
];

const AGENT_COLORS: Record<AgentType, string> = {
  claude:  'var(--agent-claude)',
  gemini:  'var(--agent-gemini)',
  codex:   'var(--agent-codex)',
  copilot: 'var(--agent-copilot)',
  ollama:  'var(--agent-ollama)',
};

function useCurrentTime() {
  const [time, setTime] = useState(() => formatTime(new Date()));
  useEffect(() => {
    const tick = () => setTime(formatTime(new Date()));
    const now = Date.now();
    const delay = 1000 - (now % 1000);
    const t = setTimeout(() => {
      tick();
      const iv = setInterval(tick, 1000);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t);
  }, []);
  return time;
}

function formatTime(d: Date) {
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function AgentStatusDots() {
  const api = useAPI();
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>({});

  useEffect(() => {
    let mounted = true;
    // Defer status check by 3 seconds to not block startup
    const timer = setTimeout(() => {
      api.agent.checkAllStatuses().then((s) => {
        if (mounted) setStatuses(s);
      }).catch(() => {});
    }, 3000);
    return () => { mounted = false; clearTimeout(timer); };
  }, [api]);

  return (
    <>
      {AGENT_ABBREVS.map(({ type, abbr }) => {
        const s = statuses[type];
        const dotClass = s?.installed && s?.authenticated ? 'online' : 'offline';
        return (
          <span
            key={type}
            className="station-agent-dot"
            title={`${AGENTS[type]?.displayName ?? abbr} — ${dotClass}`}
          >
            <span
              className={`station-agent-dot-indicator ${dotClass}`}
              style={dotClass === 'online' ? { background: AGENT_COLORS[type], borderColor: AGENT_COLORS[type] } : undefined}
            />
            <span style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 8 }}>{abbr}</span>
          </span>
        );
      })}
    </>
  );
}

function StartMenu({
  onClose,
  onNavigate,
  onNewProject,
}: {
  onClose: () => void;
  onNavigate: (dest: 'settings' | 'hub' | 'store') => void;
  onNewProject: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  function item(icon: string, label: string, onClick: () => void) {
    return (
      <button className="station-start-menu-item" onClick={() => { onClick(); onClose(); }}>
        <span className="station-start-menu-item-icon">{icon}</span>
        {label}
      </button>
    );
  }

  return (
    <motion.div
      ref={ref}
      className="station-start-menu"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
    >
      <div className="station-start-menu-header">C&nbsp;&nbsp;A&nbsp;&nbsp;B&nbsp;&nbsp;O&nbsp;&nbsp;O</div>

      <div className="station-start-menu-section">
        {item('📋', 'Dashboard', () => {})}
        {item('🎟️', 'New Project', onNewProject)}
      </div>

      <div className="station-start-menu-section">
        {item('🏪', 'Caboo Hub', () => onNavigate('hub'))}
        {item('🛍️', 'Skills Store', () => onNavigate('store'))}
      </div>

      <div className="station-start-menu-section">
        {item('🔧', 'Settings', () => onNavigate('settings'))}
      </div>
    </motion.div>
  );
}

function WindowTabButton({
  tab,
  active,
  onSwitch,
  onClose,
}: {
  tab: WindowTab;
  active: boolean;
  onSwitch: () => void;
  onClose: () => void;
}) {
  const isDashboard = tab.type === 'dashboard';
  const icon = TAB_ICONS[tab.type] ?? '□';

  return (
    <div
      className={`station-taskbar-tab ${active ? 'active' : ''}`}
      onClick={onSwitch}
      title={tab.label}
    >
      <span style={{ fontSize: 11, flexShrink: 0 }}>{icon}</span>
      <span className="station-taskbar-tab-label">{tab.label}</span>
      {!isDashboard && (
        <button
          className="station-taskbar-tab-close"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          title="Close"
        >
          ×
        </button>
      )}
    </div>
  );
}

const TAB_ICONS: Record<string, string> = {
  dashboard: '📋',
  settings: '🔧',
  hub: '🏪',
  store: '🛍️',
  project: '📁',
};

export default function Taskbar({
  windowTabs,
  activeWindowId,
  onSwitchWindow,
  onCloseWindow,
  onNavigate,
  onNewProject,
}: TaskbarProps) {
  const [startOpen, setStartOpen] = useState(false);
  const time = useCurrentTime();

  const toggleStart = useCallback(() => setStartOpen((v) => !v), []);

  return (
    <div className="station-taskbar titlebar-no-drag">
      {/* Start button */}
      <button
        className={`station-start-btn ${startOpen ? 'open' : ''}`}
        onClick={toggleStart}
      >
        <span style={{ fontSize: 14 }}>🚂</span>
        <span>START</span>
      </button>

      {/* Window tabs */}
      <div className="station-taskbar-tabs">
        {windowTabs.map((tab) => (
          <WindowTabButton
            key={tab.id}
            tab={tab}
            active={tab.id === activeWindowId}
            onSwitch={() => onSwitchWindow(tab.id)}
            onClose={() => onCloseWindow(tab.id)}
          />
        ))}
      </div>

      {/* Right section: agents + clock */}
      <div className="station-taskbar-right">
        <AgentStatusDots />
        <div
          className="station-taskbar-clock"
          style={{ borderLeft: '1px solid var(--station-border)', paddingLeft: 10, marginLeft: 4 }}
        >
          {time}
        </div>
      </div>

      {/* Start menu overlay */}
      <AnimatePresence>
        {startOpen && (
          <StartMenu
            onClose={() => setStartOpen(false)}
            onNavigate={onNavigate}
            onNewProject={onNewProject}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
