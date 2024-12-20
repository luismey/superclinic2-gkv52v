'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CampaignForm from '@/components/campaigns/CampaignForm';
import { useCampaign } from '@/hooks/useCampaign';
import { useToast } from '@/hooks/useToast';
import { Campaign, CampaignStatus, CampaignType, TargetAudienceType } from '@/types/campaigns';

/**
 * New Campaign Page Component
 * Provides interface for creating healthcare-compliant WhatsApp marketing campaigns
 */
const NewCampaignPage: React.FC = () => {
  const router = useRouter();
  const { createCampaign, validateCompliance } = useCampaign();
  const { showToast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Default healthcare category based on user's profile
  const [healthcareCategory, setHealthcareCategory] = useState('general');

  /**
   * Handles campaign form submission with healthcare compliance validation
   * @param campaignData - Form data for new campaign
   */
  const handleSubmit = useCallback(async (campaignData: Omit<Campaign, 'id'>) => {
    try {
      setIsSubmitting(true);

      // Validate healthcare compliance
      const compliance = await validateCompliance(campaignData as Campaign);
      if (!compliance.isCompliant) {
        showToast({
          type: 'error',
          message: `Violação de conformidade na área de saúde: ${compliance.violations.join(', ')}`,
          duration: 6000,
        });
        return;
      }

      // Ensure LGPD consent requirements
      if (!campaignData.consentTracking.consentRequired) {
        showToast({
          type: 'error',
          message: 'Consentimento LGPD é obrigatório para campanhas na área de saúde',
          duration: 5000,
        });
        return;
      }

      // Create campaign with enhanced data
      const enhancedData = {
        ...campaignData,
        status: CampaignStatus.DRAFT,
        type: campaignData.type || CampaignType.ONE_TIME,
        target_audience: campaignData.target_audience || TargetAudienceType.NEW_LEADS,
        healthcareCategory,
        template: {
          ...campaignData.template,
          language: 'pt-BR',
          lgpdCompliant: true,
          medicalDisclaimer: campaignData.template.medicalDisclaimer || 
            'Esta mensagem não substitui consulta médica presencial.',
        },
        schedule: {
          ...campaignData.schedule,
          timezone: 'America/Sao_Paulo',
          businessHoursOnly: true,
          respectLocalHolidays: true,
        },
        consentTracking: {
          ...campaignData.consentTracking,
          consentRequired: true,
          consentMessage: campaignData.consentTracking.consentMessage || 
            'Ao prosseguir, você concorda com nossa política de privacidade e uso de dados.',
          consentExpiryDays: 180,
        },
      };

      await createCampaign(enhancedData);

      showToast({
        type: 'success',
        message: 'Campanha criada com sucesso!',
        duration: 4000,
      });

      // Navigate to campaigns list
      router.push('/campaigns');

    } catch (error) {
      console.error('Campaign creation error:', error);
      showToast({
        type: 'error',
        message: `Erro ao criar campanha: ${error.message}`,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [createCampaign, validateCompliance, showToast, router, healthcareCategory]);

  /**
   * Handles campaign creation cancellation
   */
  const handleCancel = useCallback(() => {
    router.push('/campaigns');
  }, [router]);

  // Load healthcare category from user profile
  useEffect(() => {
    // TODO: Load healthcare category from user profile
    setHealthcareCategory('general');
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="md:flex md:items-center md:justify-between mb-8">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
            Nova Campanha
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure uma nova campanha de WhatsApp com conformidade para área de saúde
          </p>
        </div>
      </div>

      {/* Healthcare compliance alert */}
      <div className="rounded-md bg-blue-50 p-4 mb-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3 flex-1 md:flex md:justify-between">
            <p className="text-sm text-blue-700">
              Todas as campanhas devem estar em conformidade com as regulamentações de saúde e LGPD
            </p>
          </div>
        </div>
      </div>

      <CampaignForm
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        isLoading={isSubmitting}
        healthcareCategory={healthcareCategory}
      />
    </div>
  );
};

export default NewCampaignPage;