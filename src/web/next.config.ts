// @ts-check
import type { NextConfig } from 'next'; // v13.0.0
import withPWA from 'next-pwa'; // v5.6.0

/**
 * Enhanced Next.js configuration for Porfin healthcare platform
 * Includes security hardening, performance optimizations, and healthcare-specific settings
 */
const securityHeaders = () => [
  {
    // Strict Content Security Policy for healthcare data protection
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' https://apis.google.com https://*.firebase.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https://storage.googleapis.com data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.googleapis.com https://*.firebase.com wss://*.firebaseio.com",
      "frame-src 'self' https://*.firebaseapp.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
];

/**
 * PWA configuration for offline capabilities and enhanced mobile experience
 */
const pwaConfig = {
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      urlPattern: '/*',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'porfin-cache',
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 86400, // 24 hours
        },
      },
    },
  ],
};

/**
 * Base Next.js configuration
 */
const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_FIREBASE_CONFIG: process.env.NEXT_PUBLIC_FIREBASE_CONFIG,
    NEXT_PUBLIC_WHATSAPP_ENABLED: process.env.NEXT_PUBLIC_WHATSAPP_ENABLED,
    NEXT_PUBLIC_ENVIRONMENT: process.env.NEXT_PUBLIC_ENVIRONMENT,
  },

  // Internationalization settings for Brazilian Portuguese
  i18n: {
    defaultLocale: 'pt-BR',
    locales: ['pt-BR'],
    localeDetection: true,
  },

  // Image optimization configuration
  images: {
    domains: ['storage.googleapis.com'],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ];
  },

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Enable module resolution
    config.resolve.extensions.push('.ts', '.tsx');

    // Production optimizations
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 244000,
          minChunks: 1,
          maxAsyncRequests: 30,
          maxInitialRequests: 30,
          cacheGroups: {
            defaultVendors: {
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    // Source map configuration
    if (!dev) {
      config.devtool = 'hidden-source-map';
    }

    return config;
  },

  // Experimental features
  experimental: {
    appDir: true,
    serverActions: true,
    optimizeCss: true,
    scrollRestoration: true,
    legacyBrowsers: false,
  },

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
    reactRemoveProperties: process.env.NODE_ENV === 'production',
  },
};

// Export configuration with PWA enhancement
export default withPWA(pwaConfig)(config);