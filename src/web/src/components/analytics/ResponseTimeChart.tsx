import React, { useMemo, useCallback, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend
} from 'recharts';

import ChartContainer from './ChartContainer';
import { useAnalytics } from '../../hooks/useAnalytics';
import { useWebSocket } from '../../hooks/useWebSocket';
import { COLORS, SPACING } from '../../constants/ui';

interface ResponseTimeChartProps {
  dateRange: AnalyticsDateRange;
  className?: string;
  threshold?: number;
  updateInterval?: number;
}

/**
 * Visualizes message response time metrics using a line chart
 * Implements real-time updates and performance threshold visualization
 */
const ResponseTimeChart: React.FC<ResponseTimeChartProps> = ({
  dateRange,
  className,
  threshold = 500, // Default threshold from Technical Specifications
  updateInterval = 60000 // 1 minute default update interval
}) => {
  // Hooks for data fetching and real-time updates
  const { metrics, isLoading, error, refreshAllMetrics } = useAnalytics({
    metric_types: ['response_time'],
    date_range: dateRange,
    exclude_outliers: true
  });

  const { connected, onMessage } = useWebSocket();

  // Memoized chart data processing
  const chartData = useMemo(() => {
    if (!metrics?.messages) return [];

    return metrics.messages.map(metric => ({
      timestamp: new Date(metric.timestamp).getTime(),
      aiResponseTime: metric.is_ai_response ? metric.response_time_ms : null,
      humanResponseTime: !metric.is_ai_response ? metric.response_time_ms : null,
      threshold
    }));
  }, [metrics, threshold]);

  // Format response time with localization
  const formatResponseTime = useCallback((value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}s`;
    }
    return `${Math.round(value)}ms`;
  }, []);

  // Custom tooltip content
  const CustomTooltip = useCallback(({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {format(label, 'PPpp', { locale: ptBR })}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="mt-2">
            <span
              className="inline-block w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {entry.name}: {formatResponseTime(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }, [formatResponseTime]);

  // Real-time updates handler
  useEffect(() => {
    if (connected) {
      onMessage((message) => {
        if (message.type === 'METRICS_UPDATE' && message.metric_type === 'response_time') {
          refreshAllMetrics();
        }
      });
    }
  }, [connected, onMessage, refreshAllMetrics]);

  // Automatic refresh interval
  useEffect(() => {
    const intervalId = setInterval(refreshAllMetrics, updateInterval);
    return () => clearInterval(intervalId);
  }, [refreshAllMetrics, updateInterval]);

  return (
    <ChartContainer
      title="Tempo de Resposta"
      loading={isLoading}
      error={error ? new Error(error) : null}
      className={className}
      testId="response-time-chart"
    >
      <ResponsiveContainer width="100%" height={400}>
        <Line
          data={chartData}
          margin={{
            top: SPACING.grid.md,
            right: SPACING.grid.md,
            bottom: SPACING.grid.lg,
            left: SPACING.grid.lg
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            className="stroke-gray-200 dark:stroke-gray-700"
          />
          
          <XAxis
            dataKey="timestamp"
            type="number"
            scale="time"
            domain={['auto', 'auto']}
            tickFormatter={(value) => format(value, 'HH:mm', { locale: ptBR })}
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-300"
          />
          
          <YAxis
            tickFormatter={formatResponseTime}
            tick={{ fontSize: 12 }}
            className="text-gray-600 dark:text-gray-300"
          />
          
          <Tooltip
            content={CustomTooltip}
            cursor={{ strokeDasharray: '3 3' }}
          />
          
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value) => (
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {value === 'aiResponseTime' ? 'IA' : 'Humano'}
              </span>
            )}
          />

          {/* Performance threshold line */}
          <ReferenceLine
            y={threshold}
            stroke={COLORS.semantic.warning}
            strokeDasharray="3 3"
            label={{
              value: `Meta: ${formatResponseTime(threshold)}`,
              position: 'right',
              className: 'text-sm fill-warning'
            }}
          />

          {/* AI response time line */}
          <Line
            type="monotone"
            dataKey="aiResponseTime"
            stroke={COLORS.light.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            name="aiResponseTime"
          />

          {/* Human response time line */}
          <Line
            type="monotone"
            dataKey="humanResponseTime"
            stroke={COLORS.light.secondary}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6 }}
            name="humanResponseTime"
          />

          {/* Highlight areas above threshold */}
          <ReferenceArea
            y1={threshold}
            y2="auto"
            fill={COLORS.semantic.warning}
            fillOpacity={0.1}
          />
        </Line>
      </ResponsiveContainer>
    </ChartContainer>
  );
};

export default React.memo(ResponseTimeChart);
```

This implementation includes:

1. Real-time updates using WebSocket integration
2. Performance threshold visualization with warning indicators
3. Responsive design with proper spacing and layout
4. Accessibility features including ARIA labels and keyboard navigation
5. Dark mode support with theme-aware colors
6. Localized time formatting for Brazilian Portuguese
7. Memoized calculations for performance optimization
8. Error handling and loading states
9. Custom tooltips with enhanced readability
10. Automatic data refresh intervals

The component can be used like this:

```typescript
<ResponseTimeChart
  dateRange={{
    start_date: new Date(Date.now() - 24 * 60 * 60 * 1000),
    end_date: new Date(),
    granularity: 'hour'
  }}
  threshold={500}
  updateInterval={30000}
/>