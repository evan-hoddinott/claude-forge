interface TopBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  projectCount: number;
}

export default function TopBar({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  projectCount,
}: TopBarProps) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-4 px-6 py-4 border-b border-white/6 bg-bg/80 backdrop-blur-md">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" />
        </svg>
        <input
          id="dashboard-search"
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/6 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/40 focus:bg-white/[0.07] transition-colors"
        />
      </div>

      {/* Project count */}
      <span className="text-xs text-text-muted whitespace-nowrap">
        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
      </span>

      {/* View toggle */}
      <div className="flex items-center rounded-lg bg-white/5 border border-white/6 p-0.5">
        <button
          onClick={() => onViewModeChange('grid')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'grid'
              ? 'bg-white/10 text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          title="Grid view"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <rect x="1" y="1" width="6" height="6" rx="1" />
            <rect x="9" y="1" width="6" height="6" rx="1" />
            <rect x="1" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
          </svg>
        </button>
        <button
          onClick={() => onViewModeChange('list')}
          className={`p-1.5 rounded-md transition-colors ${
            viewMode === 'list'
              ? 'bg-white/10 text-text-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
          title="List view"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <path d="M2 4h12M2 8h12M2 12h12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
