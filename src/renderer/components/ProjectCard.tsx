import { memo } from 'react';
import { motion } from 'framer-motion';
import type { Project } from '../../shared/types';
import { AGENTS } from '../../shared/types';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import StatusBadge from './StatusBadge';

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return `${Math.floor(days / 30)}mo ago`;
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

function ActionButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
    >
      {children}
    </button>
  );
}

export default memo(function ProjectCard({
  project,
  viewMode,
  onClick,
}: {
  project: Project;
  viewMode: 'grid' | 'list';
  onClick?: () => void;
}) {
  const api = useAPI();
  const { toast } = useToast();

  const handleOpenTerminal = () => api.system.openInTerminal(project.path);
  const handleOpenEditor = () => api.system.openInEditor(project.path);
  const agentType = project.preferredAgent || 'claude';
  const agentConfig = AGENTS[agentType];
  const handleStartAgent = async () => {
    try {
      await api.agent.start(project.id, agentType);
      toast(`${agentConfig.displayName} launched`);
    } catch {
      toast(`Failed to launch ${agentConfig.displayName}`, 'error');
    }
  };

  if (viewMode === 'list') {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.04] hover:border-white/[0.08] transition-all cursor-pointer group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-text-primary truncate">
              {project.name}
            </h3>
            <StatusBadge status={project.status} />
          </div>
          {project.description && (
            <p className="text-xs text-text-muted truncate mt-0.5">
              {project.description}
            </p>
          )}
        </div>

        {project.tags.length > 0 && (
          <div className="hidden lg:flex items-center gap-1.5">
            {project.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {project.githubRepo && (
          <GitHubLink url={project.githubUrl} repo={project.githubRepo} />
        )}

        <span className="text-xs text-text-muted whitespace-nowrap">
          {relativeTime(project.updatedAt)}
        </span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionButton title="Open in Terminal" onClick={handleOpenTerminal}>
            <TerminalIcon />
          </ActionButton>
          <ActionButton title="Open in Editor" onClick={handleOpenEditor}>
            <CodeIcon />
          </ActionButton>
          <ActionButton title="Launch Agent" onClick={handleStartAgent}>
            <SparkleIcon />
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="flex flex-col rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.06] hover:border-white/[0.1] transition-all cursor-pointer group hover:-translate-y-0.5"
    >
      <div className="flex-1 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-text-primary truncate">
            {project.name}
          </h3>
          <StatusBadge status={project.status} />
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-3">
            {project.description}
          </p>
        )}

        {/* Tags */}
        {project.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {project.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-text-muted"
              >
                {tag}
              </span>
            ))}
            {project.tags.length > 4 && (
              <span className="px-2 py-0.5 rounded-full bg-white/5 text-xs text-text-muted">
                +{project.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
        <div className="flex items-center gap-3">
          {project.githubRepo && (
            <GitHubLink url={project.githubUrl} repo={project.githubRepo} />
          )}
          <span className="text-xs text-text-muted">
            {relativeTime(project.updatedAt)}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <ActionButton title="Open in Terminal" onClick={handleOpenTerminal}>
            <TerminalIcon />
          </ActionButton>
          <ActionButton title="Open in Editor" onClick={handleOpenEditor}>
            <CodeIcon />
          </ActionButton>
          <ActionButton title="Launch Agent" onClick={handleStartAgent}>
            <SparkleIcon />
          </ActionButton>
        </div>
      </div>
    </div>
  );
});

function GitHubLink({
  url,
  repo,
}: {
  url: string | null;
  repo: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-accent transition-colors"
      title={repo}
    >
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
      {url ? (
        <span className="truncate max-w-[120px]">{repo}</span>
      ) : (
        <span className="truncate max-w-[120px]">{repo}</span>
      )}
    </span>
  );
}

function TerminalIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 5 7 8 4 11" />
      <line x1="9" y1="11" x2="12" y2="11" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 3 1.5 8 5 13" />
      <polyline points="11 3 14.5 8 11 13" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5L8 1z" />
    </svg>
  );
}
