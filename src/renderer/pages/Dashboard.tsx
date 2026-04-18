import { useState, useMemo } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import SplitFlapDisplay from '../components/retro/SplitFlapDisplay';
import StationWindow from '../components/retro/StationWindow';
import type { Project, AgentType } from '../../shared/types';

// Framer Motion doesn't have a built-in motion.tr, so we cast it
const MotionTr = motion.tr as React.ComponentType<HTMLMotionProps<'tr'> & React.HTMLAttributes<HTMLTableRowElement>>;

interface DashboardProps {
  onNewProject?: () => void;
  onImportProject?: (mode: 'local' | 'clone') => void;
  onImportBundle?: () => void;
  onImportSnapshot?: () => void;
  onOpenProject?: (id: string) => void;
  onContextMenu?: (x: number, y: number, project: Project) => void;
}

type DepartureStatus = 'en-route' | 'departing' | 'arrived' | 'delayed';

function getDepartureStatus(project: Project): DepartureStatus {
  switch (project.status) {
    case 'in-progress': return 'en-route';
    case 'created':     return 'departing';
    case 'ready':       return 'arrived';
    case 'error':       return 'delayed';
    default:            return 'departing';
  }
}

function getDepartureLabel(status: DepartureStatus): string {
  switch (status) {
    case 'en-route':  return '● EN ROUTE';
    case 'departing': return '⏳ BOARDING';
    case 'arrived':   return '✓ ARRIVED';
    case 'delayed':   return '✗ DELAYED';
  }
}

function getAgentAbbr(agentType: AgentType): string {
  switch (agentType) {
    case 'claude':  return 'CLAUDE CODE';
    case 'gemini':  return 'GEMINI CLI';
    case 'codex':   return 'CODEX';
    case 'copilot': return 'COPILOT';
    case 'ollama':  return 'OLLAMA';
    default:        return 'NONE';
  }
}

