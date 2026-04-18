import { useEffect, useState, useRef } from 'react';

interface Station {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'failed';
}

interface ConductorTrainProps {
  stations: Station[];
  currentStationIndex: number;
  isRunning: boolean;
  isCheckpoint?: boolean;
  isComplete?: boolean;
  hasError?: boolean;
  className?: string;
}

export default function ConductorTrain({
  stations,
  currentStationIndex,
  isRunning,
  isCheckpoint = false,
  isComplete = false,
  hasError = false,
  className = '',
}: ConductorTrainProps) {
  const [trainPos, setTrainPos] = useState(0);
  const [toot, setToot] = useState(false);
  const [sparks, setSparks] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [smokeParticles, setSmokeParticles] = useState<Array<{ id: number; x: number; opacity: number }>>([]);
  const animFrameRef = useRef<number | null>(null);
  const sparkIdRef = useRef(0);
  const smokeIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalStations = stations.length;

  // Calculate target position (0-100% of track width)
  const targetPos =
    totalStations <= 1
      ? isComplete
        ? 100
        : 5
      : Math.min(100, (currentStationIndex / Math.max(totalStations - 1, 1)) * 100);

  // Animate train position smoothly
  useEffect(() => {
    let current = trainPos;
    const target = targetPos;

    function animate() {
      const diff = target - current;
      if (Math.abs(diff) < 0.05) {
        current = target;
        setTrainPos(current);
        return;
      }
      current += diff * 0.04; // ease toward target
      setTrainPos(current);
      animFrameRef.current = requestAnimationFrame(animate);
    }

    animFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [targetPos]);

  // Toot on station complete
  useEffect(() => {
    if (currentStationIndex > 0 || isComplete) {
      setToot(true);
      const id = setTimeout(() => setToot(false), 800);
      return () => clearTimeout(id);
    }
  }, [currentStationIndex, isComplete]);

  // Sparks on complete
  useEffect(() => {
    if (isComplete) {
      const newSparks = Array.from({ length: 6 }, () => ({
        id: ++sparkIdRef.current,
        x: 85 + Math.random() * 15,
        y: Math.random() * 100,
      }));
      setSparks(newSparks);
      setTimeout(() => setSparks([]), 2000);
    }
  }, [isComplete]);

  // Smoke while running
  useEffect(() => {
    if (!isRunning || isCheckpoint) return;

    const id = setInterval(() => {
      setSmokeParticles((prev) => {
        const filtered = prev.filter((p) => p.opacity > 0.05);
        const newParticle = {
          id: ++smokeIdRef.current,
          x: trainPos - 3,
          opacity: 0.6,
        };
        return [...filtered.slice(-5), newParticle].map((p) => ({
          ...p,
          x: p.x - 0.5,
          opacity: p.opacity * 0.85,
        }));
      });
    }, 150);

    return () => clearInterval(id);
  }, [isRunning, isCheckpoint, trainPos]);

  // Reduce motion check
  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  if (prefersReducedMotion) {
    return (
      <div
        className={`flex items-center gap-2 px-4 py-2 text-[11px] ${className}`}
        style={{ fontFamily: 'var(--caboo-font-body)', color: 'var(--caboo-text-secondary)' }}
      >
        <span>🚂</span>
        <span>Station {currentStationIndex + 1}/{totalStations}</span>
        {isComplete && <span style={{ color: 'var(--caboo-accent-green)' }}>✅ Complete</span>}
        {hasError && <span style={{ color: 'var(--caboo-accent-rust)' }}>⚠ Error</span>}
        {isCheckpoint && <span style={{ color: 'var(--caboo-accent-amber)' }}>⏸ Checkpoint</span>}
      </div>
    );
  }

  const trainLeft = `${trainPos}%`;

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      style={{
        height: '72px',
        fontFamily: 'var(--caboo-font-body)',
        overflow: 'hidden',
      }}
    >
      {/* Station labels row */}
      <div className="absolute top-0 left-0 right-0 flex">
        {stations.map((station, idx) => {
          const leftPct =
            totalStations <= 1 ? 50 : 8 + (idx / Math.max(totalStations - 1, 1)) * 84;
          return (
            <div
              key={station.id}
              className="absolute text-center"
              style={{
                left: `${leftPct}%`,
                transform: 'translateX(-50%)',
                color:
                  station.status === 'completed'
                    ? 'var(--caboo-accent-green)'
                    : station.status === 'active'
                    ? 'var(--caboo-accent-amber)'
                    : station.status === 'failed'
                    ? 'var(--caboo-accent-rust)'
                    : 'var(--caboo-text-muted)',
                fontSize: '9px',
                fontFamily: 'var(--caboo-font-heading)',
                whiteSpace: 'nowrap',
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {station.status === 'completed' ? '✅' : station.status === 'failed' ? '❌' : '○'}
            </div>
          );
        })}
      </div>

      {/* Track */}
      <div
        className="absolute"
        style={{
          top: '28px',
          left: '8%',
          right: '8%',
          height: '2px',
          background: 'var(--caboo-border)',
        }}
      />

      {/* Completed track segment */}
      <div
        className="absolute"
        style={{
          top: '28px',
          left: '8%',
          width: `${trainPos * 0.84}%`,
          height: '2px',
          background: hasError
            ? 'var(--caboo-accent-rust)'
            : 'var(--caboo-accent-green)',
          transition: 'width 0.1s linear',
        }}
      />

      {/* Station dots on track */}
      {stations.map((station, idx) => {
        const leftPct =
          totalStations <= 1 ? 50 : 8 + (idx / Math.max(totalStations - 1, 1)) * 84;
        return (
          <div
            key={station.id}
            className="absolute"
            style={{
              top: '22px',
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              width: '12px',
              height: '12px',
              border: `2px solid ${
                station.status === 'completed'
                  ? 'var(--caboo-accent-green)'
                  : station.status === 'active'
                  ? 'var(--caboo-accent-amber)'
                  : station.status === 'failed'
                  ? 'var(--caboo-accent-rust)'
                  : 'var(--caboo-border)'
              }`,
              background:
                station.status === 'completed'
                  ? 'var(--caboo-accent-green)'
                  : 'var(--caboo-bg-deep)',
              zIndex: 2,
            }}
          />
        );
      })}

      {/* Station names below track */}
      {stations.map((station, idx) => {
        const leftPct =
          totalStations <= 1 ? 50 : 8 + (idx / Math.max(totalStations - 1, 1)) * 84;
        return (
          <div
            key={`label-${station.id}`}
            className="absolute"
            style={{
              top: '40px',
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              color:
                station.status === 'active'
                  ? 'var(--caboo-accent-amber)'
                  : 'var(--caboo-text-muted)',
              fontSize: '8px',
              fontFamily: 'var(--caboo-font-heading)',
              whiteSpace: 'nowrap',
              maxWidth: '70px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              textAlign: 'center',
            }}
          >
            {station.name.length > 10 ? station.name.slice(0, 9) + '…' : station.name}
          </div>
        );
      })}

      {/* Smoke particles */}
      {smokeParticles.map((p) => (
        <div
          key={p.id}
          className="absolute"
          style={{
            left: `calc(8% + ${p.x * 0.84}%)`,
            top: '18px',
            width: '4px',
            height: '4px',
            background: 'var(--caboo-text-muted)',
            opacity: p.opacity,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* Train */}
      <div
        className="absolute"
        style={{
          left: `calc(8% + ${trainPos * 0.84}%)`,
          top: '14px',
          transform: 'translateX(-50%)',
          zIndex: 10,
          transition: prefersReducedMotion ? 'none' : undefined,
          animation:
            isRunning && !isCheckpoint && !prefersReducedMotion
              ? 'conductor-train-bob 0.4s ease-in-out infinite alternate'
              : hasError
              ? 'conductor-train-wobble 0.3s ease-in-out infinite alternate'
              : 'none',
        }}
      >
        {/* Train body in ASCII box-drawing chars */}
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: '11px',
            lineHeight: '1.2',
            color: isCheckpoint
              ? 'var(--caboo-accent-amber)'
              : hasError
              ? 'var(--caboo-accent-rust)'
              : isComplete
              ? 'var(--caboo-accent-green)'
              : 'var(--caboo-text-primary)',
            whiteSpace: 'pre',
            textShadow: isCheckpoint
              ? '0 0 6px var(--caboo-accent-amber)'
              : isComplete
              ? '0 0 6px var(--caboo-accent-green)'
              : 'none',
          }}
        >
          {'╔══╗\n║🚂║\n╚╦╦╝\n○○'}
        </div>
      </div>

      {/* TOOT! effect */}
      {toot && (
        <div
          className="absolute pointer-events-none"
          style={{
            left: `calc(8% + ${trainPos * 0.84}% + 20px)`,
            top: '10px',
            color: 'var(--caboo-accent-amber)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: '10px',
            animation: 'conductor-toot 0.8s ease-out forwards',
            zIndex: 20,
          }}
        >
          TOOT!
        </div>
      )}

      {/* Checkpoint pulse */}
      {isCheckpoint && (
        <div
          className="absolute"
          style={{
            left: `calc(8% + ${trainPos * 0.84}%)`,
            top: '8px',
            transform: 'translateX(-50%)',
            color: 'var(--caboo-accent-amber)',
            fontSize: '14px',
            animation: 'conductor-checkpoint-pulse 1s ease-in-out infinite',
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          ⏸
        </div>
      )}

      {/* Completion sparkles */}
      {sparks.map((spark) => (
        <div
          key={spark.id}
          className="absolute pointer-events-none"
          style={{
            left: `${spark.x}%`,
            top: `${spark.y}%`,
            color: 'var(--caboo-accent-green)',
            fontSize: '10px',
            animation: 'conductor-spark 1.5s ease-out forwards',
            zIndex: 20,
          }}
        >
          ✦
        </div>
      ))}
    </div>
  );
}
