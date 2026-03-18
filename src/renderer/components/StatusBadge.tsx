import type { ProjectStatus } from '../../shared/types';

const config: Record<ProjectStatus, { label: string; className: string }> = {
  created: {
    label: 'Created',
    className: 'bg-status-created/15 text-status-created',
  },
  'in-progress': {
    label: 'In Progress',
    className: 'bg-status-in-progress/15 text-status-in-progress',
  },
  ready: {
    label: 'Ready',
    className: 'bg-status-ready/15 text-status-ready',
  },
  error: {
    label: 'Error',
    className: 'bg-status-error/15 text-status-error',
  },
};

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-current ${
          status === 'in-progress' ? 'animate-pulse' : ''
        }`}
      />
      {label}
    </span>
  );
}
