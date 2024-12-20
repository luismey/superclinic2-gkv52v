import React, { useState, useEffect, useCallback } from 'react'; // v18.0.0
import { useForm } from 'react-hook-form'; // v7.0.0
import { z } from 'zod'; // v3.0.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import {
  Campaign,
  CampaignType,
  CampaignStatus,
  TargetAudienceType,
  MessageTemplate,
  CampaignSchedule,
  ConsentTracking,
} from '../../types/campaigns';

// Zod validation schema for healthcare-compliant campaigns
const campaignSchema = z.object({
  name: z.string()
    .min(3, 'Nome da campanha deve ter no mínimo 3 caracteres')
    .max(100, 'Nome da campanha deve ter no máximo 100 caracteres'),
  description: z.string()
    .max(500, 'Descrição deve ter no máximo 500 caracteres')
    .optional(),
  type: z.nativeEnum(CampaignType),
  target_audience: z.nativeEnum(TargetAudienceType),
  healthcareCategory: z.string(),
  template: z.object({
    content: z.string()
      .min(10, 'Conteúdo da mensagem é obrigatório')
      .max(2000, 'Conteúdo deve ter no máximo 2000 caracteres'),
    medicalDisclaimer: z.string()
      .min(1, 'Disclaimer médico é obrigatório'),
    lgpdCompliant: z.boolean(),
    consentRequired: z.boolean(),
  }),
  schedule: z.object({
    start_date: z.date(),
    end_date: z.date().nullable(),
    time_slots: z.array(z.string()),
    timezone: z.string().default('America/Sao_Paulo'),
    businessHoursOnly: z.boolean(),
  }),
  consentTracking: z.object({
    consentRequired: z.boolean(),
    consentMessage: z.string(),
    consentExpiryDays: z.number().min(1).max(365),
  }),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

interface CampaignFormProps {
  campaign?: Campaign;
  onSubmit: (campaign: Campaign) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  healthcareCategory: string;
}

export const CampaignForm: React.FC<CampaignFormProps> = ({
  campaign,
  onSubmit,
  onCancel,
  isLoading,
  healthcareCategory,
}) => {
  const { t } = useTranslation('campaigns');
  const [showLgpdWarning, setShowLgpdWarning] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    control,
  } = useForm<CampaignFormData>({
    resolver: async (data) => {
      try {
        await campaignSchema.parseAsync(data);
        return { values: data, errors: {} };
      } catch (error) {
        return { values: {}, errors: error.formErrors?.fieldErrors || {} };
      }
    },
    defaultValues: campaign ? {
      name: campaign.name,
      description: campaign.description,
      type: campaign.type,
      target_audience: campaign.target_audience,
      healthcareCategory: campaign.healthcareCategory,
      template: campaign.template,
      schedule: campaign.schedule,
      consentTracking: campaign.consentTracking,
    } : {
      type: CampaignType.ONE_TIME,
      target_audience: TargetAudienceType.NEW_LEADS,
      healthcareCategory,
      template: {
        lgpdCompliant: true,
        consentRequired: true,
      },
      schedule: {
        timezone: 'America/Sao_Paulo',
        businessHoursOnly: true,
      },
      consentTracking: {
        consentRequired: true,
        consentExpiryDays: 180,
      },
    },
  });

  const validateHealthcareContent = useCallback(async (content: string) => {
    // Healthcare-specific content validation
    const prohibitedTerms = [
      'cura garantida',
      'tratamento milagroso',
      'resultados imediatos',
    ];

    const hasProhibitedTerms = prohibitedTerms.some(term => 
      content.toLowerCase().includes(term)
    );

    if (hasProhibitedTerms) {
      return 'Conteúdo contém termos proibidos para comunicação em saúde';
    }

    return null;
  }, []);

  const onFormSubmit = async (data: CampaignFormData) => {
    try {
      // Validate healthcare content
      const contentError = await validateHealthcareContent(data.template.content);
      if (contentError) {
        setValue('template.content', data.template.content, {
          error: contentError,
        });
        return;
      }

      // Transform form data to Campaign model
      const campaignData: Campaign = {
        ...data,
        id: campaign?.id || '',
        status: campaign?.status || CampaignStatus.DRAFT,
        created_at: campaign?.created_at || new Date(),
        updated_at: new Date(),
        metrics: campaign?.metrics || {
          total_recipients: 0,
          messages_sent: 0,
          messages_delivered: 0,
          messages_read: 0,
          responses_received: 0,
          conversion_rate: 0,
          appointment_bookings: 0,
          consent_rates: 0,
        },
      };

      await onSubmit(campaignData);
    } catch (error) {
      console.error('Campaign submission error:', error);
      // Handle error with accessibility announcement
      const errorMessage = 'Erro ao salvar campanha. Por favor, tente novamente.';
      announce(errorMessage);
    }
  };

  // Accessibility announcement utility
  const announce = (message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  // Watch for LGPD-related changes
  const watchConsentRequired = watch('consentTracking.consentRequired');
  useEffect(() => {
    setShowLgpdWarning(!watchConsentRequired);
  }, [watchConsentRequired]);

  return (
    <form 
      onSubmit={handleSubmit(onFormSubmit)}
      className="space-y-8 divide-y divide-gray-200"
      aria-label="Formulário de campanha"
    >
      {/* Basic Information Section */}
      <div className="space-y-6 pt-8">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            {t('campaign.form.basicInfo')}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {t('campaign.form.basicInfoDesc')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
          <div className="sm:col-span-4">
            <label 
              htmlFor="name"
              className="block text-sm font-medium text-gray-700"
            >
              {t('campaign.form.name')}
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="name"
                {...register('name')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && (
                <p className="mt-2 text-sm text-red-600" id="name-error">
                  {errors.name.message}
                </p>
              )}
            </div>
          </div>

          {/* Campaign Type Selection */}
          <div className="sm:col-span-3">
            <label 
              htmlFor="type"
              className="block text-sm font-medium text-gray-700"
            >
              {t('campaign.form.type')}
            </label>
            <div className="mt-1">
              <select
                id="type"
                {...register('type')}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                {Object.values(CampaignType).map((type) => (
                  <option key={type} value={type}>
                    {t(`campaign.types.${type}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* LGPD Compliance Section */}
      <div className="pt-8">
        <div className="rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {t('campaign.form.lgpdCompliance')}
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>{t('campaign.form.lgpdDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="consentRequired"
                type="checkbox"
                {...register('consentTracking.consentRequired')}
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label 
                htmlFor="consentRequired"
                className="font-medium text-gray-700"
              >
                {t('campaign.form.requireConsent')}
              </label>
              <p className="text-gray-500">
                {t('campaign.form.consentDescription')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="pt-5">
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-gray-300 bg-white py-2 px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            disabled={isLoading}
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            disabled={isLoading}
          >
            {isLoading ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>
    </form>
  );
};

export default CampaignForm;