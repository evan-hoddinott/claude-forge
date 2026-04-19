import { useRef, useEffect } from 'react';
import type { MockupVariant } from '../../../shared/types';

interface MockupRendererProps {
  variant: MockupVariant;
  selected?: boolean;
  onSelect?: () => void;
  compact?: boolean;
}

export default function MockupRenderer({ variant, selected, onSelect, compact }: MockupRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(variant.htmlSpec);
    doc.close();
  }, [variant.htmlSpec]);

  const previewHeight = compact ? 120 : 200;

  return (
    <div
      onClick={onSelect}
      style={{
        border: `2px solid ${selected ? 'var(--station-brass)' : 'var(--station-border)'}`,
        background: selected ? 'rgba(196,162,101,0.05)' : 'var(--station-bg-deep)',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'border-color 0.15s, background 0.15s',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* iframe preview */}
      <div style={{ height: previewHeight, position: 'relative', overflow: 'hidden', background: '#fff' }}>
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin"
          style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
          title={variant.label}
        />
        {selected && (
          <div style={{
            position: 'absolute',
            top: 6,
            right: 6,
            background: 'var(--station-brass)',
            color: 'var(--station-bg-deep)',
            fontFamily: 'var(--caboo-font-heading)',
            fontSize: 9,
            letterSpacing: 1,
            padding: '2px 6px',
          }}>
            SELECTED
          </div>
        )}
      </div>

      {/* Label */}
      <div style={{ padding: '8px 10px', borderTop: '1px solid var(--station-border)' }}>
        <div style={{
          fontFamily: 'var(--caboo-font-heading)',
          fontSize: 10,
          color: selected ? 'var(--station-brass)' : 'var(--station-text-primary)',
          letterSpacing: 0.5,
          marginBottom: 2,
        }}>
          {variant.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--station-text-dim)' }}>
          {variant.description}
        </div>
      </div>
    </div>
  );
}
