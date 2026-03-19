import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppMode } from '../../shared/types';

interface OnboardingTutorialProps {
  mode: AppMode;
  onComplete: () => void;
  /** If true, wait for the user to click the New Project button to advance past step 3 */
  onRequestNewProject?: () => void;
}

interface TutorialStep {
  /** CSS selector of the element to spotlight, or null for a centered card */
  target: string | null;
  /** Where to position the tooltip relative to the target */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Title text */
  title: string;
  /** Body text — simple mode */
  bodySimple: string;
  /** Body text — developer mode */
  bodyDev: string;
  /** If true, the step advances by clicking the target element, not Next */
  waitForClick?: boolean;
}

const STEPS: TutorialStep[] = [
  {
    target: '[data-tutorial="sidebar"]',
    placement: 'right',
    title: 'Your navigation',
    bodySimple: 'This is your menu. Dashboard shows all your projects, Settings lets you customize the app.',
    bodyDev: 'Sidebar navigation — Dashboard view, Settings, plus connection status for GitHub and AI agents.',
  },
  {
    target: '[data-tutorial="connections"]',
    placement: 'right',
    title: 'Connection status',
    bodySimple: 'These show if your AI tools and GitHub are connected. Green means ready to go!',
    bodyDev: 'GitHub CLI auth and AI agent statuses. Expand each to install, update, or authenticate.',
  },
  {
    target: '[data-tutorial="new-project"]',
    placement: 'top',
    title: 'Create a project',
    bodySimple: 'Click here to start a new project. Let\'s try it now!',
    bodyDev: 'New Project button — opens the project creation wizard. Click it now to continue.',
    waitForClick: true,
  },
  {
    target: '[data-tutorial="wizard-name"]',
    placement: 'bottom',
    title: 'Name your project',
    bodySimple: 'Give your project a name. Something like "my-first-website".',
    bodyDev: 'Project name — used as the folder name and GitHub repo name. Keep it lowercase-with-dashes.',
  },
  {
    target: '[data-tutorial="wizard-templates"]',
    placement: 'bottom',
    title: 'Pick a template',
    bodySimple: 'Pick a template to get started fast, or build from scratch.',
    bodyDev: 'Templates pre-fill guided inputs for common project types. Choose one or start from scratch.',
  },
  {
    target: '[data-tutorial="wizard-inputs"]',
    placement: 'bottom',
    title: 'Describe your project',
    bodySimple: 'Add details about what you want to build. The more you describe, the better the AI will understand.',
    bodyDev: 'Context inputs — key-value pairs written to CLAUDE.md/GEMINI.md. These guide the AI agent.',
  },
  {
    target: '[data-tutorial="wizard-github"]',
    placement: 'bottom',
    title: 'GitHub integration',
    bodySimple: 'Connect a GitHub repo to save your code online and collaborate with others. You can skip this for now.',
    bodyDev: 'Create a new repo, link an existing one, or skip. You can always add GitHub later from the project detail page.',
  },
  {
    target: null,
    placement: 'center',
    title: 'You\'re ready!',
    bodySimple: 'That\'s it! When you\'re ready, click Create and the AI will start building your project. Happy coding!',
    bodyDev: 'Setup complete. The review step shows a CLAUDE.md preview — verify the context before creating. Happy coding!',
  },
];

