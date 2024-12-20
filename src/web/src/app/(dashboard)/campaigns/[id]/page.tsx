'use client';

import React, { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation'; // ^13.0.0
import { useTranslation } from 'react-i18next'; // ^12.0.0

import CampaignForm from '@/components/campaigns/CampaignForm';
import { useCampaign } from '@/hooks/useCampaign';
import { Campaign } from '@/types/campaigns';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

/**
 * Healthcare campaign details page component
 * Implements LGPD compliance and real-time updates
 */
const CampaignPage: React.FC = () => {
  const { t } = useTranslation('campaigns');
  const router = useRouter();
  const { id } = useParams();

  // Initialize campaign hook with healthcare context
  const {
    campaign,
    loading,
    error,
    fetchCampaignById,
    updateCampaign,
    complianceStatus,
    lgpdStatus,
  } = useCampaign(id as string);

  // Fetch campaign data on mount
  useEffect(() => {
    if (id) {
      fetchCampaignById(id as string);
    }
  }, [id, fetchCampaignById]);

  /**
   * Handles campaign form submission with healthcare validation
   * @param updatedCampaign - Updated campaign data
   */
  const handleSubmit = useCallback(async (updatedCampaign: Campaign) => {
    try {
      // Validate healthcare compliance
      if (!complianceStatus?.isCompliant) {
        throw new Error(t('errors.compliance', {
          violations: complianceStatus?.violations.join(', ')
        }));
      }

      // Check LGPD consent requirements
      if (!lgpdStatus?.hasConsent) {
        throw new Error(t('errors.lgpdConsent'));
      }

      // Update campaign
      await updateCampaign(id as string, updatedCampaign);

      // Show success notification
      router.push('/campaigns');
    } catch (error) {
      console.error('Campaign update failed:', error);
      throw error;
    }
  }, [id, updateCampaign, complianceStatus, lgpdStatus, t, router]);

  /**
   * Handles form cancellation
   */
  const handleCancel = useCallback(() => {
    router.push('/campaigns');
  }, [router]);

  // Handle loading state
  if (loading) {
    return (
      <div className="container" role="status" aria-live="polite">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-pulse text-gray-600 dark:text-gray-300">
            {t('common.loading')}
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div 
        className="container error" 
        role="alert" 
        aria-live="assertive"
      >
        <div className="bg-red-50 dark:bg-red-900 p-4 rounded-md">
          <h3 className="text-red-800 dark:text-red-200 font-medium">
            {t('errors.loadFailed')}
          </h3>
          <p className="text-red-700 dark:text-red-300 mt-2 text-sm">
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="container">
        {/* Page header */}
        <div className="header">
          <h1 className="title">
            {campaign ? t('edit.title') : t('create.title')}
          </h1>
          <p className="description">
            {campaign ? t('edit.description') : t('create.description')}
          </p>
        </div>

        {/* Healthcare compliance warnings */}
        {complianceStatus && !complianceStatus.isCompliant && (
          <div 
            className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-md mb-6"
            role="alert"
          >
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">
              {t('compliance.warning')}
            </h3>
            <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
              {complianceStatus.violations.map((violation, index) => (
                <li key={index}>{violation}</li>
              ))}
            </ul>
          </div>
        )}

        {/* LGPD consent status */}
        {lgpdStatus && !lgpdStatus.hasConsent && (
          <div 
            className="bg-orange-50 dark:bg-orange-900 p-4 rounded-md mb-6"
            role="alert"
          >
            <h3 className="text-orange-800 dark:text-orange-200 font-medium">
              {t('lgpd.warning')}
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-2">
              {t('lgpd.consentRequired')}
            </p>
          </div>
        )}

        {/* Campaign form */}
        <CampaignForm
          campaign={campaign}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={loading}
          healthcareCategory={campaign?.healthcareCategory || ''}
        />
      </div>
    </ErrorBoundary>
  );
};

// Styles
const styles = {
  container: 'max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 print:px-0',
  header: 'px-4 sm:px-0 mb-6 flex justify-between items-center',
  title: 'text-2xl font-bold text-gray-900 dark:text-gray-100',
  description: 'mt-1 text-sm text-gray-600 dark:text-gray-400',
  error: 'text-sm text-red-600 dark:text-red-400 mt-4 aria-live=polite',
  offline: 'text-sm text-amber-600 dark:text-amber-400 mt-2'
};

export default CampaignPage;