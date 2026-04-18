interface PixelButton88x31Props {
  label: string;
  color?: 'green' | 'brown' | 'amber';
  dot?: 'connected' | 'disconnected' | 'warning';
  onClick?: () => void;
  className?: string;
}

export default function PixelButton88x31({
  label,
  color = 'green',
  dot,
  onClick,
  className = '',
}: PixelButton88x31Props) {
  const dotColor = dot === 'connected'
    ? 'var(--caboo-accent-green-bright)'
    : dot === 'warning'
      ? 'var(--caboo-accent-amber-bright)'
      : dot === 'disconnected'
        ? 'var(--caboo-text-secondary)'
        : undefined;

  return (
    <button
      onClick={onClick}
      className={`caboo-88x31 ${color} ${className}`}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      {dot && (
        <span
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            backgroundColor: dotColor,
            marginRight: 3,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  );
}
