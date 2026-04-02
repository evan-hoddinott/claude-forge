interface ForgeFireProps {
  size?: number;
  className?: string;
}

export default function ForgeFire({ size = 24, className = '' }: ForgeFireProps) {
  return (
    <div
      className={`forge-fire ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="forge-fire-log forge-fire-log-1" />
      <div className="forge-fire-log forge-fire-log-2" />
      <div className="forge-fire-flame forge-fire-flame-1" />
      <div className="forge-fire-flame forge-fire-flame-2" />
      <div className="forge-fire-flame forge-fire-flame-3" />
      <div className="forge-fire-flame forge-fire-flame-4" />
    </div>
  );
}
