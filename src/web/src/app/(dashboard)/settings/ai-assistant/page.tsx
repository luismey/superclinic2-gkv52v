'use client';

import React, { useCallback } from 'react';
import { Metadata } from 'next';
import { useAutoSave } from 'react-use-autosave'; // v3.0.0

import AIAssistantConfig from '@/components/settings/AIAssistantConfig';
import { useToast } from '@/hooks/useToast';
import { useAnalytics } from '@/hooks/useAnalytics';
import { settingsService } from '@/services/settings';
import { AIAssistantConfig as AIAssistantConfigType } from '@/types/settings';
import { COLORS, SPACING } from '@/constants/ui';

// Page metadata with Brazilian Portuguese SEO
export const metadata: Metadata = {
  title: 'Configuração do Assistente Virtual | Porfin',
  description: 'Configure seu assistente virtual para otimizar a comunicação com pacientes e melhorar a conversão de leads na sua clínica.',
  openGraph: {
    title: 'Configuração do Assistente Virtual | Porfin',
    description: 'Otimize a comunicação com pacientes através do assistente virtual inteligente.',
    locale: 'pt_BR',
  },
};

/**
 * AI Assistant Settings Page Component
 * Provides interface for configuring AI virtual assistant behavior and knowledge base
 * with LGPD compliance and Brazilian healthcare context
 */
const AIAssistantPage: React.FC = () => {
  // Hooks for toast notifications and analytics
  const { showToast } = useToast();
  const { trackEvent } = useAnalytics({
    metric_types: ['ai_usage'],
    date_range: {
      start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end_date: new Date(),
      granularity: 'day'
    },
    user_segments: [],
    channels: [],
    filters: {}
  });

  /**
   * Handles successful configuration updates
   * @param configData - Updated AI assistant configuration
   */
  const handleSuccess = useCallback(async (configData: AIAssistantConfigType) => {
    try {
      // Track configuration update in analytics
      await trackEvent('ai_assistant_config_update', {
        config_type: configData.role,
        is_active: configData.is_active,
        knowledge_bases: configData.knowledge_base_ids.length
      });

      // Show success notification in Portuguese
      showToast({
        message: 'Configurações do assistente virtual atualizadas com sucesso',
        type: 'success',
        duration: 5000
      });
    } catch (error) {
      console.error('Failed to track configuration update:', error);
    }
  }, [trackEvent, showToast]);

  /**
   * Handles configuration update errors
   * @param error - Error object from failed update
   */
  const handleError = useCallback(async (error: Error) => {
    // Track error in analytics
    await trackEvent('ai_assistant_config_error', {
      error_type: error.name,
      error_message: error.message
    });

    // Show error notification in Portuguese
    showToast({
      message: 'Erro ao atualizar configurações do assistente virtual. Tente novamente.',
      type: 'error',
      duration: 7000,
      ariaLive: 'assertive'
    });
  }, [trackEvent, showToast]);

  /**
   * Handles validation errors
   * @param errors - Validation error details
   */
  const handleValidationError = useCallback((errors: any) => {
    showToast({
      message: 'Por favor, corrija os erros de validação antes de salvar.',
      type: 'warning',
      duration: 5000
    });
  }, [showToast]);

  return (
    <main className="max-w-4xl mx-auto py-6 space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Configuração do Assistente Virtual
        </h1>
        <p className="text-muted-foreground">
          Configure o comportamento e a base de conhecimento do seu assistente virtual 
          para otimizar o atendimento aos pacientes.
        </p>
      </div>

      {/* Configuration Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 shadow-sm">
        <AIAssistantConfig
          onSuccess={handleSuccess}
          onError={handleError}
          onValidationError={handleValidationError}
        />
      </div>

      {/* LGPD Compliance Notice */}
      <div className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h2 className="font-medium mb-2">Conformidade com a LGPD</h2>
        <p>
          O assistente virtual processa dados pessoais em conformidade com a Lei Geral 
          de Proteção de Dados (LGPD). Todas as interações são criptografadas e os dados 
          são armazenados de forma segura em território brasileiro.
        </p>
      </div>
    </main>
  );
};

export default AIAssistantPage;