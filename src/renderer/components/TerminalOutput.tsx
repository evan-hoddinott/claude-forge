import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translateCommandOrRaw } from '../utils/command-translator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface TerminalStep {
  id: string;
  command: string;
  description: string;
  status: StepStatus;
  output?: string[];
}

interface TerminalOutputProps {
  steps: TerminalStep[];
  rawLines?: string[];
  defaultMode?: 'plain' | 'raw';
}

// ---------------------------------------------------------------------------
// Status icons
// ---------------------------------------------------------------------------

const statusIcons: Record<StepStatus, React.ReactNode> = {
  completed: <span className="text-status-ready">&#x2705;</span>,
  running: (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
      className="inline-block text-accent"
    >
      &#x1F504;
    </motion.span>
  ),
  pending: <span className="text-text-muted">&#x2B1C;</span>,
  failed: <span className="text-status-error">&#x274C;</span>,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TerminalOutput({
  steps,
  rawLines = [],
  defaultMode = 'plain',
}: TerminalOutputProps) {
  const [mode, setMode] = useState<'plain' | 'raw'>(defaultMode);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [steps, rawLines]);

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const totalSteps = steps.length;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
        <span className="text-xs font-semibold text-text-primary">Terminal Output</span>
        <button
          onClick={() => setMode((m) => (m === 'plain' ? 'raw' : 'plain'))}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/8 text-[10px] font-medium text-text-secondary transition-colors"
        >
          {mode === 'plain' ? 'Plain English' : 'Raw'}
          <span className="text-text-muted">\u2194</span>
          {mode === 'plain' ? 'Raw' : 'Plain English'}
        </button>
      </div>

      {/* Body */}
      <div ref={scrollRef} className="max-h-64 overflow-y-auto">
        <AnimatePresence mode="wait">
          {mode === 'plain' ? (
            <motion.div
              key="plain"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 space-y-1.5"
            >
              {steps.map((step) => (
                <div key={step.id}>
                  <div className="flex items-start gap-2.5">
                    <span className="shrink-0 mt-0.5 text-sm leading-none">
                      {statusIcons[step.status]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary leading-snug">
                        {step.description || translateCommandOrRaw(step.command)}
                      </p>
                      {step.status === 'running' && step.command && (
                        <p className="text-xs text-text-muted mt-0.5 italic">
                          {translateCommandOrRaw(step.command)}
                        </p>
                      )}
                    </div>
                    {step.command && (
                      <button
                        onClick={() =>
                          setExpandedStep((prev) =>
                            prev === step.id ? null : step.id,
                          )
                        }
                        className="shrink-0 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                      >
                        {expandedStep === step.id ? 'Hide' : "What's happening?"}
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {expandedStep === step.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-7 mt-1 px-2.5 py-1.5 rounded-md bg-white/[0.03] border border-white/6 font-mono text-[11px] text-text-muted">
                          <span className="text-accent/60">$</span> {step.command}
                          {step.output && step.output.length > 0 && (
                            <div className="mt-1 text-text-muted/70">
                              {step.output.slice(-5).map((line, i) => (
                                <div key={i} className="whitespace-pre-wrap break-all">
                                  {line}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {/* Progress bar */}
              {totalSteps > 0 && (
                <div className="pt-2 mt-2 border-t border-white/6">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-accent"
                        initial={{ width: 0 }}
                        animate={{
                          width: `${(completedCount / totalSteps) * 100}%`,
                        }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                    <span className="text-[10px] text-text-muted shrink-0">
                      {completedCount} of {totalSteps} steps
                    </span>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="raw"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-4 font-mono text-[11px] leading-relaxed text-text-secondary bg-black/20 min-h-[80px]"
            >
              {rawLines.length > 0
                ? rawLines.map((line, i) => (
                    <div key={i} className="whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))
                : steps.map((step) => (
                    <div key={step.id}>
                      <div>
                        <span className="text-accent/60">$</span> {step.command}
                      </div>
                      {step.output?.map((line, i) => (
                        <div key={i} className="text-text-muted whitespace-pre-wrap break-all">
                          {line}
                        </div>
                      ))}
                    </div>
                  ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
