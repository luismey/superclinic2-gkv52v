// @ts-check
import React, { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form'; // v7.45.0
import { z } from 'zod'; // v3.22.0
import { useTranslation } from 'react-i18next'; // v13.0.0
import Input from '../common/Input';
import Select from '../common/Select';
import { settingsService } from '../../services/settings';
import { COLORS, SPACING, TYPE_SCALE } from '../../constants/ui';

// Validation schema with Brazilian Portuguese messages
const aiAssistantValidationSchema = z.object({
  name: z.string()
    .min(3, 'O nome deve ter pelo menos 3 caracteres')
    .max(50, 'O nome deve ter no máximo 50 caracteres'),
  role: z.enum(['sales', 'support', 'scheduling', 'billing'], {
    errorMap: () => ({ message: 'Selecione uma função válida' })
  }),
  knowledge_base_ids: z.array(z.string().uuid())
    .min(1, 'Selecione pelo menos uma base de conhecimento'),
  response_template: z.string()
    .min(10, 'O template deve ter pelo menos 10 caracteres'),
  is_active: z.boolean(),
  language_settings: z.object({
    primary_language: z.literal('pt-BR'),
    translation_enabled: z.boolean(),
    custom_vocabulary: z.record(z.string())
  }),
  healthcare_compliance: z.boolean(),
  sensitive_data_handling: z.array(z.string())
});

// Component props interface
interface AIAssistantConfigProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onValidationError?: (errors: z.ZodError) => void;
  initialData?: Partial<AIAssistantConfigFormData>;
}

// Form data interface
interface AIAssistantConfigFormData {
  name: string;
  role: 'sales' | 'support' | 'scheduling' | 'billing';
  knowledge_base_ids: string[];
  response_template: string;
  is_active: boolean;
  language_settings: {
    primary_language: 'pt-BR';
    translation_enabled: boolean;
    custom_vocabulary: Record<string, string>;
  };
  healthcare_compliance: boolean;
  sensitive_data_handling: string[];
}

// Role options for select component
const ROLE_OPTIONS = [
  { value: 'sales', label: 'Vendas' },
  { value: 'support', label: 'Suporte' },
  { value: 'scheduling', label: 'Agendamento' },
  { value: 'billing', label: 'Faturamento' }
];

/**
 * AI Assistant Configuration Component
 * Provides interface for healthcare professionals to configure AI assistants
 */
export const AIAssistantConfig: React.FC<AIAssistantConfigProps> = ({
  onSuccess,
  onError,
  onValidationError,
  initialData
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([]);

  // Form initialization with validation
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
    reset
  } = useForm<AIAssistantConfigFormData>({
    defaultValues: {
      name: '',
      role: 'support',
      knowledge_base_ids: [],
      response_template: '',
      is_active: true,
      language_settings: {
        primary_language: 'pt-BR',
        translation_enabled: true,
        custom_vocabulary: {}
      },
      healthcare_compliance: true,
      sensitive_data_handling: [],
      ...initialData
    }
  });

  // Load initial data and knowledge bases
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const config = await settingsService.getAIAssistantConfig();
        reset(config);
        // Load knowledge bases (implementation depends on API)
        // setKnowledgeBases(await loadKnowledgeBases());
      } catch (error) {
        onError?.(error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [reset, onError]);

  // Form submission handler
  const onSubmit = useCallback(async (data: AIAssistantConfigFormData) => {
    try {
      setIsLoading(true);
      
      // Validate data
      const validatedData = aiAssistantValidationSchema.parse(data);
      
      // Update configuration
      await settingsService.updateAIAssistantConfig(validatedData);
      
      onSuccess?.();
    } catch (error) {
      if (error instanceof z.ZodError) {
        onValidationError?.(error);
      } else {
        onError?.(error as Error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError, onValidationError]);

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-w-2xl"
      aria-label={t('settings.aiAssistant.formLabel')}
    >
      {/* Name Input */}
      <Controller
        name="name"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Input
            id="assistant-name"
            label={t('settings.aiAssistant.nameLabel')}
            error={errors.name?.message}
            required
            {...field}
          />
        )}
      />

      {/* Role Selection */}
      <Controller
        name="role"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Select
            id="assistant-role"
            label={t('settings.aiAssistant.roleLabel')}
            options={ROLE_OPTIONS}
            error={errors.role?.message}
            required
            {...field}
          />
        )}
      />

      {/* Knowledge Base Selection */}
      <Controller
        name="knowledge_base_ids"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Select
            id="knowledge-bases"
            label={t('settings.aiAssistant.knowledgeBasesLabel')}
            options={knowledgeBases.map(kb => ({
              value: kb.id,
              label: kb.name
            }))}
            error={errors.knowledge_base_ids?.message}
            required
            multiple
            {...field}
          />
        )}
      />

      {/* Response Template */}
      <Controller
        name="response_template"
        control={control}
        rules={{ required: true }}
        render={({ field }) => (
          <Input
            id="response-template"
            label={t('settings.aiAssistant.templateLabel')}
            error={errors.response_template?.message}
            required
            multiline
            rows={4}
            {...field}
          />
        )}
      />

      {/* Active Status Toggle */}
      <Controller
        name="is_active"
        control={control}
        render={({ field: { value, onChange } }) => (
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="is-active"
              checked={value}
              onChange={e => onChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="is-active" className="text-sm font-medium text-gray-700">
              {t('settings.aiAssistant.activeLabel')}
            </label>
          </div>
        )}
      />

      {/* Submit Button */}
      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isLoading || !isDirty}
          className={`
            px-4 py-2 rounded-md text-white font-medium
            ${isLoading || !isDirty
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-primary-600 hover:bg-primary-700'}
            transition-colors duration-200
          `}
        >
          {isLoading
            ? t('common.saving')
            : t('common.save')}
        </button>
      </div>
    </form>
  );
};

export default AIAssistantConfig;