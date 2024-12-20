// @ts-check
import dayjs from 'dayjs'; // v1.11.0
import { z } from 'zod'; // v3.21.0
import { get, post } from '../lib/api';
import {
  MetricType,
  ConversionType,
  MessageType,
  AnalyticsMetric,
  ConversionMetric,
  MessageMetric,
  AnalyticsDateRange,
  AnalyticsFilter,
  MetricThresholds,
  RealTimeAnalytics
} from '../types/analytics';
import {
  METRIC_TYPES,
  DATE_RANGES,
  CHART_TYPES,
  METRIC_THRESHOLDS,
  REFRESH_INTERVALS,
  ChartConfig
} from '../constants/analytics';

// Cache configuration for analytics data
const CACHE_CONFIG = {
  ttl: 300, // 5 minutes
  maxSize: 1000,
  updateInterval: 60 // 1 minute
};

// API endpoints for analytics
const API_ENDPOINTS = {
  metrics: '/api/v1/analytics/metrics',
  conversions: '/api/v1/analytics/conversions',
  messages: '/api/v1/analytics/messages',
  thresholds: '/api/v1/analytics/thresholds',
  refresh: '/api/v1/analytics/refresh'
};

// Validation schemas
const metricsFilterSchema = z.object({
  metric_types: z.array(z.nativeEnum(MetricType)),
  date_range: z.object({
    start_date: z.date(),
    end_date: z.date(),
    granularity: z.enum(['hour', 'day', 'week', 'month', 'quarter', 'year'])
  }),
  user_segments: z.array(z.string()).optional(),
  channels: z.array(z.string()).optional(),
  exclude_outliers: z.boolean().optional()
});

/**
 * Fetches analytics metrics with caching and retry logic
 * @param filter - Analytics filter parameters
 * @param cacheOptions - Cache configuration options
 * @returns Promise<AnalyticsMetric[]>
 */
async function getMetrics(
  filter: AnalyticsFilter,
  cacheOptions = { ...CACHE_CONFIG }
): Promise<AnalyticsMetric[]> {
  try {
    // Validate filter parameters
    const validatedFilter = metricsFilterSchema.parse(filter);

    // Make API request with retry logic
    const response = await get<AnalyticsMetric[]>(API_ENDPOINTS.metrics, {
      params: validatedFilter,
      validateSchema: z.array(z.custom<AnalyticsMetric>()),
      skipCache: !cacheOptions.ttl
    });

    // Apply threshold checks and enrich metrics
    return response.data.map(metric => ({
      ...metric,
      status: getMetricStatus(metric),
      trend_direction: calculateTrendDirection(metric),
      percent_change: calculatePercentChange(metric)
    }));
  } catch (error) {
    console.error('Failed to fetch metrics:', error);
    throw error;
  }
}

/**
 * Fetches conversion metrics with trend analysis
 * @param dateRange - Date range for conversion data
 * @param type - Type of conversion to analyze
 * @param includeComparison - Whether to include comparison data
 * @returns Promise<ConversionMetric[]>
 */
async function getConversionMetrics(
  dateRange: AnalyticsDateRange,
  type: ConversionType,
  includeComparison = true
): Promise<ConversionMetric[]> {
  try {
    const params = {
      date_range: dateRange,
      conversion_type: type,
      include_comparison: includeComparison
    };

    const response = await get<ConversionMetric[]>(API_ENDPOINTS.conversions, {
      params,
      validateSchema: z.array(z.custom<ConversionMetric>())
    });

    return response.data.map(metric => ({
      ...metric,
      trend_direction: calculateTrendDirection(metric),
      percent_change: calculatePercentChange(metric)
    }));
  } catch (error) {
    console.error('Failed to fetch conversion metrics:', error);
    throw error;
  }
}

/**
 * Fetches message interaction metrics
 * @param dateRange - Date range for message data
 * @param type - Type of messages to analyze
 * @returns Promise<MessageMetric[]>
 */
