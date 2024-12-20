'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import { useToast } from '@radix-ui/react-toast';
import BillingInfo from '../../../../components/settings/BillingInfo';
import { settingsService } from '../../../../services/settings';
import Card from '../../../../components/common/Card';
import { validateCPFCNPJ } from '../../../../utils/validation';
import { COLORS } from '../../../../constants/ui';

// Initial billing state with Brazilian defaults
const initialBillingState = {
  plan_type: '',
  billing_cycle: '',
  payment_method: {
    type: 'pix',
    pix: {},
    boleto: {},
    credit_card: {}
  },
  tax_id: '',
  fiscal_document_type: 'cpf',
  fiscal_document_number: '',
  billing_address: '',
  timezone: 'America/Sao_Paulo'
};

// Brazilian payment methods
const PAYMENT_METHODS = ['pix', 'boleto', 'credit_card'] as const;

// Brazilian fiscal document types
const FISCAL_DOCUMENT_TYPES = ['cpf', 'cnpj'] as const;

/**
 * Billing settings page component with Brazilian market support
 * Implements LGPD compliance and Brazilian payment methods
 */
const BillingPage: React.FC = () => {
  // State management
  const [billingInfo, setBillingInfo] = useState(initialBillingState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hooks
  const { t } = useTranslation('settings');
  const { showToast } = useToast();

  /**
   * Fetches current billing information
   */
  const fetchBillingInfo = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await settingsService.getBillingInfo();
      setBillingInfo(response.data);

    } catch (err) {
      setError(t('billing.errors.fetch_failed'));
      showToast({
        title: t('common.error'),
        description: t('billing.errors.fetch_failed'),
        variant: 'error'
      });
      console.error('Failed to fetch billing info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [t, showToast]);

  /**
   * Handles billing information updates with Brazilian payment processing
   */
  const handleBillingUpdate = useCallback(async (updatedInfo: typeof billingInfo) => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate fiscal documents (CPF/CNPJ)
      const { tax_id, fiscal_document_type } = updatedInfo;
      const validationResult = validateCPFCNPJ(tax_id);
      
      if (!validationResult.isValid) {
        throw new Error(t(`billing.errors.invalid_${fiscal_document_type}`));
      }

      // Process Brazilian payment method
      const { payment_method } = updatedInfo;
      if (!PAYMENT_METHODS.includes(payment_method.type as typeof PAYMENT_METHODS[number])) {
        throw new Error(t('billing.errors.invalid_payment_method'));
      }

      // Update billing information
      await settingsService.updateBillingInfo(updatedInfo);

      // Show success message
      showToast({
        title: t('billing.success.title'),
        description: t('billing.success.update'),
        variant: 'success'
      });

      // Refresh billing info
      await fetchBillingInfo();

    } catch (err) {
      setError(err.message || t('billing.errors.update_failed'));
      showToast({
        title: t('common.error'),
        description: err.message || t('billing.errors.update_failed'),
        variant: 'error'
      });
      console.error('Failed to update billing info:', err);
    } finally {
      setIsLoading(false);
    }
  }, [t, showToast, fetchBillingInfo]);

  // Initial data fetch
  useEffect(() => {
    fetchBillingInfo();
  }, [fetchBillingInfo]);

  return (
    <div className="container mx-auto px-4 py-8">
      <Card elevation="md" className="mb-8">
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            {t('billing.title')}
          </h1>

          {error && (
            <div 
              className="mb-6 p-4 rounded-md bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100"
              role="alert"
            >
              {error}
            </div>
          )}

          <BillingInfo
            billingInfo={billingInfo}
            onUpdate={handleBillingUpdate}
            isLoading={isLoading}
          />

          {/* LGPD Compliance Notice */}
          <div className="mt-8 p-4 rounded-md bg-blue-50 dark:bg-blue-900 text-sm text-blue-800 dark:text-blue-100">
            <h2 className="font-semibold mb-2">{t('billing.lgpd.title')}</h2>
            <p>{t('billing.lgpd.description')}</p>
            <ul className="list-disc list-inside mt-2">
              <li>{t('billing.lgpd.data_usage')}</li>
              <li>{t('billing.lgpd.data_protection')}</li>
              <li>{t('billing.lgpd.data_rights')}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Payment Methods Information */}
      <Card elevation="sm" className="mb-8">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {t('billing.payment_methods.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAYMENT_METHODS.map((method) => (
              <div 
                key={method}
                className="p-4 rounded-md border border-gray-200 dark:border-gray-700"
              >
                <h3 className="font-semibold mb-2 capitalize">
                  {t(`billing.payment_methods.${method}.title`)}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {t(`billing.payment_methods.${method}.description`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default BillingPage;