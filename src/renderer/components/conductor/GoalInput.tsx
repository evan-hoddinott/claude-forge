import { useState } from 'react';
import type { ControlLevel } from '../../../shared/types';

interface GoalInputProps {
  onSubmit: (goal: string, controlLevel: ControlLevel) => void;
  loading?: boolean;
  projectName: string;
}

const CONTROL_LEVELS: Array<{
  id: ControlLevel;
  label: string;
  emoji: string;
  description: string;
  detail: string;
}> = [
  {
    id: 'express',
    label: 'Express',
    emoji: '🟢',
    description: '"Just build it"',
    detail: 'Conductor plans + executes automatically. Only stops for critical decisions.',
  },
  {
    id: 'guided',
    label: 'Guided',
    emoji: '🟡',
    description: '"Let me approve big steps"',
    detail: 'Conductor plans + asks questions. Pauses at checkpoints for your approval.',
  },
  {
    id: 'full-control',
    label: 'Full Control',
    emoji: '🔴',
    description: '"I want to see everything"',
    detail: 'You approve every task. Drag to reorder, reassign agents, edit prompts.',
  },
];

const EXAMPLE_GOALS = [
  'Add user authentication with Google login',
  'Build a REST API with CRUD endpoints',
  'Add dark mode and responsive design',
  'Write comprehensive unit tests',
  'Refactor the codebase to TypeScript',
];

export default function GoalInput({ onSubmit, loading = false, projectName }: GoalInputProps) {
  const [goal, setGoal] = useState('');
  const [controlLevel, setControlLevel] = useState<ControlLevel>('guided');

  const canSubmit = goal.trim().length > 10 && !loading;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12 max-w-2xl mx-auto w-full">
      {/* Header */}
      <div className="text-center mb-8">
        <div
          style={{
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '28px',
            color: 'var(--forge-text-heading)',
            letterSpacing: '2px',
            marginBottom: '8px',
          }}
        >
          🚂 CONDUCTOR
        </div>
        <div
          style={{
            fontFamily: 'var(--forge-font-body)',
            color: 'var(--forge-text-muted)',
            fontSize: '12px',
          }}
        >
          {projectName}
        </div>
        <div
          style={{
            width: '100%',
            height: '2px',
            background: 'var(--forge-border)',
            margin: '12px 0',
          }}
        />
      </div>

      {/* Goal input */}
      <div className="w-full mb-6">
        <label
          style={{
            display: 'block',
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '10px',
            color: 'var(--forge-text-secondary)',
            marginBottom: '8px',
            letterSpacing: '1px',
          }}
        >
          WHAT DO YOU WANT TO BUILD?
        </label>
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Describe your goal in plain English..."
          rows={4}
          disabled={loading}
          style={{
            width: '100%',
            background: 'var(--forge-bg-input)',
            border: '2px solid var(--forge-border)',
            color: 'var(--forge-text-primary)',
            fontFamily: 'var(--forge-font-body)',
            fontSize: '13px',
            padding: '12px',
            resize: 'vertical',
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = 'var(--forge-accent-amber)';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = 'var(--forge-border)';
          }}
        />

        {/* Example goals */}
        <div className="mt-2 flex flex-wrap gap-1">
          {EXAMPLE_GOALS.map((eg) => (
            <button
              key={eg}
              onClick={() => setGoal(eg)}
              disabled={loading}
              style={{
                border: '1px solid var(--forge-border)',
                background: 'transparent',
                color: 'var(--forge-text-muted)',
                fontFamily: 'var(--forge-font-body)',
                fontSize: '10px',
                padding: '2px 6px',
                cursor: 'pointer',
              }}
            >
              {eg}
            </button>
          ))}
        </div>
      </div>

      {/* Control level selector */}
      <div className="w-full mb-8">
        <div
          style={{
            fontFamily: 'var(--forge-font-heading)',
            fontSize: '10px',
            color: 'var(--forge-text-secondary)',
            marginBottom: '8px',
            letterSpacing: '1px',
          }}
        >
          ⚙ CONTROL LEVEL
        </div>
        <div className="flex gap-2">
          {CONTROL_LEVELS.map((level) => {
            const selected = controlLevel === level.id;
            return (
              <button
                key={level.id}
                onClick={() => setControlLevel(level.id)}
                disabled={loading}
                className="flex-1 px-3 py-3 text-left transition-all"
                style={{
                  border: `2px solid ${selected ? 'var(--forge-accent-amber)' : 'var(--forge-border)'}`,
                  background: selected ? 'var(--forge-bg-surface)' : 'var(--forge-bg-mid)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--forge-font-heading)',
                    fontSize: '10px',
                    color: selected ? 'var(--forge-text-heading)' : 'var(--forge-text-secondary)',
                    marginBottom: '4px',
                  }}
                >
                  {level.emoji} {level.label}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--forge-font-body)',
                    fontSize: '10px',
                    color: selected ? 'var(--forge-accent-amber)' : 'var(--forge-text-muted)',
                    marginBottom: '4px',
                  }}
                >
                  {level.description}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--forge-font-body)',
                    fontSize: '9px',
                    color: 'var(--forge-text-muted)',
                  }}
                >
                  {level.detail}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={() => canSubmit && onSubmit(goal.trim(), controlLevel)}
        disabled={!canSubmit}
        style={{
          fontFamily: 'var(--forge-font-heading)',
          fontSize: '14px',
          padding: '12px 32px',
          background: canSubmit ? 'var(--forge-accent-amber)' : 'var(--forge-bg-surface)',
          color: canSubmit ? 'var(--forge-bg-deep)' : 'var(--forge-text-muted)',
          border: '2px solid',
          borderColor: canSubmit ? 'var(--forge-accent-amber)' : 'var(--forge-border)',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'all 0.15s',
          letterSpacing: '1px',
        }}
      >
        {loading ? '🚂 Planning...' : '🚂 All Aboard →'}
      </button>
    </div>
  );
}
