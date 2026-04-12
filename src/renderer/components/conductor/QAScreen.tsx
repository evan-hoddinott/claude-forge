import { useState } from 'react';
import type { ConductorQuestion, ConductorAnswer } from '../../../shared/types';

interface QAScreenProps {
  questions: ConductorQuestion[];
  onSubmit: (answers: ConductorAnswer[]) => void;
  loading?: boolean;
}

export default function QAScreen({ questions, onSubmit, loading = false }: QAScreenProps) {
  const [selected, setSelected] = useState<Record<string, string>>({});

  const allAnswered = questions.every((q) => selected[q.id]);

  function handleSelect(questionId: string, optionId: string) {
    setSelected((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function handleSubmit() {
    if (!allAnswered) return;
    const answers: ConductorAnswer[] = Object.entries(selected).map(([questionId, optionId]) => ({
      questionId,
      optionId,
    }));
    onSubmit(answers);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div
        className="shrink-0 px-6 py-4"
        style={{ borderBottom: '2px solid var(--forge-border)' }}
      >
        <div
          style={{
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '16px',
            color: 'var(--forge-text-heading)',
            letterSpacing: '1px',
          }}
        >
          🚂 The Conductor has some questions...
        </div>
        <div
          style={{
            fontFamily: 'var(--forge-font-body)',
            fontSize: '11px',
            color: 'var(--forge-text-muted)',
            marginTop: '4px',
          }}
        >
          Your answers help plan the best approach for your project.
        </div>
      </div>

      {/* Questions */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-8">
        {questions.map((question, qi) => (
          <div key={question.id}>
            <div
              style={{
                fontFamily: 'var(--forge-font-heading)',
                fontSize: '11px',
                color: 'var(--forge-text-secondary)',
                marginBottom: '12px',
                letterSpacing: '0.5px',
              }}
            >
              Q{qi + 1}: {question.text}
            </div>
            <div className="space-y-2">
              {question.options.map((option) => {
                const isSelected = selected[question.id] === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(question.id, option.id)}
                    disabled={loading}
                    className="w-full text-left transition-all"
                    style={{
                      border: `2px solid ${isSelected ? 'var(--forge-accent-amber)' : 'var(--forge-border)'}`,
                      background: isSelected ? 'var(--forge-bg-surface)' : 'var(--forge-bg-mid)',
                      padding: '10px 12px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          border: `2px solid ${isSelected ? 'var(--forge-accent-amber)' : 'var(--forge-border)'}`,
                          background: isSelected ? 'var(--forge-accent-amber)' : 'transparent',
                          flexShrink: 0,
                          marginTop: '2px',
                        }}
                      />
                      <div>
                        <div
                          style={{
                            fontFamily: 'var(--forge-font-heading)',
                            fontSize: '10px',
                            color: isSelected ? 'var(--forge-text-heading)' : 'var(--forge-text-primary)',
                            marginBottom: '2px',
                          }}
                        >
                          {option.label}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--forge-font-body)',
                            fontSize: '11px',
                            color: 'var(--forge-text-secondary)',
                            marginBottom: '4px',
                          }}
                        >
                          {option.description}
                        </div>
                        {(option.pros || option.cons) && (
                          <div className="flex gap-4 mt-1">
                            {option.pros && (
                              <div
                                style={{
                                  fontFamily: 'var(--forge-font-body)',
                                  fontSize: '10px',
                                  color: 'var(--forge-accent-green)',
                                }}
                              >
                                ✅ {option.pros}
                              </div>
                            )}
                            {option.cons && (
                              <div
                                style={{
                                  fontFamily: 'var(--forge-font-body)',
                                  fontSize: '10px',
                                  color: 'var(--forge-accent-amber)',
                                }}
                              >
                                ⚠️ {option.cons}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div
        className="shrink-0 px-6 py-4"
        style={{ borderTop: '2px solid var(--forge-border)' }}
      >
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          style={{
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '12px',
            padding: '10px 24px',
            background: allAnswered && !loading ? 'var(--forge-accent-amber)' : 'var(--forge-bg-surface)',
            color: allAnswered && !loading ? 'var(--forge-bg-deep)' : 'var(--forge-text-muted)',
            border: '2px solid',
            borderColor: allAnswered && !loading ? 'var(--forge-accent-amber)' : 'var(--forge-border)',
            cursor: allAnswered && !loading ? 'pointer' : 'not-allowed',
            letterSpacing: '1px',
          }}
        >
          {loading ? 'Building plan...' : `Submit Answers → (${Object.keys(selected).length}/${questions.length})`}
        </button>
      </div>
    </div>
  );
}
