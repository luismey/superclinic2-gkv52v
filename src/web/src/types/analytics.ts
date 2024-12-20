// @ts-check
import { BaseModel } from './common';

/**
 * Enum for different types of analytics metrics
 * Used to categorize and identify different measurement types
 */
export enum MetricType {
  CONVERSION = 'conversion',
  RESPONSE_TIME = 'response_time',
  MESSAGE_VOLUME = 'message_volume',
  AI_USAGE = 'ai_usage',
  CUSTOMER_SATISFACTION = 'customer_satisfaction',
  REVENUE = 'revenue',
  APPOINTMENT_RATE = 'appointment_rate'
}

/**
 * Enum for different types of conversions
 * Used to track different conversion events in the sales funnel
 */
export enum ConversionType {
  LEAD_CAPTURE = 'lead_capture',
  APPOINTMENT_SCHEDULED = 'appointment_scheduled',
  TREATMENT_ACCEPTED = 'treatment_accepted',
  PAYMENT_COMPLETED = 'payment_completed',
  FOLLOW_UP_SCHEDULED = 'follow_up_scheduled'
}

/**
 * Enum for different types of messages
 * Used to categorize different message interactions
 */
export enum MessageType {
  TEXT = 'text',
  MEDIA = 'media',
  DOCUMENT = 'document',
  LOCATION = 'location',
  APPOINTMENT = 'appointment',
  PAYMENT = 'payment'
}

/**
 * Interface for analytics date range
 * Used to specify time periods for analytics queries
 */
export interface AnalyticsDateRange {
  start_date: Date;
  end_date: Date;
  granularity: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
}

/**
 * Interface for metric health status thresholds
 * Used to determine metric status based on value ranges
 */
export interface MetricThresholds {
  warning: number;
  critical: number;
  comparison_type: 'greater_than' | 'less_than';
}

/**
 * Enhanced interface for individual analytics metrics
 * Extends BaseModel with comprehensive metric data
 */
export interface AnalyticsMetric extends BaseModel {
  metric_type: MetricType;
  value: number;
  unit: string;
  timestamp: Date;
  comparison_period_value: number;
  status: 'healthy' | 'warning' | 'critical';
  metadata: Record<string, any>;
  thresholds?: MetricThresholds;
  trend_direction: 'up' | 'down' | 'stable';
  percent_change: number;
}

/**
 * Enhanced interface for conversion tracking metrics
 * Used to track detailed conversion funnel data
 */
export interface ConversionMetric extends AnalyticsMetric {
  lead_id: string;
  conversion_type: ConversionType;
  source_channel: string;
  conversion_stage: string;
  previous_stage: string;
  conversion_value: number;
  conversion_metadata: Record<string, any>;
  time_to_convert: number;
  campaign_id?: string;
  virtual_assistant_id?: string;
}

/**
 * Enhanced interface for message interaction metrics
 * Used to track detailed message engagement data
 */
export interface MessageMetric extends AnalyticsMetric {
  chat_id: string;
  message_type: MessageType;
  sentiment_score: number;
  interaction_count: number;
  user_segment: string;
  response_time_ms: number;
  is_ai_response: boolean;
  word_count?: number;
  language?: string;
  intent_classification?: string;
  customer_id: string;
}

/**
 * Interface for analytics visualization configuration
 * Used to specify chart and graph display options
 */
export interface AnalyticsVisualization {
  chart_type: 'line' | 'bar' | 'pie' | 'funnel' | 'heatmap';
  dimensions: string[];
  measures: string[];
  filters: Record<string, any>;
  sort_by?: string;
  limit?: number;
  color_scheme?: string[];
  show_legend: boolean;
  show_values: boolean;
}

/**
 * Enhanced interface for analytics filtering options
 * Used to filter and segment analytics data
 */
export interface AnalyticsFilter {
  metric_types: MetricType[];
  date_range: AnalyticsDateRange;
  user_segments: string[];
  channels: string[];
  comparison_period: AnalyticsDateRange;
  filters: Record<string, any>;
  exclude_outliers?: boolean;
  min_value?: number;
  max_value?: number;
  confidence_level?: number;
}

/**
 * Interface for analytics dashboard configuration
 * Used to specify dashboard layout and components
 */
export interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  layout: {
    rows: number;
    columns: number;
    widgets: Array<{
      id: string;
      type: 'metric' | 'chart' | 'table';
      position: { row: number; col: number; width: number; height: number };
      configuration: AnalyticsVisualization;
      filters: AnalyticsFilter;
    }>;
  };
  refresh_interval: number;
  is_default: boolean;
}

/**
 * Default date range for analytics queries
 * Provides a 30-day lookback period
 */
export const DEFAULT_DATE_RANGE: AnalyticsDateRange = {
  start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  end_date: new Date(),
  granularity: 'day'
};

/**
 * Type for analytics comparison results
 * Used to represent period-over-period comparisons
 */
export interface MetricComparison {
  current_value: number;
  previous_value: number;
  percent_change: number;
  absolute_change: number;
  trend_direction: 'up' | 'down' | 'stable';
  statistical_significance?: number;
}

/**
 * Type for analytics export configuration
 * Used to specify export format and options
 */
export interface AnalyticsExport {
  format: 'csv' | 'xlsx' | 'json' | 'pdf';
  metrics: MetricType[];
  date_range: AnalyticsDateRange;
  filters: AnalyticsFilter;
  include_metadata: boolean;
  file_name?: string;
}

/**
 * Type for real-time analytics snapshot
 * Used for live monitoring and updates
 */
export interface RealTimeAnalytics {
  timestamp: Date;
  active_conversations: number;
  messages_per_minute: number;
  active_ai_sessions: number;
  queue_length: number;
  average_response_time: number;
  error_rate: number;
}