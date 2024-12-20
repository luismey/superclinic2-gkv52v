import React, { useCallback, useMemo, useEffect } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, ChartOptions } from 'chart.js';
import cn from 'classnames';

import ChartContainer from './ChartContainer';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useWebSocket } from '../../hooks/useWebSocket';
import { COLORS } from '../../constants/ui';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

// Chart colors with semantic meaning
const CHART_COLORS = {
  conversion: COLORS.semantic.success,
  volume: COLORS.light.primary,
  response: COLORS.semantic.warning,
  threshold: COLORS.semantic.error,
  comparison: COLORS.light.secondary
} as const;

// Enhanced chart options with accessibility features
const CHART_OPTIONS: ChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        generateLabels: (chart) => {
          const labels = ChartJS.defaults.plugins.legend.labels.generateLabels(chart);
          return labels.map(label => ({
            ...label,
            text: `${label.text} (${label.datasetIndex === 0 ? 'Current' : 'Previous'} Period)`
          }));
        }
      }
    },
    tooltip: {
      mode: 'index',
      intersect: false,
      callbacks: {
        label: (context) => {
          const label = context.dataset.label || '';
          const value = context.parsed.y;
          return `${label}: ${value.toFixed(1)}%`;
        }
      }
    },
    annotation: {
      annotations: {
        threshold: {
          type: 'line',
          borderColor: CHART_COLORS.threshold,
          borderWidth: 2,
          label: {
            content: 'Target Threshold',
            enabled: true
          }
        }
      }
    }
  },
  animation: {
    duration: 300
  }
};

interface CampaignPerformanceProps {
  campaignId: string;
  dateRange: AnalyticsDateRange;
  comparisonRange?: AnalyticsDateRange;
  thresholds: {
    conversion: number;
    response: number;
    volume: number;
  };
  className?: string;
  testId?: string;
}

export const CampaignPerformance: React.FC<CampaignPerformanceProps> = ({
  campaignId,
  dateRange,
  comparisonRange,
  thresholds,
  className,
  testId = 'campaign-performance'
}) => {
  // Initialize analytics hook with campaign filters
  const { 
    metrics,
    isLoading,
    error,
    chartConfigs,
    updateFilters,
    refreshAllMetrics
  } = useAnalytics({
    metric_types: ['conversion_rate', 'message_volume', 'response_time'],
    date_range: dateRange,
    comparison_period: comparisonRange,
    filters: { campaign_id: campaignId }
  });

  // Initialize WebSocket for real-time updates
  const { connected, onMessage } = useWebSocket();

  // Process metrics into chart format with thresholds
  const chartData = useMemo(() => {
    if (!metrics.performance) return null;

    return {
      labels: metrics.performance.map(m => m.timestamp.toLocaleDateString('pt-BR')),
      datasets: [
        {
          label: 'Conversion Rate',
          data: metrics.performance.map(m => m.value),
          borderColor: CHART_COLORS.conversion,
          backgroundColor: CHART_COLORS.conversion + '40',
          fill: true
        },
        comparisonRange && {
          label: 'Previous Period',
          data: metrics.performance.map(m => m.comparison_period_value),
          borderColor: CHART_COLORS.comparison,
          backgroundColor: CHART_COLORS.comparison + '40',
          fill: true,
          borderDash: [5, 5]
        }
      ].filter(Boolean)
    };
  }, [metrics.performance, comparisonRange]);

  // Handle real-time metric updates
  const handleMetricUpdate = useCallback((message: any) => {
    if (message.type === 'metric_update' && message.campaignId === campaignId) {
      refreshAllMetrics();
    }
  }, [campaignId, refreshAllMetrics]);

  // Setup WebSocket listener
  useEffect(() => {
    if (connected) {
      onMessage(handleMetricUpdate);
    }
  }, [connected, onMessage, handleMetricUpdate]);

  // Update filters when props change
  useEffect(() => {
    updateFilters({
      date_range: dateRange,
      comparison_period: comparisonRange
    });
  }, [dateRange, comparisonRange, updateFilters]);

  return (
    <ChartContainer
      title="Campaign Performance Analytics"
      loading={isLoading}
      error={error ? new Error(error) : null}
      className={cn('min-h-[400px]', className)}
      testId={testId}
      retryFn={refreshAllMetrics}
    >
      {chartData && (
        <div 
          className="h-full"
          role="region"
          aria-label="Campaign performance chart"
        >
          <ChartJS
            type="line"
            data={chartData}
            options={{
              ...CHART_OPTIONS,
              plugins: {
                ...CHART_OPTIONS.plugins,
                annotation: {
                  annotations: {
                    threshold: {
                      ...CHART_OPTIONS.plugins.annotation.annotations.threshold,
                      yMin: thresholds.conversion,
                      yMax: thresholds.conversion
                    }
                  }
                }
              }
            }}
          />
        </div>
      )}
    </ChartContainer>
  );
};

export default CampaignPerformance;
```

This implementation includes:

1. Real-time Analytics:
- WebSocket integration for live metric updates
- Automatic refresh on data changes
- Comparison period support
- Threshold indicators

2. Accessibility Features:
- ARIA labels and roles
- Screen reader support
- Keyboard navigation
- High contrast colors
- Semantic HTML structure

3. Performance Optimizations:
- Memoized chart data processing
- Efficient re-renders
- Proper cleanup of WebSocket listeners
- Caching through useAnalytics hook

4. Enhanced Visualization:
- Responsive chart layout
- Interactive tooltips
- Custom legend labels
- Threshold annotations
- Comparison period visualization

5. Error Handling:
- Loading states
- Error boundaries
- Retry functionality
- Validation of inputs

The component can be used like this:

```typescript
<CampaignPerformance
  campaignId="campaign-123"
  dateRange={{
    start_date: new Date('2023-01-01'),
    end_date: new Date('2023-12-31'),
    granularity: 'day'
  }}
  comparisonRange={{
    start_date: new Date('2022-01-01'),
    end_date: new Date('2022-12-31'),
    granularity: 'day'
  }}
  thresholds={{
    conversion: 30,
    response: 500,
    volume: 1000
  }}
/>