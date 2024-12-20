import React, { useState, useEffect, useCallback } from 'react';
import { z } from 'zod'; // v3.22.0
import Input from '../common/Input';
import Button from '../common/Button';
import Card from '../common/Card';
import { WhatsAppConfig } from '../../types/settings';
import { settingsService } from '../../services/settings';
import { useToast, ToastType } from '../../hooks/useToast';
import { COLORS, SPACING } from '../../constants/ui';

// Brazilian phone number validation schema
const phoneSchema = z.string()
  .regex(/^\+55\d{10,11}$/, 'Formato inválido. Use: +55XXXXXXXXXXX');

// WhatsApp config validation schema
const whatsAppConfigSchema = z.object({
  phone_number: phoneSchema,
  business_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  business_description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres'),
  webhook_url: z.string().url('URL inválida'),
});

interface WhatsAppConfigState extends Omit<WhatsAppConfig, 'message_queue_settings'> {
  loading: boolean;
  isVerifying: boolean;
  errors: Record<string, string>;
}

export const WhatsAppConfig: React.FC = () => {
  // State management
  const [config, setConfig] = useState<WhatsAppConfigState>({
    phone_number: '',
    business_name: '',
    business_description: '',
    is_verified: false,
    webhook_url: '',
    loading: true,
    isVerifying: false,
    errors: {},
  });

  const { showToast } = useToast();

  // Fetch initial configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await settingsService.getWhatsAppConfig();
        setConfig(prev => ({
          ...prev,
          ...response,
          loading: false,
        }));
      } catch (error) {
        showToast({
          message: 'Erro ao carregar configurações do WhatsApp',
          type: ToastType.ERROR,
        });
        setConfig(prev => ({ ...prev, loading: false }));
      }
    };

    fetchConfig();
  }, [showToast]);

  // Handle input changes with validation
  const handleChange = useCallback((field: keyof WhatsAppConfig) => (value: string) => {
    setConfig(prev => ({
      ...prev,
      [field]: value,
      errors: {
        ...prev.errors,
        [field]: '',
      },
    }));
  }, []);

  // Validate single field
  const validateField = useCallback((field: keyof WhatsAppConfig, value: string) => {
    try {
      const schema = whatsAppConfigSchema.shape[field];
      schema.parse(value);
      return '';
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error.errors[0].message;
      }
      return 'Erro de validação';
    }
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const errors: Record<string, string> = {};
    let hasErrors = false;

    Object.keys(whatsAppConfigSchema.shape).forEach((field) => {
      const error = validateField(field as keyof WhatsAppConfig, config[field as keyof WhatsAppConfig]);
      if (error) {
        errors[field] = error;
        hasErrors = true;
      }
    });

    if (hasErrors) {
      setConfig(prev => ({ ...prev, errors }));
      return;
    }

    // Submit configuration
    try {
      setConfig(prev => ({ ...prev, loading: true }));
      
      const updatedConfig = await settingsService.updateWhatsAppConfig({
        phone_number: config.phone_number,
        business_name: config.business_name,
        business_description: config.business_description,
        webhook_url: config.webhook_url,
      });

      setConfig(prev => ({
        ...prev,
        ...updatedConfig,
        loading: false,
      }));

      showToast({
        message: 'Configurações atualizadas com sucesso',
        type: ToastType.SUCCESS,
      });
    } catch (error) {
      showToast({
        message: 'Erro ao atualizar configurações',
        type: ToastType.ERROR,
      });
      setConfig(prev => ({ ...prev, loading: false }));
    }
  };

  // Handle WhatsApp verification
  const handleVerification = async () => {
    try {
      setConfig(prev => ({ ...prev, isVerifying: true }));
      
      await settingsService.verifyWhatsAppNumber(config.phone_number);
      
      setConfig(prev => ({
        ...prev,
        is_verified: true,
        isVerifying: false,
      }));

      showToast({
        message: 'Número do WhatsApp verificado com sucesso',
        type: ToastType.SUCCESS,
      });
    } catch (error) {
      showToast({
        message: 'Erro ao verificar número do WhatsApp',
        type: ToastType.ERROR,
      });
      setConfig(prev => ({ ...prev, isVerifying: false }));
    }
  };

  if (config.loading) {
    return (
      <Card className="animate-pulse">
        <div className="h-96 bg-gray-100 rounded-lg" />
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-6">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Configurações do WhatsApp Business
        </h2>

        <div className="space-y-4">
          <Input
            id="phone_number"
            name="phone_number"
            label="Número do WhatsApp"
            value={config.phone_number}
            onChange={handleChange('phone_number')}
            error={config.errors.phone_number}
            placeholder="+5511999999999"
            type="tel"
            required
            aria-describedby="phone-hint"
          />
          <div id="phone-hint" className="text-sm text-gray-500">
            Use o formato internacional: +55 + DDD + número
          </div>

          {!config.is_verified && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleVerification}
              loading={config.isVerifying}
              disabled={!config.phone_number || !!config.errors.phone_number}
              aria-label="Verificar número do WhatsApp"
            >
              Verificar Número
            </Button>
          )}

          <Input
            id="business_name"
            name="business_name"
            label="Nome da Empresa"
            value={config.business_name}
            onChange={handleChange('business_name')}
            error={config.errors.business_name}
            required
          />

          <Input
            id="business_description"
            name="business_description"
            label="Descrição da Empresa"
            value={config.business_description}
            onChange={handleChange('business_description')}
            error={config.errors.business_description}
          />

          <Input
            id="webhook_url"
            name="webhook_url"
            label="URL do Webhook"
            value={config.webhook_url}
            onChange={handleChange('webhook_url')}
            error={config.errors.webhook_url}
            placeholder="https://sua-api.com/webhook"
            required
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Button
            type="submit"
            disabled={config.loading || Object.keys(config.errors).length > 0}
            loading={config.loading}
          >
            Salvar Alterações
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default WhatsAppConfig;