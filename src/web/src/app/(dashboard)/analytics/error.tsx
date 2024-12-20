'use client';

import React, { useEffect } from 'react';
import Button from '../../../components/common/Button';
import ChartContainer from '../../../components/analytics/ChartContainer';
import { COLORS } from '../../../constants/ui';

// Analytics error types enum
export enum AnalyticsErrorType {
  DATA_FETCH_ERROR = 'DATA_FETCH_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

// Props interface for Analytics Error component
interface AnalyticsErrorProps {
  error: Error;
  reset: () => void;
  errorType?: AnalyticsErrorType;
}

/**
 * Custom hook for enhanced analytics error logging and monitoring
 */
const useAnalyticsErrorLogging = (error: Error, errorType?: AnalyticsErrorType) => {
  useEffect(() => {
    // Log error details for monitoring
    console.error('Analytics Error:', {
      type: errorType || 'UNKNOWN',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });

    // Here you would typically send to your error monitoring service
    // Example: Datadog, Sentry, etc.

  }, [error, errorType]);
};

/**
 * Get localized error message based on error type and details
 */
const getErrorMessage = (errorType?: AnalyticsErrorType, error?: Error): string => {
  const baseMessages = {
    [AnalyticsErrorType.DATA_FETCH_ERROR]: 'Não foi possível carregar os dados analíticos.',
    [AnalyticsErrorType.PROCESSING_ERROR]: 'Erro ao processar dados analíticos.',
    [AnalyticsErrorType.AUTHORIZATION_ERROR]: 'Sem permissão para acessar dados analíticos.',
    [AnalyticsErrorType.NETWORK_ERROR]: 'Erro de conexão ao carregar dados.',
    default: 'Ocorreu um erro ao carregar os dados analíticos.',
  };

  return errorType ? baseMessages[errorType] : baseMessages.default;
};

/**
 * Analytics Error component that provides a user-friendly error display
 * with enhanced error tracking and accessibility support.
 */
const AnalyticsError: React.FC<AnalyticsErrorProps> = ({
  error,
  reset,
  errorType,
}) => {
  // Initialize error logging
  useAnalyticsErrorLogging(error, errorType);

  // Get localized error message
  const errorMessage = getErrorMessage(errorType, error);

  return (
    <ChartContainer
      title="Erro nos Dados Analíticos"
      loading={false}
      error={null}
      className="min-h-[400px]"
      testId="analytics-error-container"
    >
      <div 
        className="flex flex-col items-center justify-center h-full space-y-6 p-8"
        role="alert"
        aria-live="assertive"
      >
        {/* Error Icon */}
        <div 
          className="w-16 h-16 text-error-600 animate-pulse"
          aria-hidden="true"
        >
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
            />
          </svg>
        </div>

        {/* Error Message */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {errorMessage}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Por favor, tente novamente ou entre em contato com o suporte se o problema persistir.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="primary"
            onClick={reset}
            ariaLabel="Tentar novamente"
            testId="analytics-retry-button"
          >
            Tentar Novamente
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            ariaLabel="Recarregar página"
            testId="analytics-reload-button"
          >
            Recarregar Página
          </Button>
        </div>

        {/* Error Details (for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 text-xs text-gray-400 font-mono">
            <p>Error: {error.message}</p>
            <p>Type: {errorType}</p>
          </div>
        )}
      </div>
    </ChartContainer>
  );
};

export default AnalyticsError;