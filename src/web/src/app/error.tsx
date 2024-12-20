'use client';

import React, { useEffect } from 'react'; // v18.0.0
import { Logging } from '@google-cloud/logging'; // v10.0.0
import ErrorIcon from '@mui/icons-material/Error'; // v5.0.0
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import { COLORS } from '../constants/ui';

interface ErrorProps {
  error: Error;
  reset: () => void;
  errorCode?: string;
  customMessage?: string;
}

/**
 * Logs error details to Google Cloud Logging
 */
const logError = async (
  error: Error,
  errorCode?: string,
  metadata?: Record<string, unknown>
) => {
  try {
    const logging = new Logging();
    const log = logging.log('porfin-web-errors');

    const entry = log.entry({
      severity: 'ERROR',
      resource: {
        type: 'web_app',
        labels: {
          error_code: errorCode || 'UNKNOWN',
        },
      },
      jsonPayload: {
        message: error.message,
        stack: error.stack,
        ...metadata,
      },
    });

    await log.write(entry);
  } catch (loggingError) {
    console.error('Failed to log error:', loggingError);
  }
};

/**
 * Enhanced error boundary component with accessibility and monitoring capabilities.
 * Implements Material Design principles and provides error recovery options.
 */
const Error: React.FC<ErrorProps> = ({
  error,
  reset,
  errorCode = 'APP_ERROR',
  customMessage,
}) => {
  // Log error on mount
  useEffect(() => {
    logError(error, errorCode, {
      timestamp: new Date().toISOString(),
      userAgent: window.navigator.userAgent,
    });
  }, [error, errorCode]);

  // Announce error to screen readers
  useEffect(() => {
    const announcement = customMessage || 'Ocorreu um erro. Por favor, tente novamente.';
    const ariaLive = document.createElement('div');
    ariaLive.setAttribute('role', 'alert');
    ariaLive.setAttribute('aria-live', 'assertive');
    ariaLive.style.position = 'absolute';
    ariaLive.style.width = '1px';
    ariaLive.style.height = '1px';
    ariaLive.style.padding = '0';
    ariaLive.style.margin = '-1px';
    ariaLive.style.overflow = 'hidden';
    ariaLive.style.clip = 'rect(0, 0, 0, 0)';
    ariaLive.style.whiteSpace = 'nowrap';
    ariaLive.style.border = '0';
    ariaLive.textContent = announcement;
    document.body.appendChild(ariaLive);

    return () => {
      document.body.removeChild(ariaLive);
    };
  }, [customMessage]);

  const handleRetry = () => {
    logError(error, `${errorCode}_RETRY`, {
      retryTimestamp: new Date().toISOString(),
    });
    reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background dark:bg-dark-background">
      <Card 
        elevation="md"
        className="max-w-lg w-full text-center"
      >
        <div className="flex flex-col items-center gap-6 p-8">
          <ErrorIcon 
            sx={{ 
              fontSize: 48, 
              color: COLORS.semantic.error 
            }} 
            aria-hidden="true"
          />
          
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {customMessage || 'Ocorreu um erro inesperado'}
            </h1>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Por favor, tente novamente. Se o problema persistir, entre em contato com o suporte.
            </p>
            
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded-md text-left text-xs overflow-auto">
                <code>{error.message}</code>
                {error.stack && (
                  <code className="block mt-2 text-gray-600 dark:text-gray-400">
                    {error.stack}
                  </code>
                )}
              </pre>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              variant="primary"
              onClick={handleRetry}
              ariaLabel="Tentar novamente"
            >
              Tentar novamente
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              ariaLabel="Voltar para a página inicial"
            >
              Página inicial
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Error;