function getAgentColor(agentType: AgentType): string {
  switch (agentType) {
    case 'claude':  return 'var(--agent-claude)';
    case 'gemini':  return 'var(--agent-gemini)';
    case 'codex':   return 'var(--agent-codex)';
    case 'copilot': return 'var(--agent-copilot)';
    case 'ollama':  return 'var(--agent-ollama)';
    default:        return 'var(--station-text-dim)';
  }
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

const GH_ICON = (
  <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style={{ opacity: 0.6 }}>
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

function EmptyDepartures({
  onNewProject,
  onImportProject,
}: {
  onNewProject?: () => void;
  onImportProject?: (mode: 'local' | 'clone') => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: 16 }}>
      <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 10, color: 'var(--station-text-dim)', letterSpacing: 2, textAlign: 'center', lineHeight: 2 }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>🚂</div>
        <div>THE STATION IS QUIET</div>
        <div style={{ color: 'var(--station-text-secondary)', marginTop: 4, fontSize: 9 }}>No departures scheduled.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={onNewProject}
          style={{
            padding: '8px 16px',
            background: 'var(--station-brass)',
            color: 'var(--station-bg-deep)',
            border: '2px outset var(--station-brass-bright)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: 10,
            letterSpacing: 1,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          🎟️ Schedule a Departure
        </button>
        <button
          onClick={() => onImportProject?.('local')}
          style={{
            padding: '8px 16px',
            background: 'var(--station-bg-surface)',
            color: 'var(--station-text-secondary)',
            border: '2px outset var(--station-border)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: 10,
            letterSpacing: 1,
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          📁 Import Existing
        </button>
      </div>
    </div>
  );
}

function LoadingBoard() {
  return (
    <div style={{ padding: '16px 0' }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          style={{
            height: 44,
            marginBottom: 1,
            background: `rgba(196, 162, 101, 0.03)`,
            borderBottom: '1px solid var(--station-border)',
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  );
}

export default function Dashboard({
  onNewProject,
  onImportProject,
  onOpenProject,
  onContextMenu,
}: DashboardProps) {
  const api = useAPI();
  const { data: projects, loading } = useQuery(() => api.projects.list());
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [projects, searchQuery]);

  const hasProjects = projects && projects.length > 0;

  function handleRightClick(e: React.MouseEvent, project: Project) {
    e.preventDefault();
    onContextMenu?.(e.clientX, e.clientY, project);
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--station-bg-deep)' }}>
      {/* Board Header */}
      <StationWindow
        title="DEPARTURES"
        icon="🚂"
        active
        style={{ flexShrink: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}
        contentClassName="titlebar-no-drag"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          gap: 12,
          background: 'var(--station-bg-mid)',
          borderBottom: '1px solid var(--station-border)',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--station-text-dim)', fontSize: 11, pointerEvents: 'none' }}>🔍</span>
            <input
              id="dashboard-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search departures..."
              style={{
                width: '100%',
                padding: '5px 8px 5px 26px',
                background: 'var(--station-bg-input)',
                border: '1px inset var(--station-border)',
                color: 'var(--station-text-primary)',
                fontFamily: 'var(--caboo-font-body)',
                fontSize: 11,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => onImportProject?.('local')}
              title="Import local project"
              style={{
                padding: '5px 10px',
                background: 'var(--station-bg-surface)',
                border: '1px outset var(--station-border)',
                color: 'var(--station-text-secondary)',
                fontFamily: 'var(--caboo-font-heading)',
                fontSize: 9,
                letterSpacing: 0.5,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              📁 Import
            </button>
            <button
              onClick={onNewProject}
              style={{
                padding: '5px 12px',
                background: 'var(--station-brass)',
                border: '2px outset var(--station-brass-bright)',
                color: 'var(--station-bg-deep)',
                fontFamily: 'var(--caboo-font-heading)',
                fontSize: 9,
                letterSpacing: 0.5,
                cursor: 'pointer',
                textTransform: 'uppercase',
              }}
            >
              🎟️ New Departure
            </button>
          </div>
        </div>
      </StationWindow>

      {/* Board content */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--station-bg-deep)' }}>
        {loading ? (
          <LoadingBoard />
        ) : !hasProjects ? (
          <EmptyDepartures onNewProject={onNewProject} onImportProject={onImportProject} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, color: 'var(--station-text-dim)', letterSpacing: 2 }}>
              NO TRAINS MATCHING &quot;{searchQuery.toUpperCase()}&quot;
            </div>
            <button
              onClick={() => setSearchQuery('')}
              style={{ marginTop: 12, color: 'var(--station-brass)', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'var(--caboo-font-body)' }}
            >
              Clear search
            </button>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            <table className="station-departure-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>PLT</th>
                  <th>DESTINATION</th>
                  <th style={{ width: 180 }}>STATUS</th>
                  <th style={{ width: 120 }}>AGENT</th>
                  <th style={{ width: 130 }}>TRACK</th>
                  <th style={{ width: 90 }}>LAST UPD.</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((project, index) => {
                  const status = getDepartureStatus(project);
                  const agentType = project.preferredAgent || 'claude';
                  return (
                    <MotionTr
                      key={project.id}
                      className="station-departure-row"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04, duration: 0.2 }}
                      onClick={() => onOpenProject?.(project.id)}
                      onContextMenu={(e) => handleRightClick(e, project)}
                    >
                      <td>
                        <span className="station-departure-platform">{index + 1}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="station-departure-name">{project.name}</span>
                          {project.description && (
                            <span style={{ fontSize: 10, color: 'var(--station-text-dim)', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {project.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`station-departure-status ${status}`}>
                          <SplitFlapDisplay value={getDepartureLabel(status)} />
                        </span>
                      </td>
                      <td>
                        <span style={{ color: getAgentColor(agentType), fontFamily: 'var(--caboo-font-heading)', fontSize: 9, letterSpacing: 1 }}>
                          {getAgentAbbr(agentType)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--station-text-secondary)', fontSize: 11 }}>
                        {project.githubRepo ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            {GH_ICON}
                            {project.githubRepo.split('/')[1] ?? 'main'}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ color: 'var(--station-text-dim)', fontSize: 10, whiteSpace: 'nowrap' }}>
                        {relativeTime(project.updatedAt)}
                      </td>
                    </MotionTr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>
    </div>
  );
}
