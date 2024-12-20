import { renderHook, act } from '@testing-library/react-hooks'; // v8.0.0
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // v4.0.0
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import { FC } from 'react';

// Internal imports
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { analyticsService } from '../../src/services/analytics';
import {
  MetricType,
  ConversionType,
  MessageType,
  AnalyticsDateRange,
  AnalyticsFilter,
  AnalyticsMetric,
  ConversionMetric,
  MessageMetric
} from '../../src/types/analytics';
import { METRIC_THRESHOLDS, REFRESH_INTERVALS } from '../../src/constants/analytics';

// Mock data setup
const mockDateRange: AnalyticsDateRange = {
  start_date: new Date('2023-01-01'),
  end_date: new Date('2023-01-31'),
  granularity: 'day'
};

const mockFilter: AnalyticsFilter = {
  metric_types: [MetricType.CONVERSION, MetricType.RESPONSE_TIME],
  date_range: mockDateRange,
  user_segments: [],
  channels: [],
  comparison_period: mockDateRange,
  filters: {}
};

const mockPerformanceMetrics: AnalyticsMetric[] = [
  {
    id: '1',
    metric_type: MetricType.RESPONSE_TIME,
    value: 450,
    unit: 'ms',
    timestamp: new Date(),
    comparison_period_value: 500,
    status: 'healthy',
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    trend_direction: 'down',
    percent_change: -10
  }
];

const mockConversionMetrics: ConversionMetric[] = [
  {
    id: '2',
    metric_type: MetricType.CONVERSION,
    value: 35,
    unit: 'percent',
    timestamp: new Date(),
    comparison_period_value: 25,
    status: 'healthy',
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    trend_direction: 'up',
    percent_change: 40,
    lead_id: '123',
    conversion_type: ConversionType.LEAD_CAPTURE,
    source_channel: 'whatsapp',
    conversion_stage: 'initial_contact',
    previous_stage: 'none',
    conversion_value: 100,
    conversion_metadata: {},
    time_to_convert: 3600
  }
];

const mockMessageMetrics: MessageMetric[] = [
  {
    id: '3',
    metric_type: MetricType.MESSAGE_VOLUME,
    value: 1000,
    unit: 'messages',
    timestamp: new Date(),
    comparison_period_value: 800,
    status: 'healthy',
    metadata: {},
    created_at: new Date(),
    updated_at: new Date(),
    trend_direction: 'up',
    percent_change: 25,
    chat_id: '456',
    message_type: MessageType.TEXT,
    sentiment_score: 0.8,
    interaction_count: 50,
    user_segment: 'active',
    response_time_ms: 400,
    is_ai_response: true,
    customer_id: '789'
  }
];

// Create wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0
      }
    }
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Setup mocks
const setupMocks = () => {
  jest.spyOn(analyticsService, 'getPerformanceMetrics').mockResolvedValue(mockPerformanceMetrics);
  jest.spyOn(analyticsService, 'getConversionMetrics').mockResolvedValue(mockConversionMetrics);
  jest.spyOn(analyticsService, 'getMessageMetrics').mockResolvedValue(mockMessageMetrics);
};

describe('useAnalytics Hook', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch initial data successfully', async () => {
    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    // Verify initial loading state
    expect(result.current.isLoading).toBe(true);
    expect(result.current.error).toBeNull();

    // Wait for data to load
    await waitFor(() => !result.current.isLoading);

    // Verify loaded data
    expect(result.current.metrics.performance).toEqual(mockPerformanceMetrics);
    expect(result.current.metrics.conversions).toEqual(mockConversionMetrics);
    expect(result.current.metrics.messages).toEqual(mockMessageMetrics);
  });

  test('should handle loading states correctly', async () => {
    const loadingStates: boolean[] = [];
    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    // Track loading state changes
    loadingStates.push(result.current.isLoading);

    await waitFor(() => !result.current.isLoading);
    loadingStates.push(result.current.isLoading);

    // Verify loading state transitions
    expect(loadingStates).toEqual([true, false]);
  });

  test('should handle error states correctly', async () => {
    const error = new Error('API Error');
    jest.spyOn(analyticsService, 'getPerformanceMetrics').mockRejectedValue(error);

    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    await waitFor(() => !result.current.isLoading);

    expect(result.current.error).toBeTruthy();
    expect(result.current.metrics.performance).toBeUndefined();
  });

  test('should update filters and refetch data', async () => {
    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    await waitFor(() => !result.current.isLoading);

    // Update filters
    const newFilter = {
      ...mockFilter,
      metric_types: [MetricType.AI_USAGE]
    };

    act(() => {
      result.current.updateFilters(newFilter);
    });

    // Verify filter update
    expect(result.current.filter.metric_types).toEqual([MetricType.AI_USAGE]);

    // Wait for refetch
    await waitFor(() => !result.current.isLoading);
    expect(analyticsService.getPerformanceMetrics).toHaveBeenCalledWith(newFilter);
  });

  test('should verify conversion rate meets target threshold', async () => {
    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    await waitFor(() => !result.current.isLoading);

    const conversionMetric = result.current.metrics.conversions?.[0];
    expect(conversionMetric?.percent_change).toBeGreaterThanOrEqual(METRIC_THRESHOLDS.CONVERSION_RATE_TARGET);
  });

  test('should handle real-time updates correctly', async () => {
    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    await waitFor(() => !result.current.isLoading);

    // Simulate critical metric update
    const criticalMetrics = [{
      ...mockPerformanceMetrics[0],
      status: 'critical',
      value: 1000
    }];

    act(() => {
      jest.spyOn(analyticsService, 'getPerformanceMetrics').mockResolvedValueOnce(criticalMetrics);
    });

    // Verify refresh interval adjustment
    await waitFor(() => result.current.metrics.performance?.[0].status === 'critical');
    expect(result.current.metrics.performance?.[0].value).toBe(1000);
  });

  test('should export analytics data correctly', async () => {
    const { result, waitFor } = renderHook(() => useAnalytics(mockFilter), {
      wrapper: createWrapper()
    });

    await waitFor(() => !result.current.isLoading);

    await act(async () => {
      await result.current.exportAnalytics('csv');
    });

    expect(result.current.isExporting).toBe(false);
  });
});