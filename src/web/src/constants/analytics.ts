/**
 * Analytics Constants
 * Version: 1.0.0
 * 
 * Defines constant values and configurations for analytics features including 
 * metric types, date ranges, chart configurations, and threshold values with TypeScript type safety.
 * Supports business analytics requirements including lead conversion tracking and system performance metrics.
 */

/**
 * Enum defining all available metric types for analytics tracking
 */
export enum METRIC_TYPES {
  CONVERSION_RATE = 'conversion_rate',
  RESPONSE_TIME = 'response_time',
  ACTIVE_CHATS = 'active_chats',
  AI_USAGE = 'ai_usage',
  CAMPAIGN_PERFORMANCE = 'campaign_performance',
  LEAD_QUALITY = 'lead_quality',
  APPOINTMENT_RATE = 'appointment_rate'
}

/**
 * Enum defining available date range options for analytics filtering
 */
export enum DATE_RANGES {
  TODAY = 'today',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom',
  YEAR_TO_DATE = 'year_to_date'
}

/**
 * Enum defining supported chart types for data visualization
 */
export enum CHART_TYPES {
  LINE = 'line',
  BAR = 'bar',
  PIE = 'pie',
  AREA = 'area',
  SCATTER = 'scatter',
  FUNNEL = 'funnel'
}

/**
 * Performance threshold values for different metrics
 * Includes target values based on business requirements
 */
export const METRIC_THRESHOLDS = {
  CONVERSION_RATE_TARGET: 30, // 30% target increase in lead conversion
  RESPONSE_TIME_MAX: 500, // 500ms maximum response time
  AI_USAGE_TARGET: 80, // 80% target for AI automation
  LEAD_QUALITY_THRESHOLD: 7.5, // Minimum lead quality score out of 10
  CAMPAIGN_SUCCESS_RATE: 25 // 25% minimum campaign success rate
} as const;

/**
 * Data refresh intervals in milliseconds for different update frequencies
 */
export const REFRESH_INTERVALS = {
  REAL_TIME: 5000, // 5 seconds for real-time updates
  STANDARD: 60000, // 1 minute for standard updates
  BACKGROUND: 300000, // 5 minutes for background updates
  BATCH_PROCESSING: 3600000 // 1 hour for batch processing
} as const;

/**
 * Global default values
 */
export const DEFAULT_DATE_RANGE = DATE_RANGES.LAST_30_DAYS;
export const DEFAULT_CHART_TYPE = CHART_TYPES.LINE;
export const DEFAULT_REFRESH_INTERVAL = REFRESH_INTERVALS.STANDARD;
export const TIMEZONE = 'America/Sao_Paulo';

/**
 * Type definitions for type safety
 */
export type MetricType = keyof typeof METRIC_TYPES;
export type DateRange = keyof typeof DATE_RANGES;
export type ChartType = keyof typeof CHART_TYPES;
export type MetricThreshold = keyof typeof METRIC_THRESHOLDS;
export type RefreshInterval = keyof typeof REFRESH_INTERVALS;

/**
 * Interface for metric configuration
 */
export interface MetricConfig {
  type: MetricType;
  threshold?: number;
  chartType?: ChartType;
  refreshInterval?: RefreshInterval;
  dateRange?: DateRange;
}

/**
 * Interface for chart configuration
 */
export interface ChartConfig {
  type: ChartType;
  showLegend?: boolean;
  showGrid?: boolean;
  showTooltip?: boolean;
  animate?: boolean;
  stacked?: boolean;
}

/**
 * Validation functions for type checking
 */
export const isValidMetricType = (type: string): type is MetricType => {
  return type in METRIC_TYPES;
};

export const isValidDateRange = (range: string): range is DateRange => {
  return range in DATE_RANGES;
};

export const isValidChartType = (type: string): type is ChartType => {
  return type in CHART_TYPES;
};