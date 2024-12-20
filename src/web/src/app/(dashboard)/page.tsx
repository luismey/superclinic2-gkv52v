'use client';

import React, { useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import cn from 'classnames';

// Internal components
import MetricsCard from '../../components/analytics/MetricsCard';
import ConversionChart from '../../components/analytics/ConversionChart';
import { useAnalytics } from '../../hooks/useAnalytics';

// Types and constants
import { MetricType, AnalyticsDateRange } from '../../types/analytics';
import { COLORS, SPACING, TYPE_SCALE } from '../../constants/ui';
import { METRIC_THRESHOLDS, DEFAULT_DATE_RANGE } from '../../constants/analytics';

// Default thresholds for metrics
const DEFAULT_THRESHOLDS = {
  leads: {
    warning: 25,
    critical: 20,
    comparison_type: 'less_than' as const
  },
  conversion: {
    warning: METRIC_THRESHOLDS.CONVERSION_RATE_TARGET - 5,
    critical: METRIC_THRESHOLDS.CONVERSION_RATE_TARGET - 10,
    comparison_type: 'less_than' as const
  },
  response: {
    warning: METRIC_THRESHOLDS.RESPONSE_TIME_MAX - 100,
    critical: METRIC_THRESHOLDS.RESPONSE_TIME_MAX,
    comparison_type: 'greater_than' as const
  }
};

/**
 * Main dashboard page component for the Porfin platform.
 * Displays real-time business metrics, conversion trends, and performance analytics.
 */
export default function Dashboard() {
  // Initialize analytics hook with default filters
  const { 
    metrics: { performance, conversions },
    isLoading,
    error,
    chartConfigs
  } = useAnalytics({
    metric_types: [
      MetricType.CONVERSION,
      MetricType.RESPONSE_TIME,
      MetricType.MESSAGE_VOLUME,
      MetricType.AI_USAGE
    ],
    date_range: DEFAULT_DATE_RANGE,
    user_segments: [],
    channels: ['whatsapp'],
    filters: {}
  });

  // Generate metric cards configuration
  const metricCards = useMemo(() => [
    {
      type: MetricType.CONVERSION,
      title: 'Taxa de Conversão',
      description: 'Leads convertidos em pacientes',
      thresholds: DEFAULT_THRESHOLDS.conversion,
      targetValue: METRIC_THRESHOLDS.CONVERSION_RATE_TARGET
    },
    {
      type: MetricType.RESPONSE_TIME,
      title: 'Tempo de Resposta',
      description: 'Média de tempo para primeira resposta',
      thresholds: DEFAULT_THRESHOLDS.response,
      targetValue: METRIC_THRESHOLDS.RESPONSE_TIME_MAX
    },
    {
      type: MetricType.AI_USAGE,
      title: 'Uso de IA',
      description: 'Porcentagem de interações automatizadas',
      thresholds: {
        warning: 70,
        critical: 60,
        comparison_type: 'less_than'
      },
      targetValue: METRIC_THRESHOLDS.AI_USAGE_TARGET
    }
  ], []);

  // Handle threshold exceeded callback
  const handleThresholdExceeded = useCallback((metricType: MetricType, value: number) => {
    console.warn(`Threshold exceeded for ${metricType}:`, value);
    // Implement alert/notification system here
  }, []);

  // Format current date for header
  const formattedDate = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <main className="flex flex-col gap-6 p-6">
      {/* Dashboard Header */}
      <header className="flex justify-between items-center">
        <div>
          <h1 className={cn(
            'text-2xl font-semibold text-gray-900 dark:text-gray-100',
            'mb-1'
          )}>
            Dashboard
          </h1>
          <p className="text-gray-500 dark:text-gray-400 capitalize">
            {formattedDate}
          </p>
        </div>
      </header>

      {/* Metrics Grid */}
      <section 
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        aria-label="Key performance metrics"
      >
        {metricCards.map((card) => (
          <MetricsCard
            key={card.type}
            metricType={card.type}
            title={card.title}
            description={card.description}
            targetValue={card.targetValue}
            thresholds={card.thresholds}
            showTrend
            animate
            onThresholdExceeded={(value) => handleThresholdExceeded(card.type, value)}
          />
        ))}
      </section>

      {/* Conversion Chart */}
      <section 
        className="w-full"
        aria-label="Conversion trends"
      >
        <ConversionChart
          dateRange={DEFAULT_DATE_RANGE}
          comparisonEnabled
          thresholdDisplay
          className="h-[400px]"
        />
      </section>

      {/* Activity Feed - To be implemented */}
      <section 
        className="w-full lg:w-1/3"
        aria-label="Recent activity"
      >
        {/* Activity feed component will go here */}
      </section>
    </main>
  );
}