export default function OnboardingTutorial({ mode, onComplete, onRequestNewProject }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(true);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = STEPS[currentStep];

  // Find and measure target element
  const measureTarget = useCallback(() => {
    if (!step.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.target);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  useEffect(() => {
    measureTarget();
    // Re-measure on resize/scroll
    window.addEventListener('resize', measureTarget);
    window.addEventListener('scroll', measureTarget, true);
    const interval = setInterval(measureTarget, 500); // poll for dynamic elements
    return () => {
      window.removeEventListener('resize', measureTarget);
      window.removeEventListener('scroll', measureTarget, true);
      clearInterval(interval);
    };
  }, [measureTarget, currentStep]);

  // Handle click-to-advance steps
  useEffect(() => {
    if (!step.waitForClick || !step.target) return;

    function handleClick(e: MouseEvent) {
      const el = document.querySelector(step.target!);
      if (el && (el === e.target || el.contains(e.target as Node))) {
        // The actual target was clicked — advance the tutorial
        setTimeout(() => {
          setCurrentStep((s) => s + 1);
        }, 300);
      }
    }

    // Use capture so we see the click before it's consumed
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [step, currentStep]);

  // Safety valve: Escape always dismisses the tutorial
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        handleDismiss();
      }
    }
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  function handleNext() {
    if (step.waitForClick && onRequestNewProject) {
      // Programmatically trigger the New Project wizard AND advance the tutorial
      onRequestNewProject();
      setTimeout(() => {
        setCurrentStep((s) => s + 1);
      }, 300);
      return;
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleDismiss();
    }
  }

  function handleDismiss() {
    setVisible(false);
    setTimeout(onComplete, 200);
  }

  if (!visible) return null;

  const body = mode === 'simple' ? step.bodySimple : step.bodyDev;
  const isLast = currentStep === STEPS.length - 1;
  const padding = 8;

  // Compute tooltip position
  let tooltipStyle: React.CSSProperties = {};
  if (step.placement === 'center' || !targetRect) {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    };
  } else {
    const gap = 12;
    switch (step.placement) {
      case 'right':
        tooltipStyle = {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2,
          left: targetRect.right + gap,
          transform: 'translateY(-50%)',
        };
        break;
      case 'left':
        tooltipStyle = {
          position: 'fixed',
          top: targetRect.top + targetRect.height / 2,
          right: window.innerWidth - targetRect.left + gap,
          transform: 'translateY(-50%)',
        };
        break;
      case 'bottom':
        tooltipStyle = {
          position: 'fixed',
          top: targetRect.bottom + gap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
        break;
      case 'top':
        tooltipStyle = {
          position: 'fixed',
          bottom: window.innerHeight - targetRect.top + gap,
          left: targetRect.left + targetRect.width / 2,
          transform: 'translateX(-50%)',
        };
        break;
    }
  }

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[60]" style={{ pointerEvents: 'none' }}>
      {/* Dimmed overlay with spotlight cutout */}
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: 'auto' }}>
        <defs>
          <mask id="tutorial-spotlight">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && (
              <rect
                x={targetRect.left - padding}
                y={targetRect.top - padding}
                width={targetRect.width + padding * 2}
                height={targetRect.height + padding * 2}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.7)"
          mask="url(#tutorial-spotlight)"
          onClick={(e) => {
            // Clicking the dim area does nothing (or dismiss?)
            e.stopPropagation();
          }}
        />
      </svg>

      {/* Glowing border around spotlight */}
      {targetRect && (
        <div
          className="fixed border-2 border-accent/60 rounded-xl pointer-events-none"
          style={{
            left: targetRect.left - padding,
            top: targetRect.top - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            boxShadow: '0 0 20px var(--color-accent-glow), inset 0 0 20px var(--color-accent-glow)',
          }}
        />
      )}

      {/* Make the spotlighted area clickable — clicks pass through to the actual element */}
      {targetRect && (
        <div
          className="fixed cursor-pointer"
          style={{
            left: targetRect.left - padding,
            top: targetRect.top - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            pointerEvents: 'auto',
          }}
          onClick={() => {
            // For waitForClick steps, programmatically click the target element
            if (step.waitForClick && step.target) {
              const el = document.querySelector(step.target) as HTMLElement | null;
              if (el) el.click();
            }
          }}
        />
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -6 }}
          transition={{ duration: 0.2 }}
          style={{ ...tooltipStyle, pointerEvents: 'auto' }}
          className="w-72 bg-surface border border-white/[0.1] rounded-xl shadow-2xl p-4"
        >
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium text-text-muted">
              {currentStep + 1} of {STEPS.length}
            </span>
            <button
              onClick={handleDismiss}
              className="text-[10px] text-text-muted hover:text-text-secondary transition-colors"
            >
              Skip Tutorial
            </button>
          </div>

          <h3 className="text-sm font-semibold text-text-primary mb-1.5">
            {step.title}
          </h3>
          <p className="text-xs text-text-secondary leading-relaxed mb-4">
            {body}
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === currentStep ? 'bg-accent' : i < currentStep ? 'bg-accent/40' : 'bg-white/10'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              className="px-4 py-1.5 rounded-lg bg-accent hover:bg-accent-hover text-bg text-xs font-semibold transition-colors"
            >
              {isLast ? 'Got it!' : step.waitForClick ? 'Click the button' : 'Next'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
