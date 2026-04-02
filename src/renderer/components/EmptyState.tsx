import { motion } from 'framer-motion';

export default function EmptyState({ onCreateProject }: { onCreateProject?: () => void }) {
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
    </motion.div>
  );
}
