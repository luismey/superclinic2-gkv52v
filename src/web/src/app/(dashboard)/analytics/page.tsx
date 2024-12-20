'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import cn from 'classnames';

// Internal components
import ChartContainer from '../../../components/analytics/ChartContainer';
import ConversionChart from '../../../components/analytics/ConversionChart';
import MetricsCard from '../../../components/analytics/MetricsCard';

// Hooks and utilities
import { useAnalytics } from '../../../hooks/useAnalytics';
import { 
  MetricType, 
  AnalyticsDateRange, 
  ConversionType 
} from '../../../types/analytics';
import { 
  METRIC_THRESHOLDS, 
  REFRESH_INTERVALS,
  DEFAULT_DATE_RANGE 
} from '../../../constants/analytics';
import { SPACING, TYPE_SCALE } from '../../../constants/ui';

// Constants
const DEFAULT_METRICS = [
  {
    type: MetricType.CONVERSION,
    title: 'Taxa de Conversão',
    description: 'Percentual de leads convertidos',
    target: METRIC_THRESHOLDS.CONVERSION_RATE_TARGET
  },
  {
    type: MetricType.RESPONSE_TIME,
    title: 'Tempo de Resposta',
    description: 'Tempo médio de resposta em ms',
    target: METRIC_THRESHOLDS.RESPONSE_TIME_MAX
  },
  {
    type: MetricType.AI_USAGE,
    title: 'Uso de IA',
    description: 'Percentual de interações automatizadas',
    target: METRIC_THRESHOLDS.AI_USAGE_TARGET
  },
  {
    type: MetricType.APPOINTMENT_RATE,
    title: 'Taxa de Agendamento',
    description: 'Consultas agendadas por lead',
    target: METRIC_THRESHOLDS.CAMPAIGN_SUCCESS_RATE
  }
];

const AnalyticsPage: React.FC = () => {
  // State for date range filtering
  const [dateRange, setDateRange] = useState<AnalyticsDateRange>(DEFAULT_DATE_RANGE);
  const [showComparison, setShowComparison] = useState(true);

  // Initialize analytics hook with required metrics
  const { 
    metrics,
    isLoading,
    error,
    updateFilters,
    refreshAllMetrics,
    chartConfigs
  } = useAnalytics({
    metric_types: DEFAULT_METRICS.map(m => m.type),
    date_range: dateRange,
    user_segments: [],
    channels: [],
    filters: {}
  });

  // Virtualization for metrics grid
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: DEFAULT_METRICS.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 160,
    overscan: 2
  });

  // Memoized metrics grid items
  const virtualMetrics = useMemo(() => 
    rowVirtualizer.getVirtualItems().map(virtualRow => {
      const metric = DEFAULT_METRICS[virtualRow.index];
      return (
        <motion.div
          key={metric.type}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: virtualRow.index * 0.1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: virtualRow.size,
            transform: `translateY(${virtualRow.start}px)`
          }}
        >
          <MetricsCard
            metricType={metric.type}
            title={metric.title}
            description={metric.description}
            targetValue={metric.target}
            thresholds={{
              warning: metric.target * 0.9,
              critical: metric.target * 0.75,
              comparison_type: 'less_than'
            }}
            showTrend
            animate
            className="h-full"
            onThresholdExceeded={(value) => {
              console.warn(`Threshold exceeded for ${metric.title}: ${value}`);
            }}
          />
        </motion.div>
      );
    }),
    [rowVirtualizer.getVirtualItems()]
  );

  // Date range change handler
  const handleDateRangeChange = useCallback((newRange: AnalyticsDateRange) => {
    setDateRange(newRange);
    updateFilters({ date_range: newRange });
  }, [updateFilters]);

  // Comparison toggle handler
  const handleComparisonToggle = useCallback(() => {
    setShowComparison(prev => !prev);
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className={cn(
            "text-2xl font-semibold text-gray-900 dark:text-gray-100",
            TYPE_SCALE.sizes.xl
          )}>
            Analytics Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Métricas e insights do seu negócio
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          {/* Date Range Selector would go here */}
          <button
            onClick={() => refreshAllMetrics()}
            className={cn(
              "px-4 py-2 bg-primary text-white rounded-md",
              "hover:bg-primary/90 transition-colors",
              "focus:outline-none focus:ring-2 focus:ring-primary/50"
            )}
            aria-label="Atualizar métricas"
          >
            Atualizar
          </button>
        </div>
      </header>

      {/* Metrics Grid */}
      <div
        ref={parentRef}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
        style={{ height: rowVirtualizer.getTotalSize() }}
        role="region"
        aria-label="Métricas principais"
      >
        {virtualMetrics}
      </div>

      {/* Conversion Chart */}
      <section className="mt-6" aria-label="Gráficos de conversão">
        <ConversionChart
          dateRange={dateRange}
          comparisonEnabled={showComparison}
          thresholdDisplay
          className="h-[400px]"
        />
      </section>

      {/* Additional Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Response Time Chart */}
        <ChartContainer
          title="Tempo de Resposta"
          loading={isLoading}
          error={error}
          className="h-[300px]"
        >
          {/* Response time chart implementation */}
        </ChartContainer>

        {/* Message Volume Chart */}
        <ChartContainer
          title="Volume de Mensagens"
          loading={isLoading}
          error={error}
          className="h-[300px]"
        >
          {/* Message volume chart implementation */}
        </ChartContainer>
      </div>
    </div>
  );
};

export default AnalyticsPage;