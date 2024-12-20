/**
 * API Constants Configuration
 * @description Centralized configuration for all API-related constants including endpoints, 
 * methods, headers, and error codes for the Porfin platform
 * @version 1.0.0
 */

import { ApiResponse } from '../types/common';

// API Version Configuration
export const API_VERSION = 'v1';

// Base URLs with environment fallbacks
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000';

// API Request Configuration
export const API_TIMEOUT = 30000; // 30 seconds
export const API_RETRY_ATTEMPTS = 3;
export const API_RETRY_DELAY = 1000; // 1 second

// HTTP Methods
export const API_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

// HTTP Headers
export const API_HEADERS = {
  CONTENT_TYPE: 'application/json',
  ACCEPT: 'application/json',
  AUTHORIZATION: 'Authorization',
  LANGUAGE: 'pt-BR',
  API_KEY: 'X-API-Key',
  CORRELATION_ID: 'X-Correlation-ID',
} as const;

// HTTP Error Codes
export const API_ERROR_CODES = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMIT: 429,
  SERVER_ERROR: 500,
} as const;

/**
 * API Endpoints Configuration
 * Comprehensive mapping of all platform service endpoints
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REFRESH: '/auth/refresh',
    REGISTER: '/auth/register',
    VERIFY: '/auth/verify',
    RESET_PASSWORD: '/auth/reset-password',
    MFA: '/auth/mfa',
  },

  ANALYTICS: {
    DASHBOARD: '/analytics/dashboard',
    REPORTS: '/analytics/reports',
    METRICS: '/analytics/metrics',
    EXPORT: '/analytics/export',
    INSIGHTS: '/analytics/insights',
  },

  CHATS: {
    LIST: '/chats',
    MESSAGES: '/chats/:id/messages',
    SEND: '/chats/:id/send',
    ATTACHMENTS: '/chats/:id/attachments',
    TEMPLATES: '/chats/templates',
    ARCHIVE: '/chats/:id/archive',
    SEARCH: '/chats/search',
  },

  CAMPAIGNS: {
    LIST: '/campaigns',
    CREATE: '/campaigns',
    UPDATE: '/campaigns/:id',
    DELETE: '/campaigns/:id',
    SCHEDULE: '/campaigns/:id/schedule',
    STATS: '/campaigns/:id/stats',
    TEMPLATES: '/campaigns/templates',
  },

  APPOINTMENTS: {
    LIST: '/appointments',
    SCHEDULE: '/appointments/schedule',
    CANCEL: '/appointments/:id/cancel',
    RESCHEDULE: '/appointments/:id/reschedule',
    AVAILABILITY: '/appointments/availability',
    SYNC: '/appointments/sync',
  },

  SETTINGS: {
    PROFILE: '/settings/profile',
    PREFERENCES: '/settings/preferences',
    INTEGRATIONS: '/settings/integrations',
    NOTIFICATIONS: '/settings/notifications',
    SECURITY: '/settings/security',
    BILLING: '/settings/billing',
    TEAM: '/settings/team',
  },
} as const;

/**
 * Helper function to build full API URL
 * @param endpoint - API endpoint path
 * @param params - URL parameters to replace in path
 * @returns Full API URL with replaced parameters
 */
export const buildApiUrl = (endpoint: string, params?: Record<string, string>): string => {
  let url = `${API_BASE_URL}/api/${API_VERSION}${endpoint}`;
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url = url.replace(`:${key}`, value);
    });
  }
  
  return url;
};

/**
 * Helper function to build WebSocket URL
 * @param path - WebSocket endpoint path
 * @returns Full WebSocket URL
 */
export const buildWsUrl = (path: string): string => {
  return `${WS_BASE_URL}/ws/${API_VERSION}${path}`;
};

// Type definitions for API response handling
export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];
export type ApiMethod = typeof API_METHODS[keyof typeof API_METHODS];
export type ApiHeader = typeof API_HEADERS[keyof typeof API_HEADERS];

// Type guard for API response
export const isApiResponse = <T>(response: unknown): response is ApiResponse<T> => {
  return (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    'data' in response
  );
};

// Export all constants as readonly to prevent modifications
export default {
  API_VERSION,
  API_BASE_URL,
  WS_BASE_URL,
  API_TIMEOUT,
  API_RETRY_ATTEMPTS,
  API_RETRY_DELAY,
  API_METHODS,
  API_HEADERS,
  API_ERROR_CODES,
  API_ENDPOINTS,
} as const;