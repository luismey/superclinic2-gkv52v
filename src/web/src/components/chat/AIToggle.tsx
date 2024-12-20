import React, { useState, useCallback, useMemo, memo } from 'react';
import * as Switch from '@radix-ui/react-switch'; // ^1.0.0
import * as Tooltip from '@radix-ui/react-tooltip'; // ^1.0.0
import { Spinner } from '@radix-ui/react-spinner'; // ^1.0.0
import { useDebounce } from 'use-debounce'; // ^9.0.0
import cn from 'classnames'; // ^2.3.0

import { useChat } from '../../hooks/useChat';
import { useToast } from '../../hooks/useToast';

// Constants for debouncing and timeout
const TOGGLE_DEBOUNCE_MS = 300;
const TOGGLE_TIMEOUT_MS = 5000;
const MAX_RETRIES = 3;

interface AIToggleProps {
  className?: string;
  disabled?: boolean;
  onError?: (error: Error) => void;
}

/**
 * AIToggle component for enabling/disabling AI virtual assistant in chat conversations
 * Implements WCAG 2.1 Level AA accessibility standards
 */
export const AIToggle = memo(({ 
  className,
  disabled = false,
  onError
}: AIToggleProps) => {
  // State management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Hooks
  const { chat, toggleAI, isAIEnabled } = useChat();
  const { showToast } = useToast();

  // Debounced toggle handler to prevent rapid state changes
  const [debouncedToggle] = useDebounce(
    async (checked: boolean) => {
      if (!chat?.id || loading) return;

      try {
        setLoading(true);
        setError(null);
        
        await toggleAI();

        showToast({
          type: 'success',
          message: checked ? 
            'Assistente virtual ativado' : 
            'Assistente virtual desativado',
          duration: 3000
        });

        setRetryCount(0);
      } catch (err) {
        const error = err as Error;
        setError(error.message);
        onError?.(error);

        if (retryCount < MAX_RETRIES) {
          setRetryCount(prev => prev + 1);
          // Retry after delay
          setTimeout(() => debouncedToggle(checked), 1000 * (retryCount + 1));
        } else {
          showToast({
            type: 'error',
            message: 'Erro ao alterar assistente virtual',
            duration: 5000
          });
        }
      } finally {
        setLoading(false);
      }
    },
    TOGGLE_DEBOUNCE_MS
  );

  // Memoized tooltip content
  const tooltipContent = useMemo(() => {
    if (error) return error;
    if (loading) return 'Alterando configuração...';
    return isAIEnabled ? 'Desativar assistente virtual' : 'Ativar assistente virtual';
  }, [error, loading, isAIEnabled]);

  // Handle toggle change
  const handleToggleChange = useCallback((checked: boolean) => {
    debouncedToggle(checked);
  }, [debouncedToggle]);

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <div className={cn(
            'flex items-center gap-2 px-2 py-1',
            'rounded-md transition-colors',
            {
              'opacity-50 cursor-not-allowed': disabled || !chat,
              'cursor-pointer': !disabled && chat
            },
            className
          )}>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              AI Assistant
            </span>

            <Switch.Root
              checked={isAIEnabled}
              onCheckedChange={handleToggleChange}
              disabled={disabled || !chat || loading}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-offset-2',
                'focus:ring-blue-500 dark:focus:ring-blue-400',
                {
                  'bg-blue-600 dark:bg-blue-500': isAIEnabled,
                  'bg-gray-200 dark:bg-gray-700': !isAIEnabled
                }
              )}
              aria-label="Toggle AI Assistant"
            >
              <Switch.Thumb
                className={cn(
                  'block w-4 h-4 rounded-full bg-white transition-transform',
                  'transform translate-x-1',
                  { 'translate-x-6': isAIEnabled }
                )}
              >
                {loading && (
                  <Spinner
                    className="w-3 h-3 text-blue-600 dark:text-blue-400"
                    aria-label="Alterando configuração"
                  />
                )}
              </Switch.Thumb>
            </Switch.Root>
          </div>
        </Tooltip.Trigger>

        <Tooltip.Portal>
          <Tooltip.Content
            className={cn(
              'px-3 py-2 text-sm rounded-md shadow-lg',
              'bg-white dark:bg-gray-800',
              'text-gray-900 dark:text-gray-100',
              'border border-gray-200 dark:border-gray-700',
              { 'text-red-500': error }
            )}
            side="top"
            align="center"
            sideOffset={5}
          >
            {tooltipContent}
            <Tooltip.Arrow 
              className="fill-current text-gray-200 dark:text-gray-700" 
            />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
});

AIToggle.displayName = 'AIToggle';

export default AIToggle;