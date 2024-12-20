import type { Config } from 'tailwindcss'

// Function to handle color opacity
const withOpacity = (variableName: string) => {
  return ({ opacityValue }: { opacityValue?: number }) => {
    if (opacityValue !== undefined) {
      return `rgba(var(${variableName}), ${opacityValue})`
    }
    return `rgb(var(${variableName}))`
  }
}

const config: Config = {
  // Content paths for Tailwind to scan
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
    './src/app/**/*.{js,ts,jsx,tsx}'
  ],

  // Enable dark mode with class strategy
  darkMode: 'class',

  theme: {
    extend: {
      // Colors mapped to CSS variables from globals.css
      colors: {
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        accent: 'var(--accent)',
        warning: 'var(--warning)',
        error: 'var(--error)',
        success: 'var(--success)',
        background: 'var(--background)',
        text: 'var(--text)',
        border: 'var(--border)',
      },

      // Font family configuration
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', 'sans-serif'],
      },

      // Type scale using 1.2 ratio as per Material Design
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],        // 12px
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],    // 14px
        'base': ['1rem', { lineHeight: '1.5rem' }],       // 16px
        'lg': ['1.2rem', { lineHeight: '1.75rem' }],      // 19.2px
        'xl': ['1.44rem', { lineHeight: '2rem' }],        // 23.04px
        '2xl': ['1.728rem', { lineHeight: '2.25rem' }],   // 27.65px
        '3xl': ['2.074rem', { lineHeight: '2.5rem' }],    // 33.18px
        '4xl': ['2.488rem', { lineHeight: '2.75rem' }],   // 39.81px
      },

      // 8px grid system spacing
      spacing: {
        '1': '0.25rem',      // 4px
        '2': '0.5rem',       // 8px
        '3': '0.75rem',      // 12px
        '4': '1rem',         // 16px
        '5': '1.25rem',      // 20px
        '6': '1.5rem',       // 24px
        '8': '2rem',         // 32px
        '10': '2.5rem',      // 40px
        '12': '3rem',        // 48px
        '16': '4rem',        // 64px
        '20': '5rem',        // 80px
        '24': '6rem',        // 96px
      },

      // Responsive breakpoints as per specifications
      screens: {
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },

      // Border radius following Material Design
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',    // 2px
        'DEFAULT': '0.25rem', // 4px
        'md': '0.375rem',    // 6px
        'lg': '0.5rem',      // 8px
        'xl': '0.75rem',     // 12px
        'full': '9999px',
      },

      // Animations for interactive elements
      animation: {
        'fade-in': 'fadeIn var(--animation-normal) var(--animation-timing)',
        'slide-in': 'slideIn var(--animation-normal) var(--animation-timing)',
        'slide-up': 'slideUp var(--animation-normal) var(--animation-timing)',
      },

      // Keyframes for animations
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },

      // Container configurations
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '2rem',
          lg: '4rem',
          xl: '5rem',
          '2xl': '6rem',
        },
      },
    },
  },

  // Plugins configuration
  plugins: [
    // Forms plugin with class strategy for better control
    require('@tailwindcss/forms')({
      strategy: 'class',
    }),
    // Typography plugin for rich text content
    require('@tailwindcss/typography')({
      className: 'prose',
    }),
    // Aspect ratio plugin for responsive media
    require('@tailwindcss/aspect-ratio'),
  ],
}

export default config