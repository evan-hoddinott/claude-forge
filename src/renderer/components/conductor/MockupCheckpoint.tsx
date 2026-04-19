import { useState } from 'react';
import { motion } from 'framer-motion';
import type { ConductorPlan } from '../../../shared/types';
import MockupRenderer from './MockupRenderer';

interface MockupCheckpointProps {
  plan: ConductorPlan;
  onSelectVariant: (stationId: string, variantId: string) => Promise<void>;
  onContinue: () => void;
  onSkip: () => void;
  loading?: boolean;
}

export default function MockupCheckpoint({ plan, onSelectVariant, onContinue, onSkip, loading }: MockupCheckpointProps) {
  const designStations = plan.stations.filter((s) => s.isDesignStation && s.mockupSpec);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (designStations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div style={{ textAlign: 'center', color: 'var(--station-text-dim)', fontFamily: 'var(--caboo-font-body)', fontSize: 11 }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎨</div>
          <div>No visual design decisions found.</div>
          <button
            onClick={onSkip}
            style={{
              marginTop: 16,
              padding: '6px 16px',
              background: 'var(--station-brass)',
              border: 'none',
              color: 'var(--station-bg-deep)',
              fontFamily: 'var(--caboo-font-heading)',
              fontSize: 10,
              cursor: 'pointer',
              letterSpacing: 1,
            }}
          >
            CONTINUE WITHOUT MOCKUPS
          </button>
        </div>
      </div>
    );
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      for (const station of designStations) {
        const variantId = selections[station.id] ?? station.mockupSpec!.variants[0]?.id;
        if (variantId) {
          await onSelectVariant(station.id, variantId);
        }
      }
      onContinue();
    } finally {
      setSubmitting(false);
    }
  }

  const allSelected = designStations.every((s) => selections[s.id] || s.mockupSpec!.variants.length > 0);

  return (
    <div className="h-full flex flex-col" style={{ fontFamily: 'var(--caboo-font-body)' }}>
      {/* Header */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid var(--station-border)',
        background: 'var(--station-bg-mid)',
        flexShrink: 0,
      }}>
        <div style={{ fontFamily: 'var(--caboo-font-heading)', fontSize: 11, color: 'var(--station-brass)', letterSpacing: 1 }}>
          🎨 DESIGN PREVIEW — SELECT YOUR PREFERRED STYLE
        </div>
        <div style={{ fontSize: 10, color: 'var(--station-text-dim)', marginTop: 2 }}>
          Click a variant to select it before the Conductor starts building.
        </div>
      </div>

      {/* Stations with design decisions */}
      <div className="flex-1 overflow-y-auto" style={{ padding: '16px 20px' }}>
        {designStations.map((station) => {
          const spec = station.mockupSpec!;
          return (
            <div key={station.id} style={{ marginBottom: 24 }}>
              <div style={{
                fontFamily: 'var(--caboo-font-heading)',
                fontSize: 10,
                color: 'var(--station-text-secondary)',
                letterSpacing: 1,
                marginBottom: 8,
                textTransform: 'uppercase',
              }}>
                {station.name} — {spec.designDecision}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${Math.min(spec.variants.length, 3)}, 1fr)`,
                gap: 10,
              }}>
                {spec.variants.map((variant, i) => (
                  <motion.div
                    key={variant.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <MockupRenderer
                      variant={variant}
                      selected={(selections[station.id] ?? spec.variants[0]?.id) === variant.id}
                      onSelect={() => setSelections((prev) => ({ ...prev, [station.id]: variant.id }))}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer actions */}
      <div style={{
        padding: '12px 20px',
        borderTop: '1px solid var(--station-border)',
        background: 'var(--station-bg-mid)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <button
          onClick={onSkip}
          disabled={submitting || loading}
          style={{
            padding: '6px 14px',
            background: 'none',
            border: '1px solid var(--station-border)',
            color: 'var(--station-text-dim)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: 9,
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >
          SKIP — USE DEFAULTS
        </button>
        <button
          onClick={handleConfirm}
          disabled={!allSelected || submitting || loading}
          style={{
            padding: '8px 20px',
            background: 'var(--station-brass)',
            border: '2px outset var(--station-brass-bright)',
            color: 'var(--station-bg-deep)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: 10,
            cursor: allSelected && !submitting ? 'pointer' : 'not-allowed',
            letterSpacing: 1,
            opacity: allSelected && !submitting ? 1 : 0.6,
          }}
        >
          {submitting ? '⏳ APPLYING...' : '🚂 BUILD WITH SELECTED DESIGNS'}
        </button>
      </div>
    </div>
  );
}
