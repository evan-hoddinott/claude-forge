type DividerVariant = 'single' | 'double' | 'vine' | 'caboo' | 'leaf';

const DIVIDERS: Record<DividerVariant, string> = {
  single: '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550',
  double: '\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557',
  vine: '~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~*~',
  caboo: '\u25C6\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u25C6',
  leaf: '\uD83C\uDF3F\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\uD83C\uDF3F',
};

interface AsciiDividerProps {
  variant?: DividerVariant;
  label?: string;
  className?: string;
}

export default function AsciiDivider({ variant = 'caboo', label, className = '' }: AsciiDividerProps) {
  if (label) {
    const pad = '\u2550'.repeat(Math.max(2, Math.floor((28 - label.length) / 2)));
    return (
      <div className={`caboo-ascii-divider ${className}`}>
        {'\u25C6'}{pad} {label} {pad}{'\u25C6'}
      </div>
    );
  }

  return (
    <div className={`caboo-ascii-divider ${className}`}>
      {DIVIDERS[variant]}
    </div>
  );
}
