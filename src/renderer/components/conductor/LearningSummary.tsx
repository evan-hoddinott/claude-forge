import type { ConductorPlan } from '../../../shared/types';

interface LearningSummaryProps {
  plan: ConductorPlan;
}

export default function LearningSummary({ plan }: LearningSummaryProps) {
  const annotations = plan.learningAnnotations ?? {};
  const completedTasks = plan.stations
    .flatMap((s) => s.tasks)
    .filter((t) => t.status === 'completed' && annotations[t.id]);

  if (completedTasks.length === 0) return null;

  const concepts = completedTasks.map((t) => ({
    task: t.description,
    explanation: annotations[t.id],
  }));

  return (
    <div style={{
      marginTop: 16,
      border: '1px solid rgba(196,162,101,0.3)',
      background: 'rgba(196,162,101,0.04)',
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid rgba(196,162,101,0.2)',
        fontFamily: 'var(--caboo-font-heading)',
        fontSize: 10,
        color: 'var(--station-brass)',
        letterSpacing: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        <span>💡</span>
        <span>WHAT YOU LEARNED THIS SESSION</span>
      </div>
      <div style={{ padding: '10px 12px', maxHeight: 260, overflowY: 'auto' }}>
        {concepts.map((c, i) => (
          <div
            key={i}
            style={{
              marginBottom: 10,
              paddingBottom: 10,
              borderBottom: i < concepts.length - 1 ? '1px solid var(--station-border)' : 'none',
            }}
          >
            <div style={{
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: 9,
              color: 'var(--station-signal-green)',
              letterSpacing: 0.5,
              marginBottom: 3,
            }}>
              ✓ {c.task}
            </div>
            <div style={{ fontSize: 10, color: 'var(--station-text-secondary)', lineHeight: 1.5 }}>
              {c.explanation}
            </div>
          </div>
        ))}
      </div>
      <div style={{
        padding: '6px 12px',
        borderTop: '1px solid rgba(196,162,101,0.2)',
        fontSize: 9,
        color: 'var(--station-text-dim)',
        fontFamily: 'var(--caboo-font-heading)',
        letterSpacing: 1,
      }}>
        {completedTasks.length} CONCEPTS LEARNED · SAVED TO .CABOO/LEARNING/
      </div>
    </div>
  );
}
