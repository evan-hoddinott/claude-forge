import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAPI } from '../hooks/useAPI';
import { useToast } from './Toast';
import type { TestPipelineResult, TestStep } from '../../shared/types';

interface QualityTabProps {
  projectId: string;
  projectPath: string;
}

const STEP_ICONS: Record<string, string> = {
  tests:   '🧪',
  build:   '🔨',
  lint:    '📐',
  runtime: '⚡',
  review:  '🤖',
  notes:   '📋',
};

function StatusDot({ status }: { status: TestStep['status'] }) {
  const colors: Record<TestStep['status'], string> = {
    pending:  'var(--station-text-dim)',
    running:  'var(--station-signal-amber)',
    passed:   'var(--station-signal-green)',
    failed:   'var(--station-signal-red)',
    skipped:  'var(--station-text-dim)',
  };
  const labels: Record<TestStep['status'], string> = {
    pending: '···',
    running: '⟳',
    passed:  '✓',
    failed:  '✗',
    skipped: '—',
  };
  return (
    <span style={{ color: colors[status], fontFamily: 'var(--caboo-font-heading)', fontSize: 11, minWidth: 16, display: 'inline-block' }}>
      {labels[status]}
    </span>
  );
}

function StepRow({ step }: { step: TestStep }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--station-border)' }}>
      <div
        onClick={() => step.output && setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: step.output ? 'pointer' : 'default',
          background: step.status === 'running' ? 'rgba(212,160,57,0.05)' : 'transparent',
        }}
      >
        <StatusDot status={step.status} />
        <span style={{ fontSize: 11, marginRight: 4 }}>{STEP_ICONS[step.id] ?? '·'}</span>
        <span style={{ flex: 1, fontSize: 11, color: 'var(--station-text-primary)', fontFamily: 'var(--caboo-font-body)' }}>
          {step.label}
        </span>
        {step.duration != null && (
          <span style={{ fontSize: 10, color: 'var(--station-text-dim)' }}>
            {step.duration < 1000 ? `${step.duration}ms` : `${(step.duration / 1000).toFixed(1)}s`}
          </span>
        )}
        {step.output && (
          <span style={{ fontSize: 10, color: 'var(--station-text-dim)' }}>{expanded ? '▲' : '▼'}</span>
        )}
      </div>
      <AnimatePresence>
        {expanded && step.output && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ overflow: 'hidden' }}
          >
            <pre style={{
              margin: 0,
              padding: '8px 12px 8px 36px',
              fontSize: 10,
              fontFamily: 'var(--caboo-font-body)',
              color: 'var(--station-text-dim)',
              background: 'var(--station-bg-deep)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              maxHeight: 200,
              overflowY: 'auto',
              borderTop: '1px solid var(--station-border)',
            }}>
              {step.output}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ResultCard({ result }: { result: TestPipelineResult }) {
  const statusColor = result.overallStatus === 'passed'
    ? 'var(--station-signal-green)'
    : result.overallStatus === 'failed'
    ? 'var(--station-signal-red)'
    : 'var(--station-signal-amber)';

  const statusLabel = result.overallStatus.toUpperCase();

  return (
    <div style={{ border: '1px solid var(--station-border)', marginBottom: 12, background: 'var(--station-bg-surface)' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        borderBottom: '1px solid var(--station-border)',
        background: 'var(--station-bg-mid)',
      }}>
        <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, letterSpacing: 1, color: statusColor }}>
          {statusLabel}
        </div>
        <div style={{ fontSize: 10, color: 'var(--station-text-dim)' }}>
          {new Date(result.ranAt).toLocaleString()}
        </div>
      </div>
      {result.steps.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
      {result.aiNotes && (
        <div style={{
          padding: '8px 12px',
          borderTop: '1px solid var(--station-border)',
          fontSize: 10,
          color: 'var(--station-text-secondary)',
          lineHeight: 1.5,
          background: 'rgba(196,162,101,0.03)',
        }}>
          <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, color: 'var(--station-brass)', letterSpacing: 1, marginBottom: 4 }}>
            🤖 AI REVIEW
          </div>
          {result.aiNotes}
        </div>
      )}
    </div>
  );
}

