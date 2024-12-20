// @ts-check
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import MockAdapter from 'axios-mock-adapter'; // v1.21.0
import { z } from 'zod'; // v3.22.0
import { render, waitFor } from '@testing-library/react'; // v14.0.0

import { analyticsService } from '../../src/services/analytics';
import { MetricType, AnalyticsMetric, ThresholdConfig } from '../../src/types/analytics';
import { METRIC_TYPES, THRESHOLD_VALUES } from '../../src/constants/analytics';
import { get, post } from '../../src/lib/api';

// Mock axios for HTTP requests
jest.mock('../../src/lib/api');
const mockGet = get as jest.MockedFunction<typeof get>;
const mockPost = post as jest.MockedFunction<typeof post>;

// Mock cache implementation
const mockCache = new Map<string, any>();

// Test data fixtures
const testMetrics: AnalyticsMetric[] = [
  {
    id: '1',
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
    percent_change: 40
  },
  {
    id: '2',
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

describe('Analytics Service', () => {
  let mockAxios: MockAdapter;

  beforeEach(() => {
    mockAxios = new MockAdapter(mockGet as any);
    mockCache.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    mockAxios.restore();
  });

  describe('getMetrics', () => {
    test('should fetch and validate metrics successfully', async () => {
      // Arrange
      const filter = {
        metric_types: [MetricType.CONVERSION],
        date_range: {
          start_date: new Date(),
          end_date: new Date(),
          granularity: 'day' as const
        }
      };

      mockGet.mockResolvedValueOnce({ data: testMetrics });

      // Act
      const result = await analyticsService.getMetrics(filter);

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].metric_type).toBe(MetricType.CONVERSION);
      expect(result[0].value).toBe(35);
      expect(mockGet).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        params: filter
      }));
    });

    test('should handle validation errors correctly', async () => {
      // Arrange
      const invalidFilter = {
        metric_types: ['invalid_type'],
        date_range: {
          start_date: 'invalid_date',
          end_date: new Date(),
          granularity: 'invalid'
        }
      };

      // Act & Assert
      await expect(analyticsService.getMetrics(invalidFilter as any))
        .rejects.toThrow('Validation error');
    });

    test('should use cache when available', async () => {
      // Arrange
      const filter = {
        metric_types: [MetricType.CONVERSION],
        date_range: {
          start_date: new Date(),
          end_date: new Date(),
          granularity: 'day' as const
        }
      };

      mockGet.mockResolvedValueOnce({ data: testMetrics });

      // Act
      const firstCall = await analyticsService.getMetrics(filter);
      const secondCall = await analyticsService.getMetrics(filter);

      // Assert
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(firstCall).toEqual(secondCall);
    });
  });

  describe('getConversionMetrics', () => {
    test('should fetch conversion metrics with trend analysis', async () => {
      // Arrange
      const dateRange = {
        start_date: new Date(),
        end_date: new Date(),
        granularity: 'day' as const
      };

      mockGet.mockResolvedValueOnce({
        data: [testMetrics[0]]
      });

      // Act
      const result = await analyticsService.getConversionMetrics(dateRange, 'lead_capture', true);

      // Assert
      expect(result[0].trend_direction).toBe('up');
      expect(result[0].percent_change).toBe(40);
    });
  });

  describe('generateChartConfig', () => {
    test('should generate correct chart configuration', () => {
      // Arrange & Act
      const config = analyticsService.generateChartConfig(MetricType.CONVERSION);

      // Assert
      expect(config).toEqual(expect.objectContaining({
        type: 'funnel',
        showLegend: true,
        showGrid: true
      }));
    });
  });

  describe('refreshMetrics', () => {
    test('should refresh metrics in real-time', async () => {
      // Arrange
      const metricTypes = [MetricType.CONVERSION, MetricType.RESPONSE_TIME];
      mockPost.mockResolvedValueOnce({
        data: {
          timestamp: new Date(),
          metrics: testMetrics
        }
      });

      // Act
      const result = await analyticsService.refreshMetrics(metricTypes);

      // Assert
      expect(result.metrics).toHaveLength(2);
      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        { metric_types: metricTypes }
      );
    });

    test('should handle refresh errors gracefully', async () => {
      // Arrange
      mockPost.mockRejectedValueOnce(new Error('Network error'));

      // Act & Assert
      await expect(analyticsService.refreshMetrics([MetricType.CONVERSION]))
        .rejects.toThrow('Network error');
    });
  });

  describe('Data Validation', () => {
    test('should validate metric thresholds correctly', () => {
      // Arrange
      const metric = {
        ...testMetrics[0],
        thresholds: {
          warning: 30,
          critical: 20,
          comparison_type: 'greater_than' as const
        }
      };

      // Act
      const result = analyticsService.checkThresholds(metric);

      // Assert
      expect(result.status).toBe('healthy');
      expect(result.trend_direction).toBe('up');
    });

    test('should handle missing threshold configurations', () => {
      // Arrange
      const metric = { ...testMetrics[0] };
      delete metric.thresholds;

      // Act
      const result = analyticsService.checkThresholds(metric);

      // Assert
      expect(result.status).toBe('healthy');
    });
  });

  describe('Performance Requirements', () => {
    test('should meet response time requirements', async () => {
      // Arrange
      const startTime = Date.now();
      mockGet.mockResolvedValueOnce({ data: testMetrics });

      // Act
      await analyticsService.getMetrics({
        metric_types: [MetricType.RESPONSE_TIME],
        date_range: {
          start_date: new Date(),
          end_date: new Date(),
          granularity: 'day'
        }
      });
      const endTime = Date.now();

      // Assert
      expect(endTime - startTime).toBeLessThan(500); // 500ms max response time
    });

    test('should handle large metric datasets efficiently', async () => {
      // Arrange
      const largeDataset = Array(1000).fill(testMetrics[0]);
      mockGet.mockResolvedValueOnce({ data: largeDataset });

      // Act & Assert
      await expect(analyticsService.getMetrics({
        metric_types: [MetricType.CONVERSION],
        date_range: {
          start_date: new Date(),
          end_date: new Date(),
          granularity: 'day'
        }
      })).resolves.toHaveLength(1000);
    });
  });
});