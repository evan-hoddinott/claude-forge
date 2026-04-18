import { useState, useEffect, useRef } from 'react';

interface SplitFlapDisplayProps {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function SplitFlapDisplay({ value, className = '', style }: SplitFlapDisplayProps) {
  const normalized = value.toUpperCase();
  const [displayChars, setDisplayChars] = useState<string[]>(normalized.split(''));
  const [animatingSet, setAnimatingSet] = useState<Set<number>>(new Set());
  const prevRef = useRef(normalized);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = normalized;

    if (prev === normalized) return;

    const newChars = normalized.split('');
    const animating = new Set<number>();

    // Find which characters changed
    const maxLen = Math.max(prev.length, newChars.length);
    for (let i = 0; i < maxLen; i++) {
      if (prev[i] !== newChars[i]) {
        animating.add(i);
      }
    }

    setAnimatingSet(animating);

    // After animation completes, update chars and clear animation
    const timer = setTimeout(() => {
      setDisplayChars(newChars);
      setAnimatingSet(new Set());
    }, 280);

    return () => clearTimeout(timer);
  }, [normalized]);

  // Sync initial render
  useEffect(() => {
    setDisplayChars(normalized.split(''));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <span className={`station-flap-display ${className}`} style={style} aria-label={value}>
      {displayChars.map((char, i) => (
        <span
          key={i}
          className={`station-flap-char${animatingSet.has(i) ? ' station-flap-animating' : ''}`}
          style={animatingSet.has(i) ? { animationDelay: `${i * 25}ms` } : undefined}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  );
}
