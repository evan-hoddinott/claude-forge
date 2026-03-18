import { motion } from 'framer-motion';

export default function EmptyState({ onCreateProject }: { onCreateProject?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center h-full pb-20"
    >
      {/* Decorative illustration */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-2xl bg-accent/8 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-accent/60"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Anvil/forge shape */}
            <path d="M4 15h16" />
            <path d="M6 15V9a2 2 0 012-2h8a2 2 0 012 2v6" />
            <path d="M2 15l2-2" />
            <path d="M7 18h10" />
            <path d="M9 21h6" />
            <path d="M7 15v3" />
            <path d="M17 15v3" />
          </svg>
        </div>
        {/* Decorative dots */}
        <div className="absolute -top-2 -right-2 w-3 h-3 rounded-full bg-accent/20" />
        <div className="absolute -bottom-1 -left-3 w-2 h-2 rounded-full bg-accent/15" />
      </div>

      <h2 className="text-lg font-semibold text-text-primary mb-2">
        No projects yet
      </h2>
      <p className="text-sm text-text-muted mb-6 text-center max-w-xs">
        Create your first project to start building with Claude Code
      </p>

      {onCreateProject && (
        <button
          onClick={onCreateProject}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-bg text-sm font-medium transition-colors"
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
          Create Project
        </button>
      )}
    </motion.div>
  );
}
