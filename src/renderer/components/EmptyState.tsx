import { motion } from 'framer-motion';

export default function EmptyState({
  onCreateProject,
  onImportProject,
  onImportBundle,
  onImportSnapshot,
}: {
  onCreateProject?: () => void;
  onImportProject?: (mode: 'local' | 'clone') => void;
  onImportBundle?: () => void;
  onImportSnapshot?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full pb-20"
    >
      {/* ASCII art empty state */}
      <div
        className="text-center mb-6"
        style={{
          fontFamily: "var(--forge-font-heading, 'Silkscreen', monospace)",
          fontSize: 16,
          color: 'var(--forge-text-heading)',
          letterSpacing: 0.5,
        }}
      >
        {'\u2692'} Your forge is cold... {'\u2692'}
      </div>

      <div
        className="text-center mb-2"
        style={{
          fontFamily: "var(--forge-font-body, 'IBM Plex Mono', monospace)",
          fontSize: 14,
          color: 'var(--forge-text-primary)',
        }}
      >
        No projects yet.
      </div>
      <div
        className="text-center mb-8"
        style={{
          fontFamily: "var(--forge-font-body, 'IBM Plex Mono', monospace)",
          fontSize: 13,
          color: 'var(--forge-text-secondary)',
        }}
      >
        Light the fire and start building!
      </div>

      {onCreateProject && (
        <button
          onClick={onCreateProject}
          className="flex items-center gap-2 px-5 py-2.5"
          style={{
            fontFamily: "var(--forge-font-heading, 'Silkscreen', monospace)",
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            backgroundColor: 'var(--forge-accent-amber)',
            color: 'var(--forge-bg-deep)',
            border: '2px outset var(--forge-accent-amber-bright)',
          }}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M8 3v10M3 8h10" />
          </svg>
          + New Project
        </button>
      )}

      {onImportProject && (
        <div className="flex gap-3 mt-2">
          <button
            onClick={() => onImportProject('local')}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-text-secondary hover:text-text-primary transition-colors"
            style={{
              fontFamily: "var(--forge-font-body, 'IBM Plex Mono', monospace)",
              fontSize: 12,
              border: '1px solid var(--forge-border)',
              backgroundColor: 'transparent',
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 10V3M5 6l3-3 3 3" />
              <path d="M2 13h12" />
            </svg>
            Import Folder
          </button>
          <button
            onClick={() => onImportProject('clone')}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-text-secondary hover:text-text-primary transition-colors"
            style={{
              fontFamily: "var(--forge-font-body, 'IBM Plex Mono', monospace)",
              fontSize: 12,
              border: '1px solid var(--forge-border)',
              backgroundColor: 'transparent',
            }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Clone from GitHub
          </button>
          {onImportBundle && (
            <button
              onClick={onImportBundle}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-text-secondary hover:text-text-primary transition-colors"
              style={{
                fontFamily: "var(--forge-font-body, 'IBM Plex Mono', monospace)",
                fontSize: 12,
                border: '1px solid var(--forge-border)',
                backgroundColor: 'transparent',
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="5" width="14" height="10" rx="1.5" />
                <path d="M5 5V3.5A1.5 1.5 0 016.5 2h3A1.5 1.5 0 0111 3.5V5" />
                <path d="M1 9h14" />
              </svg>
              Import Bundle
            </button>
          )}
          {onImportSnapshot && (
            <button
              onClick={onImportSnapshot}
              className="flex items-center gap-1.5 px-4 py-2 rounded text-text-secondary hover:text-text-primary transition-colors"
              style={{
                fontFamily: "var(--forge-font-body, 'IBM Plex Mono', monospace)",
                fontSize: 12,
                border: '1px solid var(--forge-border)',
                backgroundColor: 'transparent',
              }}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2" />
                <path d="M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M11.1 4.9l1.4-1.4M3.5 12.5l1.4-1.4" />
              </svg>
              Import Snapshot
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
