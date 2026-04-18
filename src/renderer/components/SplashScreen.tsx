import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

interface BootLine {
  label: string;
  status: 'wait' | 'ok' | 'fail';
}

const BOOT_SEQUENCE: { label: string; delay: number }[] = [
  { label: 'Checking tracks...', delay: 400 },
  { label: 'Connecting to agents...', delay: 800 },
  { label: 'Loading station data...', delay: 1200 },
  { label: 'Warming up furnace...', delay: 1500 },
];

const DISMISS_DELAY = 2600;
const FADE_DELAY = 2800;

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [lines, setLines] = useState<BootLine[]>([]);
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    BOOT_SEQUENCE.forEach(({ label, delay }, i) => {
      timers.push(
        setTimeout(() => {
          setLines((prev) => [...prev, { label, status: 'wait' }]);
          setTimeout(() => {
            setLines((prev) =>
              prev.map((l, idx) => idx === i ? { ...l, status: 'ok' } : l)
            );
          }, 180);
        }, delay),
      );
    });

    timers.push(
      setTimeout(() => setReady(true), DISMISS_DELAY),
    );

    timers.push(
      setTimeout(() => {
        setVisible(false);
      }, FADE_DELAY),
    );

    return () => timers.forEach(clearTimeout);
  }, []);

  function handleDismiss() {
    if (!dismissed) {
      setDismissed(true);
      setVisible(false);
    }
  }

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          transition={{ duration: 0.3 }}
          className="station-boot-screen"
          onClick={handleDismiss}
          style={{ cursor: ready ? 'pointer' : 'default' }}
        >
          <div className="station-boot-box">
            {/* Header */}
            <div className="station-boot-title">CABOO</div>
            <div className="station-boot-subtitle">STATION OS v2.0 — YOUR AI CODING CREW</div>
            <div className="station-boot-divider" />

            {/* Boot lines */}
            <div style={{ minHeight: 120 }}>
              {lines.map((line, i) => (
                <motion.div
                  key={i}
                  className="station-boot-line"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <span className="station-boot-line-label">{line.label}</span>
                  <span className={`station-boot-line-status ${line.status}`}>
                    {line.status === 'wait' ? '...' : line.status === 'ok' ? '[  OK  ]' : '[FAILED]'}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Ready message */}
            <AnimatePresence>
              {ready && (
                <motion.div
                  className="station-boot-ready"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>🚂</span>
                    <span>All systems operational</span>
                  </div>
                  <div style={{
                    marginTop: 6,
                    fontSize: 10,
                    color: 'var(--station-text-dim)',
                    fontFamily: 'var(--caboo-font-heading)',
                    letterSpacing: 1,
                  }}>
                    PRESS ANY KEY TO ENTER STATION...<span className="caboo-blink-cursor">_</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ASCII train decoration */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 0.3, x: 0 }}
            transition={{ delay: 0.8, duration: 0.6 }}
            style={{
              position: 'absolute',
              bottom: 60,
              left: 0,
              right: 0,
              textAlign: 'center',
              fontFamily: 'var(--caboo-font-body)',
              fontSize: 11,
              color: 'var(--station-border-strong)',
              letterSpacing: 1,
              userSelect: 'none',
            }}
          >
            {'─'.repeat(20)} 🚂 {'─'.repeat(20)}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
