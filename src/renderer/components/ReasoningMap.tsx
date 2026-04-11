import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import mermaid from 'mermaid';
import { useAPI } from '../hooks/useAPI';
import type { Project, ReasoningMap as ReasoningMapType, MapNode } from '../../shared/types';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    primaryColor: '#2d3625',
    primaryTextColor: '#d4cba8',
    primaryBorderColor: '#4a5a38',
    lineColor: '#5a6b48',
    background: '#1a1e14',
    nodeBorder: '#5a6b48',
    clusterBkg: '#232a1c',
    edgeLabelBackground: '#232a1c',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '11px',
  },
  securityLevel: 'loose',
});

const AGENT_COLORS: Record<string, string> = {
  claude: '#D97706',
  gemini: '#4285F4',
  codex: '#10A37F',
  copilot: '#6e40c9',
  user: '#5a5a5a',
};

const NODE_TYPE_COLORS: Record<string, string> = {
  page: '#5a9441',
  component: '#3d7a8b',
  api: '#8b7a3d',
  model: '#6b4e2e',
  service: '#6a4d8b',
  test: '#5a5a5a',
  database: '#8b5e3c',
  config: '#4a4a2a',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

export default function ReasoningMap({ project }: { project: Project }) {
  const api = useAPI();
  const svgRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<ReasoningMapType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [attribution, setAttribution] = useState<Record<string, { agent: string; date: string }>>({});
  const renderIdRef = useRef(0);

  const loadAttribution = useCallback(async () => {
    try {
      const attr = await api.reasoningMap.getAttribution(project.id);
      setAttribution(attr);
    } catch {
      // non-fatal
    }
  }, [api, project.id]);

  const generateMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.reasoningMap.generate(project.id, project.path);
      setMap(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate map');
    } finally {
      setLoading(false);
    }
  }, [api, project.id, project.path]);

  const loadMap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cached = await api.reasoningMap.get(project.id);
      if (cached) {
        setMap(cached);
        setLoading(false);
      } else {
        await generateMap();
      }
    } catch {
      await generateMap();
    }
  }, [api, project.id, generateMap]);

  // Initial load + attribution
  useEffect(() => {
    loadMap();
    loadAttribution();
  }, [loadMap, loadAttribution]);

  // Listen for file changes from agent exits
  useEffect(() => {
    api.reasoningMap.onFilesChanged(({ projectId }) => {
      if (projectId === project.id) {
        generateMap();
        loadAttribution();
      }
    });
    return () => {
      api.reasoningMap.offFilesChanged();
    };
  }, [api, project.id, generateMap, loadAttribution]);

  // Render mermaid SVG whenever map changes
  useEffect(() => {
    if (!map || !svgRef.current) return;

    const renderId = ++renderIdRef.current;

    (async () => {
      try {
        const uniqueId = `rm-${project.id}-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, map.mermaidCode);

        if (renderId !== renderIdRef.current) return; // stale render
        if (!svgRef.current) return;

        svgRef.current.innerHTML = svg;

        // Apply agent-border colors to nodes
        map.nodes.forEach((node) => {
          if (!node.lastModifiedBy) return;
          const color = AGENT_COLORS[node.lastModifiedBy];
          if (!color) return;
          const nodeEls = svgRef.current!.querySelectorAll<SVGElement>('g.node');
          nodeEls.forEach((el) => {
            const textEl = el.querySelector('text');
            if (textEl?.textContent?.trim() === node.label) {
              const rect = el.querySelector<SVGElement>('rect, circle, polygon');
              if (rect) {
                rect.style.stroke = color;
                rect.style.strokeWidth = '2.5px';
                rect.style.filter = `drop-shadow(0 0 4px ${color}55)`;
              }
            }
          });
        });

        // Attach click listeners
        const nodeEls = svgRef.current.querySelectorAll<SVGElement>('g.node');
        nodeEls.forEach((el) => {
          const label = el.querySelector('text')?.textContent?.trim();
          const matchedNode = map.nodes.find((n) => n.label === label);
          if (matchedNode) {
            el.style.cursor = 'pointer';
            el.addEventListener('click', () => setSelectedNode(matchedNode));
          }
        });
      } catch (err) {
        console.error('Mermaid render error:', err);
        if (renderId === renderIdRef.current && svgRef.current) {
          svgRef.current.innerHTML = `<div class="text-red-400 text-xs p-4">Diagram render error</div>`;
        }
      }
    })();
  }, [map, project.id]);

  const edgeCount = map?.mermaidCode.match(/-->/g)?.length ?? 0;

  return (
    <div className="h-full flex flex-col bg-[#12150e] font-mono">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-text-primary tracking-widest uppercase">
            Project Architecture Map
          </div>
          {map && (
            <div className="text-[10px] text-text-muted mt-0.5">
              Last updated {relativeTime(map.lastGenerated)}
              {' · '}
              {map.nodes.length} nodes
              {' · '}
              {edgeCount} connections
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={generateMap}
            disabled={loading}
            title="Regenerate map"
            className="px-2 py-1 text-[10px] border border-white/10 text-text-muted hover:text-text-primary hover:border-white/20 transition-colors disabled:opacity-40"
          >
            {loading ? '...' : '⟳ Regenerate'}
          </button>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            className="w-6 h-6 flex items-center justify-center text-xs border border-white/10 text-text-muted hover:text-text-primary hover:border-white/20 transition-colors"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
            className="w-6 h-6 flex items-center justify-center text-xs border border-white/10 text-text-muted hover:text-text-primary hover:border-white/20 transition-colors"
          >
            −
          </button>
          <button
            onClick={() => setZoom(1)}
            className="px-2 py-1 text-[10px] border border-white/10 text-text-muted hover:text-text-primary hover:border-white/20 transition-colors"
          >
            fit
          </button>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-text-muted text-xs">Analyzing project structure...</div>
          </div>
        )}
        {error && !loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-red-400 text-xs max-w-sm text-center">
              {error}
              <button onClick={generateMap} className="block mt-2 text-accent hover:underline mx-auto">
                Try again
              </button>
            </div>
          </div>
        )}
        {!loading && !error && map && (
          <div className="w-full h-full overflow-auto p-4">
            <div
              ref={svgRef}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.15s' }}
              className="[&_svg]:max-w-full [&_svg]:mx-auto [&_.node]:transition-all [&_.node:hover]:opacity-80"
            />
          </div>
        )}

        {/* Node detail slide-out */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ x: 340 }}
              animate={{ x: 0 }}
              exit={{ x: 340 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 bottom-0 w-80 bg-[#1a1e14] border-l border-white/[0.08] flex flex-col"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <div>
                  <div className="text-sm font-bold text-text-primary">{selectedNode.label}</div>
                  <div className="text-[10px] text-text-muted mt-0.5 capitalize">
                    {selectedNode.type}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-text-muted hover:text-text-primary transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>

              {/* Agent attribution */}
              {selectedNode.lastModifiedBy && (
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Last modified by</div>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: AGENT_COLORS[selectedNode.lastModifiedBy] ?? '#5a5a5a' }}
                    />
                    <span className="text-xs text-text-primary capitalize">{selectedNode.lastModifiedBy}</span>
                    {selectedNode.lastModified && (
                      <span className="text-[10px] text-text-muted ml-auto">{relativeTime(selectedNode.lastModified)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Files list */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                <div className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Files</div>
                <div className="space-y-2">
                  {selectedNode.files.map((f) => {
                    const fileAttr = attribution[f];
                    return (
                      <div key={f} className="group flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] text-text-secondary font-mono truncate">{f}</div>
                          {fileAttr && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ backgroundColor: AGENT_COLORS[fileAttr.agent] ?? '#5a5a5a' }}
                              />
                              <span className="text-[9px] text-text-muted capitalize">{fileAttr.agent}</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => api.files.openDefaultEditor(`${project.path}/${f}`)}
                          className="shrink-0 text-[9px] px-1.5 py-0.5 border border-white/10 text-text-muted hover:text-text-primary hover:border-white/20 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Open
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div className="shrink-0 border-t border-white/[0.06] px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
        <div className="text-[9px] text-text-muted uppercase tracking-widest mr-2 self-center">Type:</div>
        {Object.entries(NODE_TYPE_COLORS).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-2 h-2 shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-text-muted capitalize">{type}</span>
          </div>
        ))}
        <div className="w-px bg-white/10 mx-1 self-stretch" />
        <div className="text-[9px] text-text-muted uppercase tracking-widest mr-2 self-center">Agent:</div>
        {Object.entries(AGENT_COLORS).map(([agent, color]) => (
          <div key={agent} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[9px] text-text-muted capitalize">{agent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
