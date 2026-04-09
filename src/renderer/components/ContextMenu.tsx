import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { Project } from '../../shared/types';

interface ContextMenuProps {
  x: number;
  y: number;
  project: Project;
  onClose: () => void;
  onDelete: (id: string) => void;
  onExportVibe?: (project: Project) => void;
}

export default function ContextMenu({
  x,
  y,
  project,
  onClose,
  onDelete,
  onExportVibe,
}: ContextMenuProps) {
  const api = useAPI();
  const { toast } = useToast();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 240);

  type MenuItem =
    | { label: string; icon: React.ReactNode; danger?: boolean; action: () => void }
    | 'separator';

  const items: MenuItem[] = [
    {
      label: 'Open in Terminal',
      icon: <TerminalIcon />,
      action: () => {
        api.system.openInTerminal(project.path);
        onClose();
      },
    },
    {
      label: 'Open in Editor',
      icon: <CodeIcon />,
      action: () => {
        api.system.openInEditor(project.path);
        onClose();
      },
    },
    ...(project.githubUrl
      ? [
          {
            label: 'Open on GitHub',
            icon: <GitHubIcon />,
            action: () => {
              api.system.openExternal(project.githubUrl!);
              onClose();
            },
          },
        ]
      : []),
    {
      label: 'Copy Path',
      icon: <CopyIcon />,
      action: () => {
        navigator.clipboard.writeText(project.path);
        toast('Path copied to clipboard');
        onClose();
      },
    },
    ...(onExportVibe
      ? [{
          label: 'Export Bundle',
          icon: <BundleIcon />,
          action: () => {
            onExportVibe(project);
            onClose();
          },
        }]
      : []),
    'separator' as const,
    {
      label: 'Delete Project',
      icon: <TrashIcon />,
      danger: true,
      action: () => {
        onDelete(project.id);
        onClose();
      },
    },
  ];

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.1 }}
      style={{ left: adjustedX, top: adjustedY }}
      className="fixed z-50 w-48 py-1 rounded-lg bg-surface border border-white/[0.1] shadow-xl"
    >
      {items.map((item, i) =>
        item === 'separator' ? (
          <div key={i} className="my-1 border-t border-white/[0.06]" />
        ) : (
          <button
            key={i}
            onClick={item.action}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
              item.danger
                ? 'text-status-error hover:bg-status-error/10'
                : 'text-text-secondary hover:bg-white/[0.06] hover:text-text-primary'
            }`}
          >
            <span className="w-4 h-4 shrink-0">{item.icon}</span>
            {item.label}
          </button>
        ),
      )}
    </motion.div>
  );
}

function TerminalIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 5 7 8 4 11" />
      <line x1="9" y1="11" x2="12" y2="11" />
    </svg>
  );
}

function CodeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="5 3 1.5 8 5 13" />
      <polyline points="11 3 14.5 8 11 13" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="8" height="8" rx="1.2" />
      <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 4h12M5.333 4V2.667a1.333 1.333 0 011.334-1.334h2.666a1.333 1.333 0 011.334 1.334V4M12.667 4v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4" />
    </svg>
  );
}

function BundleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="5" width="14" height="10" rx="1.5" />
      <path d="M5 5V3.5A1.5 1.5 0 016.5 2h3A1.5 1.5 0 0111 3.5V5" />
      <path d="M1 9h14" />
    </svg>
  );
}
