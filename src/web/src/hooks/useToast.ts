// @version react@18.2.0
import { useState, useCallback, useRef, useEffect } from 'react';

// Toast notification types
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

// Constants for toast configuration
const DEFAULT_DURATION = 5000;
const ANIMATION_DURATION = 300;
const MAX_TOASTS = 3;
const TOAST_STACK_SPACING = 8;

// Interface for toast state
interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  duration: number;
  ariaLive: 'polite' | 'assertive';
  id: string;
  isRTL: boolean;
}

// Interface for toast configuration options
interface ShowToastOptions {
  message: string;
  type: ToastType;
  duration?: number;
  ariaLive?: 'polite' | 'assertive';
  forceLocale?: string;
}

// Default toast state
const defaultToastState: ToastState = {
  visible: false,
  message: '',
  type: ToastType.INFO,
  duration: DEFAULT_DURATION,
  ariaLive: 'polite',
  id: '',
  isRTL: false,
};

/**
 * Custom hook for managing accessible toast notifications
 * Supports WCAG 2.1 Level AA compliance and localization
 */
export const useToast = () => {
  // State for managing toast notifications
  const [toastState, setToastState] = useState<ToastState>(defaultToastState);
  const [toastQueue, setToastQueue] = useState<ShowToastOptions[]>([]);

  // Refs for managing timers and animations
  const timerRef = useRef<NodeJS.Timeout>();
  const animationFrameRef = useRef<number>();
  const toastCountRef = useRef<number>(0);

  // Cleanup effect for timers and animation frames
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  /**
   * Handles toast queue processing
   */
  const processToastQueue = useCallback(() => {
    if (toastQueue.length > 0 && !toastState.visible) {
      const nextToast = toastQueue[0];
      setToastQueue((prev) => prev.slice(1));
      showToast(nextToast);
    }
  }, [toastQueue, toastState.visible]);

  /**
   * Effect to process toast queue
   */
  useEffect(() => {
    processToastQueue();
  }, [toastQueue, toastState.visible, processToastQueue]);

  /**
   * Hides the current toast notification
   * @param toastId - Optional ID of the toast to hide
   */
  const hideToast = useCallback((toastId?: string) => {
    if (toastId && toastId !== toastState.id) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setToastState((prev) => ({
      ...prev,
      visible: false,
    }));

    // Reset state after animation
    setTimeout(() => {
      setToastState(defaultToastState);
      toastCountRef.current = Math.max(0, toastCountRef.current - 1);
    }, ANIMATION_DURATION);
  }, [toastState.id]);

  /**
   * Shows a toast notification with the specified options
   * @param options - Configuration options for the toast
   */
  const showToast = useCallback((options: ShowToastOptions) => {
    // Clear existing timers
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Handle toast queue if maximum toasts reached
    if (toastCountRef.current >= MAX_TOASTS) {
      setToastQueue((prev) => [...prev, options]);
      return;
    }

    // Generate unique ID for the toast
    const toastId = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Determine appropriate aria-live value based on toast type
    const ariaLive = options.ariaLive || (
      options.type === ToastType.ERROR ? 'assertive' : 'polite'
    );

    // Check for RTL content
    const isRTL = options.forceLocale ? 
      new Intl.Locale(options.forceLocale).textInfo.direction === 'rtl' : 
      document.dir === 'rtl';

    // Update toast state
    setToastState({
      visible: true,
      message: options.message,
      type: options.type,
      duration: options.duration || DEFAULT_DURATION,
      ariaLive,
      id: toastId,
      isRTL,
    });

    toastCountRef.current += 1;

    // Set up automatic dismissal
    timerRef.current = setTimeout(() => {
      hideToast(toastId);
    }, options.duration || DEFAULT_DURATION);

    // Ensure smooth animation
    animationFrameRef.current = requestAnimationFrame(() => {
      setToastState((prev) => ({
        ...prev,
        visible: true,
      }));
    });
  }, [hideToast]);

  return {
    showToast,
    hideToast,
    toastState,
  };
};

// Export types for external use
export type { ToastState, ShowToastOptions };