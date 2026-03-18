import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAPI, useQuery } from '../hooks/useAPI';
import TopBar from '../components/TopBar';
import ProjectCard from '../components/ProjectCard';
import EmptyState from '../components/EmptyState';
import type { Project } from '../../shared/types';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } },
};

interface DashboardProps {
  onNewProject?: () => void;
  onOpenProject?: (id: string) => void;
  onContextMenu?: (x: number, y: number, project: Project) => void;
}

export default function Dashboard({ onNewProject, onOpenProject, onContextMenu }: DashboardProps) {
  const api = useAPI();
  const { data: projects, loading } = useQuery(() => api.projects.list());
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
    <div className="h-full flex flex-col">
      {hasProjects && (
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          projectCount={filtered.length}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <LoadingSkeleton />
        ) : !hasProjects ? (
          <EmptyState onCreateProject={onNewProject} />
        ) : filtered.length === 0 ? (
          <NoResults query={searchQuery} onClear={() => setSearchQuery('')} />
        ) : viewMode === 'grid' ? (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-6"
          >
            {filtered.map((project) => (
              <motion.div
                key={project.id}
                variants={item}
                onContextMenu={(e) => handleRightClick(e, project)}
              >
                <ProjectCard project={project} viewMode="grid" onClick={() => onOpenProject?.(project.id)} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex flex-col gap-2 p-6"
          >
            {filtered.map((project) => (
              <motion.div
                key={project.id}
                variants={item}
                onContextMenu={(e) => handleRightClick(e, project)}
              >
                <ProjectCard project={project} viewMode="list" onClick={() => onOpenProject?.(project.id)} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="h-44 rounded-xl bg-white/[0.02] animate-pulse"
          style={{ animationDelay: `${i * 100}ms` }}
        />
      ))}
    </div>
  );
}

function NoResults({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full pb-20 text-center">
      <p className="text-sm text-text-secondary mb-1">
        No projects matching &ldquo;{query}&rdquo;
      </p>
      <button
        onClick={onClear}
        className="text-xs text-accent hover:text-accent-hover transition-colors"
      >
        Clear search
      </button>
    </div>
  );
}
