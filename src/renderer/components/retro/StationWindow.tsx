import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StationWindowProps {
  title: string;
  icon?: string;
  closable?: boolean;
  collapsible?: boolean;
  active?: boolean;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
  onClose?: () => void;
  style?: React.CSSProperties;
}

export default function StationWindow({
  title,
  icon,
  closable = false,
  collapsible = false,
  active = true,
  className = '',
  contentClassName = '',
  children,
  onClose,
  style,
}: StationWindowProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`station-window ${active ? 'active' : ''} ${className}`}
      style={style}
    >
      <div className="station-window-titlebar titlebar-no-drag">
        <span className="station-window-title">
          {icon && <span style={{ marginRight: 6, fontSize: 11 }}>{icon}</span>}
          {title}
        </span>
        <div className="station-window-controls">
          {collapsible && (
            <button
              className="station-window-btn"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? '+' : '─'}
            </button>
          )}
          {closable && onClose && (
            <button
              className="station-window-btn close"
              onClick={onClose}
              title="Close"
            >
              ×
            </button>
          )}
        </div>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            className={`station-window-content ${contentClassName}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
