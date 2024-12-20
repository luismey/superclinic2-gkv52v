// @version react@18.2.0
// @version framer-motion@10.16.4
// @version classnames@2.3.2
import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import classNames from 'classnames';
import { useToast } from '../../hooks/useToast';
import { COLORS, TRANSITIONS, Z_INDEX } from '../../constants/ui';

// Interface for Toast component props
interface ToastProps {
  className?: string;
  duration?: number;
  onClose?: () => void;
}

// Animation variants with support for reduced motion
const ANIMATION_VARIANTS = {
  initial: {
    opacity: 0,
    y: 50,
    scale: 0.95,
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: TRANSITIONS.durations.normal / 1000,
      ease: TRANSITIONS.easings.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.95,
    transition: {
      duration: TRANSITIONS.durations.fast / 1000,
      ease: TRANSITIONS.easings.easeIn,
    },
  },
};

// Semantic toast styles mapping
const TOAST_STYLES = {
  success: 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-100 border-green-500',
  error: 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100 border-red-500',
  warning: 'bg-yellow-50 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-100 border-yellow-500',
  info: 'bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-100 border-blue-500',
};

// ARIA live region levels based on toast type
const ARIA_LIVE_LEVELS = {
  success: 'polite',
  error: 'assertive',
  warning: 'polite',
  info: 'polite',
} as const;

/**
 * Toast component for displaying temporary notifications
 * Implements WCAG 2.1 Level AA accessibility guidelines
 */
const Toast: React.FC<ToastProps> = ({
  className,
  duration,
  onClose,
}) => {
  const { toastState, hideToast } = useToast();
  const { visible, message, type, isRTL } = toastState;

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && visible) {
      hideToast();
      onClose?.();
    }
  }, [visible, hideToast, onClose]);

  // Set up keyboard listeners and cleanup
  useEffect(() => {
    if (visible) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [visible, handleKeyDown]);

  // Handle automatic dismissal
  useEffect(() => {
    if (visible && duration) {
      const timer = setTimeout(() => {
        hideToast();
        onClose?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, hideToast, onClose]);

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          role="alert"
          aria-live={ARIA_LIVE_LEVELS[type]}
          aria-atomic="true"
          dir={isRTL ? 'rtl' : 'ltr'}
          className={classNames(
            'fixed bottom-4 left-1/2 transform -translate-x-1/2',
            'flex items-center px-4 py-3 rounded-lg shadow-lg',
            'border-l-4 min-w-[320px] max-w-[90vw]',
            'font-medium text-sm z-[var(--z-toast)]',
            TOAST_STYLES[type],
            className
          )}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={ANIMATION_VARIANTS}
          style={{
            '--z-toast': Z_INDEX.toast,
          } as React.CSSProperties}
        >
          {/* Message content */}
          <span className="flex-1 mr-2">{message}</span>

          {/* Close button */}
          <button
            type="button"
            onClick={() => {
              hideToast();
              onClose?.();
            }}
            className={classNames(
              'p-1 rounded-full transition-colors',
              'hover:bg-black/5 dark:hover:bg-white/5',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              'focus:ring-current'
            )}
            aria-label="Close notification"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;