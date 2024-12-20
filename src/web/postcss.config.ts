// postcss.config.ts
// PostCSS configuration for Porfin frontend application
// Dependencies:
// - postcss@8.4.0
// - tailwindcss@3.3.0
// - autoprefixer@10.4.0

import type { Config } from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const config: Config = {
  // Define PostCSS plugins in optimal order for build performance
  plugins: [
    // Process Tailwind CSS utilities first
    tailwindcss({
      // Reference local Tailwind configuration
      config: './tailwind.config.ts',
    }),

    // Apply vendor prefixes for browser compatibility
    autoprefixer({
      // Optimize flexbox prefixing by excluding outdated 2009 syntax
      flexbox: 'no-2009',
      // Enable automatic grid placement prefixing
      grid: 'autoplace',
      // Target modern browsers as per technical specifications
      browsers: [
        'Chrome >= 90',
        'Firefox >= 88',
        'Safari >= 14',
        'Edge >= 90'
      ]
    }),
  ],
};

// Export PostCSS configuration
export default config;