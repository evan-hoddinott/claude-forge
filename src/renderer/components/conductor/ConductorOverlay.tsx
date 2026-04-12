import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAPI } from '../../hooks/useAPI';
import { useToast } from '../Toast';
import type { ConductorPlan, ConductorAnswer, ControlLevel, AgentType } from '../../../shared/types';
import GoalInput from './GoalInput';
import QAScreen from './QAScreen';
import PlanReview from './PlanReview';
import ExecutionView from './ExecutionView';
import CheckpointModal from './CheckpointModal';
import CompletionScreen from './CompletionScreen';

interface ConductorOverlayProps {
  projectId: string;
  projectName: string;
  projectPath: string;
  onClose: () => void;
}

type Step = 'goal' | 'qa' | 'plan' | 'execution' | 'checkpoint' | 'complete';

export default function ConductorOverlay({
  projectId,
  projectName,
  projectPath,
  onClose,
}: ConductorOverlayProps) {
  const api = useAPI();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('goal');
  const [plan, setPlan] = useState<ConductorPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load any existing active plan on mount
  useEffect(() => {
    api.conductor.getPlan(projectId).then((existingPlan) => {
      if (existingPlan && existingPlan.status !== 'completed' && existingPlan.status !== 'failed') {
        setPlan(existingPlan);
        switch (existingPlan.status) {
          case 'answering':  setStep('qa'); break;
          case 'reviewing':  setStep('plan'); break;
          case 'executing':
          case 'paused':     setStep('execution'); break;
          case 'checkpoint': setStep('checkpoint'); break;
          default:           setStep('goal');
        }
      }
    }).catch(() => {/* no existing plan */});
  }, [api, projectId]);

  // Listen for plan status updates
  useEffect(() => {
    api.conductor.onStatusUpdate((data: { planId: string; plan: ConductorPlan }) => {
      if (plan && data.planId === plan.id) {
        setPlan(data.plan);
        switch (data.plan.status) {
          case 'checkpoint': setStep('checkpoint'); break;
          case 'completed':  setStep('complete'); break;
          case 'failed':     setStep('complete'); break;
          case 'executing':
          case 'paused':     if (step !== 'execution') setStep('execution'); break;
        }
      }
    });
    return () => api.conductor.offStatusUpdate();
  }, [api, plan, step]);

  async function handleGoalSubmit(goal: string, controlLevel: ControlLevel) {
    setLoading(true);
    setError(null);
    try {
      const newPlan = await api.conductor.startPlan(projectId, goal, controlLevel);
      setPlan(newPlan);
      if (newPlan.status === 'answering' && newPlan.questions && newPlan.questions.length > 0) {
        setStep('qa');
      } else {
        setStep('plan');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start conductor');
      toast('Conductor failed to start. Check your AI provider settings.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAnswersSubmit(answers: ConductorAnswer[]) {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.conductor.submitAnswers(plan.id, answers);
      setPlan(updated);
      setStep('plan');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit answers');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartExecution() {
    if (!plan) return;
    setLoading(true);
    setError(null);
    try {
      await api.conductor.startExecution(plan.id);
      setStep('execution');

      // Express mode: countdown
      if (plan.controlLevel === 'express') {
        toast('🚂 Conductor departing in 3...');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start execution');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckpointDecision(decision: 'continue' | 'pause' | 'revert' | 'stop') {
    if (!plan) return;
    try {
      await api.conductor.checkpointDecision(plan.id, decision);
      if (decision === 'stop') {
        setStep('complete');
      } else {
        setStep('execution');
      }
    } catch (err) {
      toast('Failed to send checkpoint decision');
    }
  }

  async function handleReassignTask(taskId: string, agent: AgentType) {
    if (!plan) return;
    try {
      const updated = await api.conductor.reassignTask(plan.id, taskId, agent);
      setPlan(updated);
    } catch {
      toast('Failed to reassign task');
    }
  }

  const currentStation = plan ? plan.stations[plan.currentStationIndex] : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex"
      style={{ background: 'rgba(26,30,20,0.95)' }}
    >
      {/* Main panel */}
      <div
        className="flex flex-col w-full h-full"
        style={{
          border: '2px solid var(--forge-border)',
          background: 'var(--forge-bg-deep)',
          fontFamily: 'var(--forge-font-body)',
        }}
      >
        {/* Top bar */}
        <div
          className="shrink-0 flex items-center justify-between px-4 py-2"
          style={{
            borderBottom: '2px solid var(--forge-border)',
            background: 'var(--forge-bg-mid)',
          }}
        >
          <div className="flex items-center gap-3">
            <span
              style={{
                fontFamily: 'var(--forge-font-heading)',
                fontSize: '12px',
                color: 'var(--forge-text-heading)',
                letterSpacing: '1px',
              }}
            >
              🚂 CONDUCTOR
            </span>
            <span style={{ color: 'var(--forge-border)' }}>|</span>
            <span
              style={{
                fontFamily: 'var(--forge-font-body)',
                fontSize: '11px',
                color: 'var(--forge-text-muted)',
              }}
            >
              {projectName}
            </span>
            {plan && (
              <>
                <span style={{ color: 'var(--forge-border)' }}>|</span>
                <StepBreadcrumb step={step} />
              </>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              color: 'var(--forge-text-muted)',
              background: 'none',
              border: '1px solid var(--forge-border)',
              padding: '2px 8px',
              cursor: 'pointer',
              fontFamily: 'var(--forge-font-heading)',
              fontSize: '10px',
            }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="shrink-0 px-4 py-2 text-[11px]"
            style={{
              background: 'rgba(139,69,19,0.15)',
              borderBottom: '1px solid var(--forge-accent-rust)',
              color: 'var(--forge-accent-rust)',
            }}
          >
            ⚠ {error}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 'goal' && (
              <StepWrapper key="goal">
                <GoalInput
                  projectName={projectName}
                  onSubmit={handleGoalSubmit}
                  loading={loading}
                />
              </StepWrapper>
            )}

            {step === 'qa' && plan?.questions && plan.questions.length > 0 && (
              <StepWrapper key="qa">
                <QAScreen
                  questions={plan.questions}
                  onSubmit={handleAnswersSubmit}
                  loading={loading}
                />
              </StepWrapper>
            )}

            {step === 'plan' && plan && (
              <StepWrapper key="plan">
                <PlanReview
                  plan={plan}
                  onStart={handleStartExecution}
                  onBack={() => setStep(plan.questions?.length ? 'qa' : 'goal')}
                  onReassignTask={handleReassignTask}
                  loading={loading}
                />
              </StepWrapper>
            )}

            {step === 'execution' && plan && (
              <StepWrapper key="execution">
                <ExecutionView
                  plan={plan}
                  onPause={() => api.conductor.pause(plan.id)}
                  onResume={() => api.conductor.resume(plan.id)}
                  onSkipTask={() => api.conductor.skipTask(plan.id)}
                  onStop={() => api.conductor.stop(plan.id)}
                  onReassignTask={handleReassignTask}
                />
              </StepWrapper>
            )}

            {step === 'checkpoint' && plan && currentStation && (
              <StepWrapper key="checkpoint">
                <CheckpointModal
                  plan={plan}
                  station={currentStation}
                  onDecision={handleCheckpointDecision}
                />
              </StepWrapper>
            )}

            {step === 'complete' && plan && (
              <StepWrapper key="complete">
                <CompletionScreen plan={plan} onClose={onClose} />
              </StepWrapper>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

function StepWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.15 }}
    >
      {children}
    </motion.div>
  );
}

const STEP_LABELS: Record<Step, string> = {
  goal:        'Goal',
  qa:          'Questions',
  plan:        'Plan Review',
  execution:   'Executing',
  checkpoint:  'Checkpoint',
  complete:    'Complete',
};

function StepBreadcrumb({ step }: { step: Step }) {
  const steps: Step[] = ['goal', 'qa', 'plan', 'execution', 'complete'];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="flex items-center gap-1 text-[10px]" style={{ fontFamily: 'var(--forge-font-heading)' }}>
      {steps.map((s, idx) => (
        <span
          key={s}
          style={{
            color:
              s === step
                ? 'var(--forge-accent-amber)'
                : idx < currentIdx
                ? 'var(--forge-accent-green)'
                : 'var(--forge-text-muted)',
          }}
        >
          {idx > 0 && <span style={{ color: 'var(--forge-text-muted)', margin: '0 2px' }}>›</span>}
          {STEP_LABELS[s]}
        </span>
      ))}
    </div>
  );
}
