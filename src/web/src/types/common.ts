// @ts-check
import { z } from 'zod'; // v3.22.0

// Global constants
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const DEBOUNCE_DELAY = 300;
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// Base model interface with common fields
export interface BaseModel {
  id: string;
  created_at: Date;
  updated_at: Date;
}

// Zod schema for BaseModel
export const baseModelSchema = z.object({
  id: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date(),
});

// Generic API response interface
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
  metadata: Record<string, unknown>;
}

// Zod schema for ApiResponse
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema,
    error: z.string().nullable(),
    metadata: z.record(z.unknown()),
  });

// Paginated response interface
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// Zod schema for PaginatedResponse
export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    page_size: z.number().int().positive().max(MAX_PAGE_SIZE),
    total_pages: z.number().int().nonnegative(),
    has_next: z.boolean(),
    has_previous: z.boolean(),
  });

// Error response interface
export interface ErrorResponse {
  code: string;
  message: string;
  details: Record<string, unknown>;
  stack?: string;
}

// Zod schema for ErrorResponse
export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()),
  stack: z.string().optional(),
});

// Loading state type
export type LoadingState = 'idle' | 'loading' | 'succeeded' | 'failed';

// Zod schema for LoadingState
export const loadingStateSchema = z.enum(['idle', 'loading', 'succeeded', 'failed']);

// Date range interface with timezone support
export interface DateRange {
  start_date: Date;
  end_date: Date;
  timezone: string;
}

// Zod schema for DateRange
export const dateRangeSchema = z.object({
  start_date: z.date(),
  end_date: z.date(),
  timezone: z.string().default(DEFAULT_TIMEZONE),
}).refine(
  (data) => data.start_date <= data.end_date,
  { message: 'End date must be after start date' }
);

// Sort direction type
export type SortDirection = 'asc' | 'desc';

// Zod schema for SortDirection
export const sortDirectionSchema = z.enum(['asc', 'desc']);

// Sort order interface
export interface SortOrder {
  field: string;
  direction: SortDirection;
}

// Zod schema for SortOrder
export const sortOrderSchema = z.object({
  field: z.string(),
  direction: sortDirectionSchema,
});

/**
 * Type guard to check if an object is an ErrorResponse
 * @param obj - Object to check
 * @returns boolean indicating if object is an ErrorResponse
 */
export function isErrorResponse(obj: unknown): obj is ErrorResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'code' in obj &&
    typeof obj.code === 'string' &&
    'message' in obj &&
    typeof obj.message === 'string' &&
    'details' in obj &&
    typeof obj.details === 'object'
  );
}

/**
 * Creates a Zod schema for runtime validation of common types
 * @template T - Type to create schema for
 * @param schema - Base schema definition
 * @returns Zod schema for type T
 */
export function createZodSchema<T>(schema: z.ZodType<T>): z.Schema<T> {
  return schema.strict();
}

// Type helpers for API responses
export type ApiResponseData<T> = T extends ApiResponse<infer U> ? U : never;
export type PaginatedData<T> = T extends PaginatedResponse<infer U> ? U : never;

// Utility type for making certain fields optional
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Utility type for making certain fields required
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

// Utility type for readonly fields
export type ReadonlyFields<T> = {
  readonly [P in keyof T]: T[P];
};

// Type for API query parameters
export interface QueryParams {
  page?: number;
  page_size?: number;
  sort?: SortOrder;
  search?: string;
  filters?: Record<string, unknown>;
}

// Zod schema for QueryParams
export const queryParamsSchema = z.object({
  page: z.number().int().positive().optional(),
  page_size: z.number().int().positive().max(MAX_PAGE_SIZE).optional(),
  sort: sortOrderSchema.optional(),
  search: z.string().optional(),
  filters: z.record(z.unknown()).optional(),
});