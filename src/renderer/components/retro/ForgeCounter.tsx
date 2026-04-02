import { useState, useEffect, useRef } from 'react';
import { useAPI, useQuery } from '../../hooks/useAPI';

function CounterDigit({ digit }: { digit: string }) {
  return <span className="forge-counter-digit">{digit}</span>;
}

function PaddedNumber({ value, digits = 3 }: { value: number; digits?: number }) {
  const str = String(value).padStart(digits, '0');
  return (
    <>
      {str.split('').map((d, i) => (
        <CounterDigit key={i} digit={d} />
      ))}
    </>
  );
}

interface ForgeCounterProps {
  className?: string;
}

export default function ForgeCounter({ className = '' }: ForgeCounterProps) {
  const api = useAPI();
  const { data: projects } = useQuery(() => api.projects.list());
  const [agentCount, setAgentCount] = useState(0);
  const checkedRef = useRef(false);

  const projectCount = projects?.length ?? 0;
  // Rough file estimate: average ~15 files per project
  const fileEstimate = projectCount * 15;

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;
    api.agent.checkAllStatuses().then((statuses) => {
      let count = 0;
      for (const key of Object.keys(statuses)) {
        if (statuses[key as keyof typeof statuses]?.installed) count++;
      }
      setAgentCount(count);
    }).catch(() => { /* agent status check failed — non-critical */ });
  }, [api]);

  return (
    <div className={`forge-counter ${className}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ fontSize: 10 }}>{'\u2692'}</span>
        <span className="forge-counter-label">projects forged:</span>
        <PaddedNumber value={projectCount} />
      </div>
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ fontSize: 10 }}>{'\uD83D\uDCC1'}</span>
        <span className="forge-counter-label">files crafted:</span>
        <PaddedNumber value={fileEstimate} />
      </div>
      <div className="flex items-center gap-1.5">
        <span style={{ fontSize: 10 }}>{'\uD83D\uDD25'}</span>
        <span className="forge-counter-label">agents active:</span>
        <PaddedNumber value={agentCount} digits={2} />
      </div>
    </div>
  );
}
