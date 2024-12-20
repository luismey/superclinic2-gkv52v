import type { Config } from '@jest/types';

// Jest configuration for Next.js frontend application
const config: Config.InitialOptions = {
  // Use jsdom environment for DOM testing
  testEnvironment: 'jsdom',

  // Setup file containing test environment configurations
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Patterns to ignore when looking for test files
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
  ],

  // Module name mapping for TypeScript path aliases
  moduleNameMapper: {
    // Component imports
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    // Hook imports
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    // Service imports
    '^@/services/(.*)$': '<rootDir>/src/services/$1',
    // Utility imports
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    // Type imports
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    // Constant imports
    '^@/constants/(.*)$': '<rootDir>/src/constants/$1',
    // Store imports
    '^@/store/(.*)$': '<rootDir>/src/store/$1',
    // Style imports
    '^@/styles/(.*)$': '<rootDir>/src/styles/$1',
    // Library imports
    '^@/lib/(.*)$': '<rootDir>/src/lib/$1',
    // i18n imports
    '^@/i18n/(.*)$': '<rootDir>/src/i18n/$1',
    // Mock imports
    '^@/mocks/(.*)$': '<rootDir>/src/mocks/$1',
    // Context imports
    '^@/contexts/(.*)$': '<rootDir>/src/contexts/$1',
    // Handle style imports
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/index.{ts,tsx}',
    '!src/mocks/**',
    '!src/types/**',
    '!src/**/*.constants.{ts,tsx}',
    '!src/**/*.styles.{ts,tsx}',
  ],

  // Coverage thresholds to enforce
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Transform configuration using SWC for faster compilation
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          transform: {
            react: {
              runtime: 'automatic',
            },
          },
        },
      },
    ],
  },

  // Supported file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Watch plugins for better development experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname',
  ],

  // Test reporters
  reporters: ['default', 'jest-junit'],
};

export default config;