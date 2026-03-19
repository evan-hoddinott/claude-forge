import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTooltip } from '../utils/tooltips';

interface HelpTooltipProps {
  term: string;
  className?: string;
}

/**
 * Shows a small (?) icon that displays a contextual tooltip on hover.
 * Intended for Simple Mode only — parent should conditionally render.
 */
export default function HelpTooltip({ term, className }: HelpTooltipProps) {
  const tooltip = getTooltip(term);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!tooltip) return null;

  function handleEnter() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // Determine position based on viewport space
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition(rect.top < 160 ? 'below' : 'above');
    }
    timeoutRef.current = setTimeout(() => setVisible(true), 200);
  }

  function handleLeave() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setVisible(false), 100);
  }

  return (
    <span
      className={`relative inline-flex items-center ${className ?? ''}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        tabIndex={0}
        className="w-3.5 h-3.5 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-[9px] font-bold text-text-muted hover:text-text-secondary hover:border-white/25 transition-colors cursor-help"
        aria-label={`Help: ${tooltip.title}`}
      >
        ?
      </button>

      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: position === 'above' ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: position === 'above' ? 4 : -4 }}
            transition={{ duration: 0.12 }}
            className={`absolute z-50 w-60 p-3 rounded-lg bg-surface border border-white/10 shadow-xl ${
              position === 'above'
                ? 'bottom-full mb-1.5 left-1/2 -translate-x-1/2'
                : 'top-full mt-1.5 left-1/2 -translate-x-1/2'
            }`}
            onMouseEnter={() => {
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
            }}
            onMouseLeave={handleLeave}
          >
            <p className="text-xs font-semibold text-text-primary mb-1">
              {tooltip.title}
            </p>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              {tooltip.description}
            </p>
            {tooltip.learnMoreUrl && (
              <button
                onClick={() => window.electronAPI?.system.openExternal(tooltip.learnMoreUrl!)}
                className="text-[10px] text-accent hover:underline mt-1.5 block"
              >
                Learn more \u2192
              </button>
            )}
            {/* Arrow */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-surface border border-white/10 rotate-45 ${
                position === 'above'
                  ? 'bottom-[-5px] border-t-0 border-l-0'
                  : 'top-[-5px] border-b-0 border-r-0'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
