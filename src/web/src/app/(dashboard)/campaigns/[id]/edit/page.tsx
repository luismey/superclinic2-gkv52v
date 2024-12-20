'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation'; // ^13.0.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

import CampaignForm from '../../components/campaigns/CampaignForm';
import { useCampaign } from '../../../hooks/useCampaign';
import Loading from '../../../components/common/Loading';
import useToast from '../../../hooks/useToast';
import useAnalytics from '../../../hooks/useAnalytics';
import { Campaign } from '../../../types/campaigns';

/**
 * Campaign edit page component with healthcare compliance validation
 */
const CampaignEditPage: React.FC = () => {
  // Hooks initialization
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const analytics = useAnalytics({
    metric_types: ['campaign_performance'],
    date_range: { start: new Date(), end: new Date(), granularity: 'day' },
    user_segments: [],
    channels: [],
    filters: {}
  });

  // Campaign management hook with compliance validation
  const {
    campaign,
    loading,
    error,
    fetchCampaignById,
    updateCampaign,
    validateCompliance,
    checkLGPDConsent
  } = useCampaign(params.id as string);

  // Fetch campaign data on mount
  useEffect(() => {
    if (params.id) {
      fetchCampaignById(params.id as string);
    }
  }, [params.id, fetchCampaignById]);

  /**
   * Handles form submission with compliance validation
   * @param updatedCampaign - Updated campaign data
   */
  const handleSubmit = async (updatedCampaign: Campaign) => {
    try {
      // Validate healthcare compliance
      const compliance = await validateCompliance(updatedCampaign);
      if (!compliance.isCompliant) {
        showToast({
          type: 'error',
          message: `Erro de conformidade: ${compliance.violations.join(', ')}`,
          duration: 5000
        });
        return;
      }

      // Check LGPD consent requirements
      const consentStatus = await checkLGPDConsent(updatedCampaign);
      if (!consentStatus.hasConsent) {
        showToast({
          type: 'error',
          message: 'Requisitos de consentimento LGPD não atendidos',
          duration: 5000
        });
        return;
      }

      // Update campaign
      await updateCampaign(params.id as string, updatedCampaign);

      // Track successful update
      analytics.showToast({
        type: 'success',
        message: 'Campanha atualizada com sucesso',
        duration: 3000
      });

      // Navigate back to campaign list
      router.push('/campaigns');

    } catch (error) {
      showToast({
        type: 'error',
        message: `Erro ao atualizar campanha: ${error.message}`,
        duration: 5000
      });
    }
  };

  /**
   * Handles cancellation of campaign editing
   */
  const handleCancel = () => {
    analytics.trackEvent('campaign_edit_cancelled', {
      campaignId: params.id
    });
    router.push('/campaigns');
  };

  /**
   * Handles and logs component errors
   * @param error - Error object
   */
  const handleError = (error: Error) => {
    console.error('Campaign edit error:', error);
    analytics.trackError('campaign_edit_error', {
      error: error.message,
      campaignId: params.id
    });
    showToast({
      type: 'error',
      message: 'Erro ao carregar campanha. Por favor, tente novamente.',
      duration: 5000
    });
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loading 
          size="lg"
          text="Carregando campanha..."
          className="text-primary"
        />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <p className="text-lg font-medium text-error">
          {error}
        </p>
        <button
          onClick={() => router.push('/campaigns')}
          className="rounded-md bg-primary px-4 py-2 text-white hover:bg-primary-dark"
        >
          Voltar para campanhas
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary
      FallbackComponent={({ error }) => (
        <div className="p-4 text-error">
          {error.message}
        </div>
      )}
      onError={handleError}
    >
      <div className="container mx-auto px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          Editar Campanha
        </h1>

        {campaign && (
          <CampaignForm
            campaign={campaign}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={loading}
            healthcareCategory={campaign.healthcareCategory}
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default CampaignEditPage;