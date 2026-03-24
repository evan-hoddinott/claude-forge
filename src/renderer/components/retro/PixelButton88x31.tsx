import { useTheme } from '../../contexts/ThemeContext';

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
  const { theme } = useTheme();
  if (theme !== 'forge') return null;

  const dotColor = dot === 'connected'
    ? 'var(--forge-accent-green-bright)'
    : dot === 'warning'
      ? 'var(--forge-accent-amber-bright)'
      : dot === 'disconnected'
        ? 'var(--forge-text-secondary)'
        : undefined;

  return (
    <button
      onClick={onClick}
      className={`forge-88x31 ${color} ${className}`}
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
