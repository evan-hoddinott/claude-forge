export default function TitleBar() {
  const api = window.electronAPI;

  return (
    <div className="titlebar-drag flex items-center justify-between h-9 bg-surface border-b border-white/[0.06] shrink-0 select-none">
      <div className="flex-1" />

      <div className="titlebar-no-drag flex items-center h-full">
        <button
          onClick={() => api.window.minimize()}
          className="w-12 h-full flex items-center justify-center text-text-muted hover:bg-white/[0.06] hover:text-text-secondary transition-colors"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 5h8" />
          </svg>
        </button>
        <button
          onClick={() => api.window.maximize()}
          className="w-12 h-full flex items-center justify-center text-text-muted hover:bg-white/[0.06] hover:text-text-secondary transition-colors"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="8" height="8" rx="0.8" />
          </svg>
        </button>
        <button
          onClick={() => api.window.close()}
          className="w-12 h-full flex items-center justify-center text-text-muted hover:bg-[#e81123] hover:text-white transition-colors"
        >
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}
