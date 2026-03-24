import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../contexts/ThemeContext';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const { theme } = useTheme();
  const isForge = theme === 'forge';

  useEffect(() => {
    if (!isForge) {
      // Clean theme: skip splash entirely
      onComplete();
      return;
    }
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1800);
    return () => clearTimeout(timer);
  }, [isForge, onComplete]);

  if (!isForge) return null;

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center"
          style={{
            backgroundColor: 'var(--forge-bg-deep, #1a1e14)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect x='0' y='0' width='1' height='1' fill='%23ffffff' opacity='.025'/%3E%3Crect x='4' y='2' width='1' height='1' fill='%23ffffff' opacity='.03'/%3E%3Crect x='2' y='5' width='1' height='1' fill='%23ffffff' opacity='.02'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'repeat',
          }}
        >
          <div className="flex flex-col items-center gap-4">
            {/* ASCII art box */}
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: 'var(--forge-text-heading, #e8dfc0)' }}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
                style={{ fontSize: 14, letterSpacing: 1 }}
              >
                {'\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557'}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                style={{ fontSize: 14, letterSpacing: 1 }}
              >
                {'\u2551'}{'     \u2692  CLAUDE FORGE  \u2692      '}{'\u2551'}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                style={{ fontSize: 14, letterSpacing: 1 }}
              >
                {'\u2551'}{'   your AI coding workshop    '}{'\u2551'}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.3 }}
                style={{ fontSize: 14, letterSpacing: 1 }}
              >
                {'\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D'}
              </motion.div>
            </div>

            {/* Pixel fire */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="forge-fire"
              style={{ width: 32, height: 32 }}
            >
              <div className="forge-fire-log forge-fire-log-1" />
              <div className="forge-fire-log forge-fire-log-2" />
              <div className="forge-fire-flame forge-fire-flame-1" />
              <div className="forge-fire-flame forge-fire-flame-2" />
              <div className="forge-fire-flame forge-fire-flame-3" />
              <div className="forge-fire-flame forge-fire-flame-4" />
            </motion.div>

            {/* Boot text with blinking cursor */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9, duration: 0.3 }}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 12,
                color: 'var(--forge-text-secondary, #9c9478)',
              }}
            >
              booting up...<span className="forge-blink-cursor">_</span>
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
