/*
 * Pixel-art icon set for the Forge theme.
 * Uses simple inline SVGs with the forge color palette.
 * 16x16 or 12x12 pixel grid, 1-2 colors per icon.
 */

interface PixelIconProps {
  name: string;
  size?: number;
  className?: string;
}

const COLORS = {
  green: 'var(--forge-accent-green)',
  greenBright: 'var(--forge-accent-green-bright)',
  amber: 'var(--forge-accent-amber)',
  amberBright: 'var(--forge-accent-amber-bright)',
  brown: 'var(--forge-accent-brown)',
  brownLight: 'var(--forge-accent-brown-light)',
  rust: 'var(--forge-accent-rust)',
  cream: 'var(--forge-text-primary)',
  teal: 'var(--forge-status-info)',
  muted: 'var(--forge-text-secondary)',
};

function getIcon(name: string): { paths: string; fill: string; stroke?: string } {
  switch (name) {
    // File types
    case 'file-ts':
      return { paths: 'M3 1h7l3 3v9H3V1zM6 8h4M6 10h2', fill: 'none', stroke: COLORS.green };
    case 'file-js':
      return { paths: 'M3 1h7l3 3v9H3V1zM7 8v3c0 1-2 1-2 0', fill: 'none', stroke: COLORS.amber };
    case 'file-json':
      return { paths: 'M3 1h7l3 3v9H3V1zM6 7l2 2-2 2', fill: 'none', stroke: COLORS.brown };
    case 'file-md':
      return { paths: 'M3 1h7l3 3v9H3V1zM5 10V7l2 2 2-2v3', fill: 'none', stroke: COLORS.cream };
    case 'file-css':
      return { paths: 'M3 1h7l3 3v9H3V1zM9 7c-1-1-3 0-3 1.5S8 11 9 10', fill: 'none', stroke: COLORS.teal };
    case 'file-html':
      return { paths: 'M3 1h7l3 3v9H3V1zM5 8l3 2M5 10l3-2', fill: 'none', stroke: COLORS.rust };
    case 'file-py':
      return { paths: 'M3 1h7l3 3v9H3V1zM6 8h4M6 10h4', fill: 'none', stroke: COLORS.greenBright };
    case 'folder':
      return { paths: 'M2 4h5l1-2h4l1 2h1v8H2V4z', fill: COLORS.brown };
    case 'file':
      return { paths: 'M3 1h7l3 3v9H3V1z', fill: 'none', stroke: COLORS.muted };

    // Agent icons
    case 'agent-claude':
      // Anvil shape
      return { paths: 'M3 11h10M4 8h8v3H4zM5 5h6l1 3H4z', fill: 'none', stroke: COLORS.cream };
    case 'agent-gemini':
      // Star shape
      return { paths: 'M8 2L6 6H2l4 3-2 5 4-3 4 3-2-5 4-3h-4z', fill: COLORS.amberBright };
    case 'agent-codex':
      // Hexagon
      return { paths: 'M8 1L14 4.5V11.5L8 15L2 11.5V4.5Z', fill: 'none', stroke: COLORS.greenBright };

    // Status
    case 'status-connected':
      return { paths: 'M8 3a5 5 0 100 10 5 5 0 000-10z', fill: COLORS.green };
    case 'status-disconnected':
      return { paths: 'M8 3a5 5 0 100 10 5 5 0 000-10z', fill: 'none', stroke: COLORS.muted };
    case 'status-warning':
      return { paths: 'M8 2L14 13H2zM8 6v4M8 11.5h.01', fill: 'none', stroke: COLORS.amber };
    case 'status-error':
      return { paths: 'M4 4l8 8M12 4l-8 8', fill: 'none', stroke: COLORS.rust };

    // Actions
    case 'play':
      return { paths: 'M4 2l10 6-10 6z', fill: COLORS.green };
    case 'settings':
      return { paths: 'M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3', fill: 'none', stroke: COLORS.cream };
    case 'folder-open':
      return { paths: 'M2 4h5l1-2h4l1 2h1v2l-2 6H4L2 6V4z', fill: 'none', stroke: COLORS.brown };
    case 'terminal':
      return { paths: 'M2 3h12v10H2zM4 7l2 2-2 2M9 11h3', fill: 'none', stroke: COLORS.cream };
    case 'search':
      return { paths: 'M6.5 2a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM10 10l4 4', fill: 'none', stroke: COLORS.cream };
    case 'edit':
      return { paths: 'M11 2l3 3-9 9H2v-3z', fill: 'none', stroke: COLORS.cream };

    // Nav
    case 'dashboard':
      return { paths: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z', fill: 'none', stroke: COLORS.cream };
    case 'files':
      return { paths: 'M4 1h6l3 3v9H4V1zM2 3v11h9', fill: 'none', stroke: COLORS.cream };
    case 'github':
      return { paths: 'M8 1a7 7 0 00-2.2 13.6c.3.1.5-.1.5-.3v-1.3c-1.8.4-2.3-.8-2.3-.8-.3-.8-.8-1-.8-1-.6-.4.1-.4.1-.4.7.1 1.1.7 1.1.7.6 1.1 1.7.8 2.1.6.1-.5.3-.8.5-1-1.6-.2-3.3-.8-3.3-3.6 0-.8.3-1.4.7-1.9-.1-.2-.3-.9.1-1.9 0 0 .6-.2 2 .7.6-.2 1.2-.2 1.8-.2s1.2.1 1.8.2c1.4-.9 2-.7 2-.7.4 1 .2 1.7.1 1.9.5.5.7 1.2.7 1.9 0 2.8-1.7 3.4-3.3 3.6.3.2.5.7.5 1.3v2c0 .2.1.4.5.3A7 7 0 008 1z', fill: COLORS.cream };

    default:
      return { paths: 'M3 1h7l3 3v9H3V1z', fill: 'none', stroke: COLORS.muted };
  }
}

export default function PixelIcon({ name, size = 16, className = '' }: PixelIconProps) {
  const icon = getIcon(name);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={icon.fill}
      stroke={icon.stroke || 'none'}
      strokeWidth={icon.stroke ? 1.5 : 0}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.paths.split(/(?=[ML])/).length > 0 && (
        <path d={icon.paths} />
      )}
    </svg>
  );
}
