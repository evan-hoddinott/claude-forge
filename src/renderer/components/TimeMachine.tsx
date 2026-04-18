import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import type { TimeMachineSnapshot } from '../../shared/types';

interface TimeMachineProps {
  projectId: string;
  projectPath: string;
}

const SNAPSHOT_COLORS: Record<string, string> = {
  green:  'var(--caboo-accent-green)',
  red:    'var(--caboo-accent-rust)',
  blue:   'var(--caboo-status-info)',
  amber:  'var(--caboo-accent-amber)',
};

export default function TimeMachine({ projectId, projectPath }: TimeMachineProps) {
  const api = useAPI();
  const [collapsed, setCollapsed] = useState(true);
  const [hovered, setHovered] = useState<TimeMachineSnapshot | null>(null);
  const [hoveredPos, setHoveredPos] = useState({ x: 0, y: 0 });
  const [previewSnap, setPreviewSnap] = useState<TimeMachineSnapshot | null>(null);
  const [previewData, setPreviewData] = useState<{ filesChanged: string[]; diff: string } | null>(null);
  const [reverting, setReverting] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const { data: snapshots, refetch } = useQuery(
    () => api.timeMachine.getSnapshots(projectId),
    [projectId],
  );

  const list = (snapshots ?? []).slice().reverse(); // oldest first for display

  async function handleCreateSnapshot() {
    setCreatingSnapshot(true);
    try {
      await api.timeMachine.createSnapshot(projectId, projectPath, 'Manual save point');
      refetch();
    } finally {
      setCreatingSnapshot(false);
    }
  }

  async function handleRevert(snap: TimeMachineSnapshot) {
    if (!confirm(`Revert to "${snap.label}"? This will undo all changes made after this point.`)) return;
    setReverting(true);
    try {
      await api.timeMachine.revert(projectId, projectPath, snap.id);
      refetch();
      setPreviewSnap(null);
    } finally {
      setReverting(false);
    }
  }

  async function handleBackToPresent() {
    if (!confirm('Go back to the present (latest state)?')) return;
    setReverting(true);
    try {
      await api.timeMachine.backToPresent(projectId, projectPath);
      setPreviewSnap(null);
    } finally {
      setReverting(false);
    }
  }

  async function handlePreview(snap: TimeMachineSnapshot) {
    if (previewSnap?.id === snap.id) {
      setPreviewSnap(null);
      setPreviewData(null);
      return;
    }
    setPreviewSnap(snap);
    try {
      const data = await api.timeMachine.preview(projectId, projectPath, snap.id);
      setPreviewData(data);
    } catch {
      setPreviewData(null);
    }
  }

  const snapLabel = (snap: TimeMachineSnapshot) => {
    const t = new Date(snap.timestamp);
    return `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`;
  };

  return (
    <div
      className="border-b"
      style={{
        borderColor: 'var(--caboo-border)',
        background: 'var(--caboo-bg-mid)',
        fontFamily: 'var(--caboo-font-body)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
        style={{ borderBottom: collapsed ? 'none' : '1px solid var(--caboo-border)' }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--caboo-accent-amber)' }}>⏰</span>
          <span
            style={{
              color: 'var(--caboo-text-heading)',
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: '10px',
            }}
          >
            TIME MACHINE
          </span>
          {list.length > 0 && (
            <span
              className="px-1"
              style={{
                color: 'var(--caboo-text-muted)',
                fontSize: '10px',
                border: '1px solid var(--caboo-border)',
              }}
            >
              {list.length} save point{list.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleCreateSnapshot(); }}
            disabled={creatingSnapshot}
            className="px-2 py-0.5 text-[10px] transition-colors"
            style={{
              border: '1px solid var(--caboo-border)',
              color: 'var(--caboo-text-secondary)',
              background: 'transparent',
              cursor: creatingSnapshot ? 'not-allowed' : 'pointer',
            }}
            title="Create a save point now"
          >
            {creatingSnapshot ? '...' : '+ Save Point'}
          </button>
          <span
            style={{ color: 'var(--caboo-text-muted)', fontSize: '10px' }}
          >
            {collapsed ? '▼' : '▲'}
          </span>
        </div>
      </div>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 py-3">
              {list.length === 0 ? (
                <div
                  className="text-center py-4 text-[11px]"
                  style={{ color: 'var(--caboo-text-muted)' }}
                >
                  No save points yet. Save points are created automatically before/after agent sessions.
                </div>
              ) : (
                <>
                  {/* Timeline track */}
                  <div ref={trackRef} className="relative mb-3" style={{ height: '48px' }}>
                    {/* Track line */}
                    <div
                      className="absolute"
                      style={{
                        top: '12px',
                        left: '8px',
                        right: '8px',
                        height: '2px',
                        background: 'var(--caboo-border)',
                      }}
                    />

                    {/* Snapshot diamonds */}
                    {list.map((snap, idx) => {
                      const pct = list.length === 1 ? 0.5 : idx / (list.length - 1);
                      const leftPct = 8 + pct * 84; // 8% to 92%
                      const color = SNAPSHOT_COLORS[snap.color] ?? 'var(--caboo-accent-green)';

                      return (
                        <div
                          key={snap.id}
                          className="absolute cursor-pointer"
                          style={{
                            left: `${leftPct}%`,
                            top: '5px',
                            transform: 'translateX(-50%)',
                          }}
                          onMouseEnter={(e) => {
                            setHovered(snap);
                            const rect = trackRef.current?.getBoundingClientRect();
                            if (rect) {
                              setHoveredPos({ x: e.clientX - rect.left, y: 0 });
                            }
                          }}
                          onMouseLeave={() => setHovered(null)}
                          onClick={() => handlePreview(snap)}
                        >
                          {/* Diamond shape */}
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              background: previewSnap?.id === snap.id ? color : 'var(--caboo-bg-deep)',
                              border: `2px solid ${color}`,
                              transform: 'rotate(45deg)',
                              transition: 'background 0.15s',
                            }}
                          />
                          {/* Time label */}
                          <div
                            className="absolute text-center"
                            style={{
                              top: '18px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              color: 'var(--caboo-text-muted)',
                              fontSize: '9px',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {snapLabel(snap)}
                          </div>
                        </div>
                      );
                    })}

                    {/* Tooltip */}
                    {hovered && (
                      <div
                        className="absolute pointer-events-none z-50 px-2 py-1"
                        style={{
                          left: `${hoveredPos.x}px`,
                          top: '-32px',
                          transform: 'translateX(-50%)',
                          background: 'var(--caboo-bg-surface)',
                          border: '1px solid var(--caboo-border)',
                          color: 'var(--caboo-text-primary)',
                          fontSize: '10px',
                          whiteSpace: 'nowrap',
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {hovered.label}
                      </div>
                    )}
                  </div>

                  {/* Preview panel */}
                  <AnimatePresence>
                    {previewSnap && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="mb-3 px-3 py-2"
                        style={{
                          border: '1px solid var(--caboo-border)',
                          background: 'var(--caboo-bg-deep)',
                          fontSize: '11px',
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div style={{ color: 'var(--caboo-text-heading)' }}>
                            <span style={{ color: 'var(--caboo-accent-amber)' }}>⏰</span>{' '}
                            {previewSnap.label}
                          </div>
                          <div
                            style={{ color: 'var(--caboo-text-muted)', fontSize: '10px' }}
                          >
                            {new Date(previewSnap.timestamp).toLocaleTimeString()}
                          </div>
                        </div>

                        {previewData && previewData.filesChanged.length > 0 && (
                          <div className="mb-2">
                            <div style={{ color: 'var(--caboo-text-muted)', marginBottom: '4px' }}>
                              Files changed since this point:
                            </div>
                            {previewData.filesChanged.slice(0, 8).map((f) => (
                              <div key={f} style={{ color: 'var(--caboo-text-secondary)', paddingLeft: '8px' }}>
                                ~ {f}
                              </div>
                            ))}
                            {previewData.filesChanged.length > 8 && (
                              <div style={{ color: 'var(--caboo-text-muted)', paddingLeft: '8px' }}>
                                +{previewData.filesChanged.length - 8} more
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => handleRevert(previewSnap)}
                            disabled={reverting}
                            className="px-2 py-1 text-[10px] transition-colors"
                            style={{
                              border: '1px solid var(--caboo-accent-rust)',
                              color: 'var(--caboo-accent-rust)',
                              background: 'transparent',
                              cursor: reverting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {reverting ? 'Reverting...' : '↩ Go back to this version'}
                          </button>
                          <button
                            onClick={handleBackToPresent}
                            disabled={reverting}
                            className="px-2 py-1 text-[10px] transition-colors"
                            style={{
                              border: '1px solid var(--caboo-border)',
                              color: 'var(--caboo-text-muted)',
                              background: 'transparent',
                              cursor: reverting ? 'not-allowed' : 'pointer',
                            }}
                          >
                            ⏩ Back to present
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Legend */}
                  <div className="flex gap-3 text-[10px]" style={{ color: 'var(--caboo-text-muted)' }}>
                    {[
                      { color: 'green', label: 'agent done' },
                      { color: 'blue', label: 'saved' },
                      { color: 'amber', label: 'conductor' },
                      { color: 'red', label: 'reverted' },
                    ].map(({ color, label }) => (
                      <div key={color} className="flex items-center gap-1">
                        <div
                          style={{
                            width: '8px',
                            height: '8px',
                            background: SNAPSHOT_COLORS[color],
                            transform: 'rotate(45deg)',
                          }}
                        />
                        {label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
