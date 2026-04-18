interface TitleBarProps {
  onToggleChat?: () => void;
}

export default function TitleBar({ onToggleChat }: TitleBarProps) {
  const api = window.electronAPI;

  return (
    <div className="titlebar-drag flex items-center justify-between shrink-0 select-none"
      style={{
        height: 32,
        background: 'var(--station-bg-deep)',
        borderBottom: '1px solid var(--station-border)',
      }}
    >
      {/* App identity — draggable area */}
      <div
        className="flex items-center gap-2 px-3"
        style={{ flex: 1 }}
      >
        <span style={{ fontSize: 14 }}>🚂</span>
        <span style={{
          fontFamily: 'var(--caboo-font-heading)',
          fontSize: 9,
          letterSpacing: 2,
          color: 'var(--station-brass)',
          textTransform: 'uppercase',
        }}>
          CABOO STATION OS
        </span>
      </div>

      {/* Window controls — not draggable */}
      <div className="titlebar-no-drag flex items-center" style={{ height: '100%' }}>
        {onToggleChat && (
          <button
            onClick={onToggleChat}
            title="AI Chat (Ctrl+Shift+C)"
            style={{
              width: 36,
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--station-text-dim)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.1s, color 0.1s',
              borderLeft: '1px solid var(--station-border)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(196, 162, 101, 0.1)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--station-text-primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--station-text-dim)';
            }}
          >
            <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2h12v9H9l-3 3v-3H2z" />
            </svg>
          </button>
        )}
        <WinBtn onClick={() => api.window.minimize()} title="Minimize">
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 5h8" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => api.window.maximize()} title="Maximize">
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="8" height="8" />
          </svg>
        </WinBtn>
        <WinBtn onClick={() => api.window.close()} title="Close" isClose>
          <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 1l8 8M9 1l-8 8" />
          </svg>
        </WinBtn>
      </div>
    </div>
  );
}

function WinBtn({
  children,
  onClick,
  title,
  isClose,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  isClose?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 40,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--station-text-dim)',
        background: 'none',
        border: 'none',
        borderLeft: '1px solid var(--station-border)',
        cursor: 'pointer',
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        if (isClose) {
          btn.style.background = 'var(--station-signal-red)';
          btn.style.color = 'white';
        } else {
          btn.style.background = 'rgba(196, 162, 101, 0.12)';
          btn.style.color = 'var(--station-text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.background = 'none';
        btn.style.color = 'var(--station-text-dim)';
      }}
    >
      {children}
    </button>
  );
}
