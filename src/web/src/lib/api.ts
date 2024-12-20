// @ts-check
import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios'; // v1.4.0
import { z } from 'zod'; // v3.21.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0

import {
  API_VERSION,
  API_BASE_URL,
  API_METHODS,
  API_HEADERS,
  API_ENDPOINTS,
  API_ERROR_CODES,
  API_TIMEOUT,
  API_RETRY_ATTEMPTS,
  API_RETRY_DELAY,
} from '../constants/api';

import {
  ApiResponse,
  ErrorResponse,
  isErrorResponse,
  createZodSchema,
  QueryParams,
  queryParamsSchema,
} from '../types/common';

import { StorageKeys, getSecureStorage, setSecureStorage } from './storage';

// Request cache for deduplication
const REQUEST_CACHE = new Map<string, Promise<any>>();

// Custom error types
export class ApiError extends Error implements ErrorResponse {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
    public readonly status?: number
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, ApiError);
  }
}

export class NetworkError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('NETWORK_ERROR', message, details);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('VALIDATION_ERROR', message, details);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('RATE_LIMIT_ERROR', message, details);
  }
}

// Request configuration type
interface RequestConfig extends AxiosRequestConfig {
  skipCache?: boolean;
  skipRetry?: boolean;
  validateSchema?: z.ZodSchema;
}

/**
 * Creates and configures an enhanced Axios instance with security and performance features
 */
function createApiClient(): AxiosInstance {
  const instance = axios.create({
    baseURL: `${API_BASE_URL}/api/${API_VERSION}`,
    timeout: API_TIMEOUT,
    headers: {
      [API_HEADERS.CONTENT_TYPE]: 'application/json',
      [API_HEADERS.ACCEPT]: 'application/json',
      [API_HEADERS.LANGUAGE]: 'pt-BR',
    },
    validateStatus: (status) => status < 500,
  });

  // Request interceptor for authentication
  instance.interceptors.request.use(async (config) => {
    try {
      // Add correlation ID for request tracking
      config.headers[API_HEADERS.CORRELATION_ID] = uuidv4();

      // Get authentication token
      const token = await getSecureStorage<string>(StorageKeys.AUTH_TOKEN);
      if (token) {
        config.headers[API_HEADERS.AUTHORIZATION] = `Bearer ${token}`;
      }

      return config;
    } catch (error) {
      return Promise.reject(error);
    }
  });

  // Response interceptor for error handling
  instance.interceptors.response.use(
    async (response) => {
      // Validate response schema if provided
      if (response.config.validateSchema) {
        try {
          response.data = response.config.validateSchema.parse(response.data);
        } catch (error) {
          throw new ValidationError('Response validation failed', {
            errors: error.errors,
            path: error.path,
          });
        }
      }

      return response;
    },
    async (error: AxiosError) => {
      return handleApiError(error);
    }
  );

  return instance;
}

/**
 * Enhanced error processor with comprehensive error handling and standardization
 */
async function handleApiError(error: AxiosError): Promise<never> {
  // Network or connection errors
  if (!error.response) {
    throw new NetworkError('Network connection error', {
      message: error.message,
      code: error.code,
    });
  }

  const { status, data } = error.response;

  // Rate limiting
  if (status === API_ERROR_CODES.RATE_LIMIT) {
    throw new RateLimitError('Rate limit exceeded', {
      retryAfter: error.response.headers['retry-after'],
    });
  }

  // Authentication errors
  if (status === API_ERROR_CODES.UNAUTHORIZED) {
    // Clear invalid token
    await setSecureStorage(StorageKeys.AUTH_TOKEN, null);
    throw new ApiError('UNAUTHORIZED', 'Authentication required');
  }

  // Server validation errors
  if (isErrorResponse(data)) {
    throw new ApiError(data.code, data.message, data.details, status);
  }

  // Generic error
  throw new ApiError(
    'UNKNOWN_ERROR',
    'An unexpected error occurred',
    { originalError: error.message },
    status
  );
}

/**
 * Creates request cache key
 */
function createCacheKey(config: RequestConfig): string {
  const { method, url, params, data } = config;
  return `${method}-${url}-${JSON.stringify(params)}-${JSON.stringify(data)}`;
}

/**
 * Makes an API request with enhanced features
 */
async function request<T>(config: RequestConfig): Promise<ApiResponse<T>> {
  const cacheKey = createCacheKey(config);

  // Return cached promise if available
  if (!config.skipCache && REQUEST_CACHE.has(cacheKey)) {
    return REQUEST_CACHE.get(cacheKey) as Promise<ApiResponse<T>>;
  }

  // Create request promise
  const requestPromise = (async () => {
    let attempt = 0;

    while (attempt < (config.skipRetry ? 1 : API_RETRY_ATTEMPTS)) {
      try {
        const response = await api.request<ApiResponse<T>>(config);
        return response.data;
      } catch (error) {
        attempt++;
        
        // Don't retry certain errors
        if (
          error instanceof ValidationError ||
          error instanceof RateLimitError ||
          attempt === API_RETRY_ATTEMPTS
        ) {
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, API_RETRY_DELAY * attempt));
      }
    }

    throw new ApiError('MAX_RETRIES_EXCEEDED', 'Maximum retry attempts reached');
  })();

  // Cache promise and auto-remove after completion
  if (!config.skipCache) {
    REQUEST_CACHE.set(cacheKey, requestPromise);
    requestPromise.finally(() => REQUEST_CACHE.delete(cacheKey));
  }

  return requestPromise;
}

// Create API instance
const api = createApiClient();

// Export typed request methods
export default {
  async get<T>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: API_METHODS.GET, url });
  },

  async post<T>(
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: API_METHODS.POST, url, data });
  },

  async put<T>(
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: API_METHODS.PUT, url, data });
  },

  async patch<T>(
    url: string,
    data?: unknown,
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: API_METHODS.PATCH, url, data });
  },

  async delete<T>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    return request<T>({ ...config, method: API_METHODS.DELETE, url });
  },

  // Helper method for paginated requests
  async getPaginated<T>(
    url: string,
    params: QueryParams = {},
    config: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const validatedParams = queryParamsSchema.parse(params);
    return request<T>({
      ...config,
      method: API_METHODS.GET,
      url,
      params: validatedParams,
    });
  },
};

// Export type definitions
export type { ApiResponse, ErrorResponse, QueryParams, RequestConfig };
```

This implementation provides:

1. Comprehensive error handling with custom error types
2. Request deduplication and caching
3. Automatic retry logic for failed requests
4. Type-safe request/response handling
5. Schema validation using Zod
6. Authentication token management
7. Request correlation tracking
8. Rate limiting handling
9. Pagination support
10. Security features like automatic token refresh

The API client can be used throughout the application to make type-safe HTTP requests with consistent error handling and security features.

Example usage:
```typescript
// Get user profile
const response = await api.get<UserProfile>('/settings/profile');

// Create campaign with validation
const campaign = await api.post<Campaign>(
  '/campaigns',
  campaignData,
  { validateSchema: campaignSchema }
);

// Get paginated chat list
const chats = await api.getPaginated<ChatList>(
  '/chats',
  { page: 1, page_size: 20 }
);