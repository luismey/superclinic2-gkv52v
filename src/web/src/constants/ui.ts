// @ts-check
import type { LoadingState } from '../types/common';

/**
 * Color system following Material Design 3.0 principles
 * Supports both light and dark modes with semantic color mappings
 */
export const COLORS = {
  light: {
    primary: '#0066CC',
    secondary: '#4A90E2',
    accent: '#00CC99',
    background: '#FFFFFF',
    surface: '#F8F9FA',
    text: {
      primary: '#2C3E50',
      secondary: '#64748B',
    },
    border: '#E5E7EB',
    divider: '#E2E8F0',
    hover: 'rgba(74, 144, 226, 0.04)',
    focus: 'rgba(74, 144, 226, 0.12)',
    disabled: 'rgba(44, 62, 80, 0.38)',
  },
  dark: {
    primary: '#4A90E2',
    secondary: '#7EB6FF',
    accent: '#00E6AC',
    background: '#1A1A1A',
    surface: '#2D2D2D',
    text: {
      primary: '#E5E7EB',
      secondary: '#9CA3AF',
    },
    border: '#404040',
    divider: '#404040',
    hover: 'rgba(126, 182, 255, 0.08)',
    focus: 'rgba(126, 182, 255, 0.16)',
    disabled: 'rgba(229, 231, 235, 0.38)',
  },
  semantic: {
    success: '#00CC66',
    warning: '#FFB020',
    error: '#FF4D4D',
    info: '#3B82F6',
  },
} as const;

/**
 * 8px grid system for consistent spacing
 * Includes minimum touch target sizes for accessibility
 */
export const SPACING = {
  grid: {
    base: 8,
    xs: 4,    // 0.5x base
    sm: 8,    // 1x base
    md: 16,   // 2x base
    lg: 24,   // 3x base
    xl: 32,   // 4x base
    xxl: 48,  // 6x base
  },
  touch: {
    minimum: 44,      // WCAG 2.1 minimum touch target
    comfortable: 48,  // Material Design comfortable target
    large: 64,       // Large touch targets
  },
  container: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
  },
} as const;

/**
 * Typography scale with 1.2 ratio following Material Design
 * Includes line heights for optimal readability
 */
export const TYPE_SCALE = {
  ratio: 1.2,
  sizes: {
    xs: '0.833rem',   // 13.33px
    sm: '1rem',       // 16px
    md: '1.2rem',     // 19.2px
    lg: '1.44rem',    // 23.04px
    xl: '1.728rem',   // 27.65px
    xxl: '2.074rem',  // 33.18px
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.2,     // Headings
    normal: 1.5,    // Body text
    relaxed: 1.75,  // Large text blocks
  },
  fonts: {
    primary: 'Inter, system-ui, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
} as const;

/**
 * Focus styles for accessibility compliance
 * Supports high contrast mode
 */
export const FOCUS_STYLES = {
  default: 'outline: 2px solid var(--color-primary); outline-offset: 2px;',
  inset: 'outline: 2px solid var(--color-primary); outline-offset: -2px;',
  highContrast: 'outline: 3px solid var(--color-accent); outline-offset: 3px;',
} as const;

/**
 * Z-index scale for consistent layering
 */
export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modal: 400,
  popover: 500,
  toast: 600,
  tooltip: 700,
} as const;

/**
 * Animation and transition configurations
 * Supports reduced motion preferences
 */
export const TRANSITIONS = {
  durations: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  easings: {
    default: 'ease-in-out',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
  },
  presets: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  },
  preferences: {
    reducedMotion: 'transform 0ms, opacity 0ms',
  },
} as const;

/**
 * Media query breakpoints for responsive design
 */
export const BREAKPOINTS = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

/**
 * Border radius values following Material Design
 */
export const BORDER_RADIUS = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

/**
 * Shadow elevations following Material Design
 */
export const SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
} as const;

/**
 * Loading state styles mapping
 */
export const LOADING_STATE_STYLES: Record<LoadingState, string> = {
  idle: COLORS.semantic.info,
  loading: COLORS.semantic.info,
  succeeded: COLORS.semantic.success,
  failed: COLORS.semantic.error,
} as const;

/**
 * CSS custom properties for theme variables
 */
export const CSS_VARIABLES = {
  light: {
    '--color-primary': COLORS.light.primary,
    '--color-secondary': COLORS.light.secondary,
    '--color-accent': COLORS.light.accent,
    '--color-background': COLORS.light.background,
    '--color-surface': COLORS.light.surface,
    '--color-text-primary': COLORS.light.text.primary,
    '--color-text-secondary': COLORS.light.text.secondary,
    '--color-border': COLORS.light.border,
  },
  dark: {
    '--color-primary': COLORS.dark.primary,
    '--color-secondary': COLORS.dark.secondary,
    '--color-accent': COLORS.dark.accent,
    '--color-background': COLORS.dark.background,
    '--color-surface': COLORS.dark.surface,
    '--color-text-primary': COLORS.dark.text.primary,
    '--color-text-secondary': COLORS.dark.text.secondary,
    '--color-border': COLORS.dark.border,
  },
} as const;