async function getMessageMetrics(
  dateRange: AnalyticsDateRange,
  type: MessageType
): Promise<MessageMetric[]> {
  try {
    const response = await get<MessageMetric[]>(API_ENDPOINTS.messages, {
      params: { date_range: dateRange, message_type: type },
      validateSchema: z.array(z.custom<MessageMetric>())
    });

    return response.data;
  } catch (error) {
    console.error('Failed to fetch message metrics:', error);
    throw error;
  }
}

/**
 * Generates chart configuration based on metric type
 * @param metricType - Type of metric for chart
 * @param customConfig - Custom chart configuration
 * @returns ChartConfig
 */
function generateChartConfig(
  metricType: MetricType,
  customConfig?: Partial<ChartConfig>
): ChartConfig {
  const baseConfig: ChartConfig = {
    type: CHART_TYPES.LINE,
    showLegend: true,
    showGrid: true,
    showTooltip: true,
    animate: true,
    stacked: false
  };

  // Metric-specific chart configurations
  const metricConfigs: Record<MetricType, Partial<ChartConfig>> = {
    [MetricType.CONVERSION]: { type: CHART_TYPES.FUNNEL },
    [MetricType.MESSAGE_VOLUME]: { type: CHART_TYPES.BAR, stacked: true },
    [MetricType.RESPONSE_TIME]: { type: CHART_TYPES.LINE },
    [MetricType.AI_USAGE]: { type: CHART_TYPES.PIE },
    [MetricType.CUSTOMER_SATISFACTION]: { type: CHART_TYPES.BAR }
  };

  return {
    ...baseConfig,
    ...metricConfigs[metricType],
    ...customConfig
  };
}

/**
 * Refreshes analytics data in real-time
 * @param metricTypes - Types of metrics to refresh
 * @returns Promise<RealTimeAnalytics>
 */
async function refreshMetrics(
  metricTypes: MetricType[]
): Promise<RealTimeAnalytics> {
  try {
    const response = await post<RealTimeAnalytics>(API_ENDPOINTS.refresh, {
      metric_types: metricTypes
    });

    return response.data;
  } catch (error) {
    console.error('Failed to refresh metrics:', error);
    throw error;
  }
}

/**
 * Determines metric status based on thresholds
 * @param metric - Analytics metric to evaluate
 * @returns 'healthy' | 'warning' | 'critical'
 */
function getMetricStatus(metric: AnalyticsMetric): 'healthy' | 'warning' | 'critical' {
  if (!metric.thresholds) return 'healthy';

  const { value, thresholds } = metric;
  const { warning, critical, comparison_type } = thresholds;

  if (comparison_type === 'greater_than') {
    if (value >= critical) return 'critical';
    if (value >= warning) return 'warning';
  } else {
    if (value <= critical) return 'critical';
    if (value <= warning) return 'warning';
  }

  return 'healthy';
}

/**
 * Calculates trend direction for a metric
 * @param metric - Analytics metric to evaluate
 * @returns 'up' | 'down' | 'stable'
 */
function calculateTrendDirection(
  metric: AnalyticsMetric
): 'up' | 'down' | 'stable' {
  const change = calculatePercentChange(metric);
  if (Math.abs(change) < 1) return 'stable';
  return change > 0 ? 'up' : 'down';
}

/**
 * Calculates percent change for a metric
 * @param metric - Analytics metric to evaluate
 * @returns number
 */
function calculatePercentChange(metric: AnalyticsMetric): number {
  if (!metric.comparison_period_value) return 0;
  return ((metric.value - metric.comparison_period_value) / metric.comparison_period_value) * 100;
}

// Export analytics service interface
export const analyticsService = {
  getMetrics,
  getConversionMetrics,
  getMessageMetrics,
  generateChartConfig,
  refreshMetrics
};

// Export types for external use
export type {
  AnalyticsMetric,
  ConversionMetric,
  MessageMetric,
  AnalyticsDateRange,
  AnalyticsFilter,
  MetricThresholds,
  RealTimeAnalytics,
  ChartConfig
};