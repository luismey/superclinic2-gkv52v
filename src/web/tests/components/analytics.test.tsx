import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import WS from 'jest-websocket-mock';

import { ChartContainer } from '../../src/components/analytics/ChartContainer';
import { ConversionChart } from '../../src/components/analytics/ConversionChart';
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { METRIC_THRESHOLDS, REFRESH_INTERVALS } from '../../src/constants/analytics';

// Mock the analytics hook
vi.mock('../../src/hooks/useAnalytics');
const mockUseAnalytics = useAnalytics as vi.MockedFunction<typeof useAnalytics>;

// Mock WebSocket server for real-time updates
let wsServer: WS;

describe('Analytics Components', () => {
  beforeEach(() => {
    // Setup WebSocket mock server
    wsServer = new WS('ws://localhost:8080');
  });

  afterEach(() => {
    vi.clearAllMocks();
    WS.clean();
  });

  describe('ChartContainer', () => {
    it('renders with loading state correctly', () => {
      render(
        <ChartContainer
          title="Test Chart"
          loading={true}
          error={null}
          testId="test-chart"
        >
          <div>Chart content</div>
        </ChartContainer>
      );

      expect(screen.getByTestId('test-chart')).toBeInTheDocument();
      expect(screen.getByText('Loading chart data...')).toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    });

    it('handles error states appropriately', () => {
      const error = new Error('Failed to load data');
      const retryFn = vi.fn();

      render(
        <ChartContainer
          title="Test Chart"
          loading={false}
          error={error}
          retryFn={retryFn}
        >
          <div>Chart content</div>
        </ChartContainer>
      );

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      
      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      expect(retryFn).toHaveBeenCalledTimes(1);
    });

    it('meets accessibility requirements', async () => {
      const { container } = render(
        <ChartContainer
          title="Accessibility Test"
          loading={false}
          error={null}
        >
          <div>Chart content</div>
        </ChartContainer>
      );

      // Check ARIA landmarks
      expect(container.querySelector('[role="article"]')).toBeInTheDocument();
      
      // Verify color contrast
      const element = screen.getByRole('article');
      const styles = window.getComputedStyle(element);
      expect(styles.backgroundColor).toHaveValidContrast();
    });
  });

  describe('ConversionChart', () => {
    const mockDateRange = {
      start_date: new Date('2023-01-01'),
      end_date: new Date('2023-12-31'),
      granularity: 'day' as const
    };

    const mockConversionData = {
      metrics: {
        conversions: [
          {
            timestamp: '2023-01-01',
            conversion_type: 'lead_capture',
            value: 68,
            trend_direction: 'up',
            percent_change: 15
          }
        ]
      },
      isLoading: false,
      error: null
    };

    beforeEach(() => {
      mockUseAnalytics.mockReturnValue(mockConversionData);
    });

    it('renders conversion metrics correctly', async () => {
      render(
        <ConversionChart
          dateRange={mockDateRange}
          testId="conversion-chart"
        />
      );

      await waitFor(() => {
        expect(screen.getByTestId('conversion-chart')).toBeInTheDocument();
        expect(screen.getByText('Conversão de Leads')).toBeInTheDocument();
      });

      // Verify threshold line
      const thresholdElement = screen.getByText('Meta');
      expect(thresholdElement).toBeInTheDocument();
      expect(thresholdElement).toHaveAttribute('fill', expect.stringMatching(/#FF4D4D/i));
    });

    it('handles real-time updates via WebSocket', async () => {
      render(
        <ConversionChart
          dateRange={mockDateRange}
          testId="conversion-chart"
        />
      );

      // Simulate WebSocket update
      await wsServer.connected;
      wsServer.send(JSON.stringify({
        type: 'conversion_update',
        data: {
          timestamp: new Date().toISOString(),
          value: 75,
          conversion_type: 'lead_capture'
        }
      }));

      await waitFor(() => {
        const updatedValue = screen.getByText('75%');
        expect(updatedValue).toBeInTheDocument();
      });
    });

    it('validates performance thresholds', async () => {
      const highPerformanceData = {
        ...mockConversionData,
        metrics: {
          conversions: [{
            timestamp: '2023-01-01',
            conversion_type: 'lead_capture',
            value: METRIC_THRESHOLDS.CONVERSION_RATE_TARGET + 10
          }]
        }
      };

      mockUseAnalytics.mockReturnValue(highPerformanceData);

      render(
        <ConversionChart
          dateRange={mockDateRange}
          testId="conversion-chart"
        />
      );

      await waitFor(() => {
        const performanceIndicator = screen.getByTestId('performance-indicator');
        expect(performanceIndicator).toHaveClass('text-success');
      });
    });

    it('supports Portuguese language formatting', async () => {
      render(
        <ConversionChart
          dateRange={mockDateRange}
          testId="conversion-chart"
        />
      );

      await waitFor(() => {
        // Verify Brazilian Portuguese date format
        expect(screen.getByText(/01 de jan/i)).toBeInTheDocument();
        
        // Verify number formatting
        const percentValue = screen.getByText('68,0%');
        expect(percentValue).toBeInTheDocument();
      });
    });

    it('maintains responsive layout', async () => {
      const { container } = render(
        <ConversionChart
          dateRange={mockDateRange}
          testId="conversion-chart"
        />
      );

      // Test different viewport sizes
      const sizes = [
        { width: 375, height: 667 },  // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1440, height: 900 }  // Desktop
      ];

      for (const size of sizes) {
        window.innerWidth = size.width;
        window.innerHeight = size.height;
        fireEvent(window, new Event('resize'));

        await waitFor(() => {
          const chart = container.querySelector('.recharts-responsive-container');
          expect(chart).toBeInTheDocument();
          expect(chart).toHaveStyle({ width: '100%' });
        });
      }
    });
  });
});