export default function QualityTab({ projectId, projectPath }: QualityTabProps) {
  const api = useAPI();
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<TestPipelineResult[]>([]);
  const [liveResult, setLiveResult] = useState<TestPipelineResult | null>(null);

  useEffect(() => {
    api.testPipeline.getHistory(projectId).then(setHistory).catch(() => setHistory([]));
  }, [api, projectId]);

  // Listen for live progress
  useEffect(() => {
    api.testPipeline.onProgress((data: unknown) => {
      const { projectId: pid, step } = data as { projectId: string; step: TestStep };
      if (pid !== projectId) return;
      setLiveResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          steps: prev.steps.map((s) => s.id === step.id ? step : s),
        };
      });
    });
    return () => api.testPipeline.offProgress();
  }, [api, projectId]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    // Create a skeleton result for live display
    const skeleton: TestPipelineResult = {
      id: 'live',
      projectId,
      ranAt: new Date().toISOString(),
      overallStatus: 'partial',
      steps: [
        { id: 'tests',   label: 'Unit Tests',     status: 'pending' },
        { id: 'build',   label: 'Build',          status: 'pending' },
        { id: 'lint',    label: 'Lint',           status: 'pending' },
        { id: 'runtime', label: 'Runtime Check',  status: 'pending' },
        { id: 'review',  label: 'AI Code Review', status: 'pending' },
        { id: 'notes',   label: 'Test Report',    status: 'pending' },
      ],
    };
    setLiveResult(skeleton);

    try {
      const result = await api.testPipeline.run(projectId, projectPath);
      setLiveResult(null);
      setHistory((prev) => [result, ...prev.slice(0, 9)]);
      if (result.overallStatus === 'passed') {
        toast('Quality check passed!', 'success');
      } else if (result.overallStatus === 'failed') {
        toast('Quality check found issues', 'error');
      }
    } catch (err) {
      setLiveResult(null);
      toast('Quality check failed to run', 'error');
    } finally {
      setRunning(false);
    }
  }, [api, projectId, projectPath, toast]);

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--caboo-font-body)' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--station-border)',
        background: 'var(--station-bg-mid)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 10, color: 'var(--station-text-primary)', letterSpacing: 1 }}>
            QUALITY PIPELINE
          </div>
          <div style={{ fontSize: 10, color: 'var(--station-text-dim)', marginTop: 2 }}>
            Tests · Build · Lint · Runtime · AI Review
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          style={{
            padding: '6px 16px',
            background: running ? 'var(--station-bg-surface)' : 'var(--station-brass)',
            border: running ? '1px solid var(--station-border)' : '2px outset var(--station-brass-bright)',
            color: running ? 'var(--station-text-dim)' : 'var(--station-bg-deep)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: 9,
            letterSpacing: 1,
            cursor: running ? 'not-allowed' : 'pointer',
          }}
        >
          {running ? '⟳ RUNNING...' : '▶ RUN QUALITY CHECK'}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
        {liveResult && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, color: 'var(--station-signal-amber)', letterSpacing: 1, marginBottom: 8 }}>
              ⟳ RUNNING NOW
            </div>
            <ResultCard result={liveResult} />
          </div>
        )}

        {!liveResult && history.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--station-text-dim)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🧪</div>
            <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, letterSpacing: 2 }}>
              NO QUALITY CHECKS RUN YET
            </div>
            <div style={{ fontSize: 10, marginTop: 4 }}>Click "Run Quality Check" to start the 6-step pipeline.</div>
          </div>
        )}

        {!liveResult && history.length > 0 && (
          <div>
            <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 9, color: 'var(--station-text-dim)', letterSpacing: 1, marginBottom: 8 }}>
              HISTORY
            </div>
            {history.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
