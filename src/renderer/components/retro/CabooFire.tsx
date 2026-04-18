interface CabooFireProps {
  size?: number;
  className?: string;
}

export default function CabooFire({ size = 24, className = '' }: CabooFireProps) {
  return (
    <div
      className={`caboo-fire ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="caboo-fire-log caboo-fire-log-1" />
      <div className="caboo-fire-log caboo-fire-log-2" />
      <div className="caboo-fire-flame caboo-fire-flame-1" />
      <div className="caboo-fire-flame caboo-fire-flame-2" />
      <div className="caboo-fire-flame caboo-fire-flame-3" />
      <div className="caboo-fire-flame caboo-fire-flame-4" />
    </div>
  );
}
