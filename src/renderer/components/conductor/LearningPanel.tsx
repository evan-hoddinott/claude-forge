import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ConductorPlan } from '../../../shared/types';

interface LearningPanelProps {
  plan: ConductorPlan;
  onToggle: () => void;
}

export default function LearningPanel({ plan, onToggle }: LearningPanelProps) {
  const [expanded, setExpanded] = useState(true);

  const annotations = plan.learningAnnotations ?? {};
  const currentStation = plan.stations[plan.currentStationIndex];
  const currentTask = currentStation?.tasks[plan.currentTaskIndex];

  const currentAnnotation = currentTask ? annotations[currentTask.id] : null;
  const completedAnnotations = plan.stations
    .flatMap((s) => s.tasks)
    .filter((t) => t.status === 'completed' && annotations[t.id])
    .slice(-3);

  return (
    <div style={{
      width: expanded ? 260 : 36,
      flexShrink: 0,
      borderLeft: '1px solid var(--station-border)',
      background: 'var(--station-bg-mid)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
    }}>
      {/* Toggle header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Collapse learning panel' : 'Expand learning panel'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px',
          background: 'none',
          border: 'none',
          borderBottom: '1px solid var(--station-border)',
          cursor: 'pointer',
          color: 'var(--station-brass)',
          fontFamily: 'var(--caboo-font-heading)',
          fontSize: 9,
          letterSpacing: 1,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        <span>💡</span>
        {expanded && <span>LEARNING MODE</span>}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto"
            style={{ padding: 10 }}
          >
            {/* Current task annotation */}
            {currentAnnotation && (
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontFamily: 'var(--caboo-font-heading)',
                  fontSize: 9,
                  color: 'var(--station-brass)',
                  letterSpacing: 1,
                  marginBottom: 4,
                }}>
                  NOW HAPPENING
                </div>
                <div style={{
                  padding: 8,
                  background: 'rgba(196,162,101,0.06)',
                  border: '1px solid rgba(196,162,101,0.2)',
                  fontSize: 10,
                  color: 'var(--station-text-secondary)',
                  lineHeight: 1.5,
                }}>
                  {currentAnnotation}
                </div>
              </div>
            )}

            {!currentAnnotation && currentTask && (
              <div style={{
                padding: 8,
                border: '1px solid var(--station-border)',
                fontSize: 10,
                color: 'var(--station-text-dim)',
                marginBottom: 12,
                lineHeight: 1.4,
              }}>
                <span style={{ marginRight: 4 }}>🔄</span>
                {currentTask.description}
              </div>
            )}

            {/* Completed annotations */}
            {completedAnnotations.length > 0 && (
              <div>
                <div style={{
                  fontFamily: 'var(--caboo-font-heading)',
                  fontSize: 9,
                  color: 'var(--station-text-dim)',
                  letterSpacing: 1,
                  marginBottom: 4,
                }}>
                  WHAT WE LEARNED
                </div>
                {completedAnnotations.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      marginBottom: 6,
                      padding: '6px 8px',
                      background: 'var(--station-bg-deep)',
                      border: '1px solid var(--station-border)',
                      fontSize: 10,
                      color: 'var(--station-text-dim)',
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ color: 'var(--station-signal-green)', marginBottom: 2, fontSize: 9 }}>
                      ✓ {task.description}
                    </div>
                    {annotations[task.id]}
                  </div>
                ))}
              </div>
            )}

            {!currentAnnotation && completedAnnotations.length === 0 && (
              <div style={{ fontSize: 10, color: 'var(--station-text-dim)', lineHeight: 1.5 }}>
                Annotations will appear here as the Conductor works. Learning mode adds beginner-friendly explanations for each step.
              </div>
            )}

            <div style={{ marginTop: 12, paddingTop: 8, borderTop: '1px solid var(--station-border)' }}>
              <button
                onClick={onToggle}
                style={{
                  width: '100%',
                  padding: '5px 8px',
                  background: 'none',
                  border: '1px solid var(--station-border)',
                  color: 'var(--station-text-dim)',
                  fontFamily: 'var(--caboo-font-heading)',
                  fontSize: 9,
                  cursor: 'pointer',
                  letterSpacing: 1,
                }}
              >
                DISABLE LEARNING MODE
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
