import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence onExitComplete={onComplete}>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center"
          style={{ backgroundColor: '#0a0a1a' }}
        >
          {/* CRT scanlines on splash too */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
            }}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex flex-col items-center gap-6 relative"
          >
            {/* Forge icon with glow */}
            <div
              className="w-16 h-16 flex items-center justify-center"
              style={{
                filter: 'drop-shadow(0 0 20px rgba(0, 255, 255, 0.5)) drop-shadow(0 0 40px rgba(255, 0, 255, 0.2))',
              }}
            >
              <svg className="w-12 h-12" viewBox="0 0 16 16" fill="#00ffff">
                <path d="M3 10h10v1.5c0 .83-.67 1.5-1.5 1.5h-7A1.5 1.5 0 013 11.5V10z" />
                <path d="M2 8.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5V10H2V8.5z" />
                <path
                  d="M4.5 5h7a1.5 1.5 0 011.5 1.5V8H3V6.5A1.5 1.5 0 014.5 5z"
                  opacity="0.6"
                />
                <rect x="6" y="13" width="4" height="1.5" rx="0.5" />
              </svg>
            </div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '1rem',
                color: '#e0e0ff',
                textShadow: '0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(255, 0, 255, 0.2)',
                letterSpacing: '0.05em',
              }}
            >
              CLAUDE FORGE
            </motion.h1>

            {/* Boot text */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.6, 1, 0.6] }}
              transition={{ delay: 0.5, duration: 2, repeat: Infinity }}
              style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '0.7rem',
                color: '#6060a0',
              }}
            >
              booting up...
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
