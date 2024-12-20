'use client';

import React, { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Metadata } from 'next';

import ProfileForm from '../../../components/settings/ProfileForm';
import WhatsAppConfig from '../../../components/settings/WhatsAppConfig';
import AIAssistantConfig from '../../../components/settings/AIAssistantConfig';
import Card from '../../../components/common/Card';
import { useToast } from '../../../hooks/useToast';

// Metadata for the settings page
export const metadata: Metadata = {
  title: 'Configurações | Porfin',
  description: 'Gerencie as configurações da sua conta, WhatsApp e assistente virtual',
};

/**
 * Settings page component that provides access to profile, WhatsApp, and AI assistant configurations
 * Implements Material Design 3.0 principles and LGPD compliance features
 */
const SettingsPage: React.FC = () => {
  const t = useTranslations('settings');
  const { showToast } = useToast();

  // Success handlers for different settings sections
  const handleProfileSuccess = useCallback(() => {
    showToast({
      message: t('profile.successMessage'),
      type: 'success',
    });
  }, [t, showToast]);

  const handleWhatsAppSuccess = useCallback(() => {
    showToast({
      message: t('whatsapp.successMessage'),
      type: 'success',
    });
  }, [t, showToast]);

  const handleAISuccess = useCallback(() => {
    showToast({
      message: t('aiAssistant.successMessage'),
      type: 'success',
    });
  }, [t, showToast]);

  // Error handlers
  const handleError = useCallback((error: Error) => {
    showToast({
      message: error.message,
      type: 'error',
    });
  }, [showToast]);

  return (
    <div className="container space-y-6 pb-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {t('title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('description')}
        </p>
      </div>

      {/* Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Profile Settings */}
        <Card elevation="sm" className="col-span-full lg:col-span-2">
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('profile.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('profile.description')}
            </p>
          </div>
          <ProfileForm
            onSuccess={handleProfileSuccess}
            onError={handleError}
          />
        </Card>

        {/* WhatsApp Configuration */}
        <Card elevation="sm" className="col-span-full lg:col-span-2">
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('whatsapp.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('whatsapp.description')}
            </p>
          </div>
          <WhatsAppConfig
            onSuccess={handleWhatsAppSuccess}
            onError={handleError}
          />
        </Card>

        {/* AI Assistant Configuration */}
        <Card elevation="sm" className="col-span-full lg:col-span-2">
          <div className="space-y-1 mb-6">
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {t('aiAssistant.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('aiAssistant.description')}
            </p>
          </div>
          <AIAssistantConfig
            onSuccess={handleAISuccess}
            onError={handleError}
          />
        </Card>

        {/* LGPD Compliance Information */}
        <Card elevation="sm" className="col-span-full">
          <div className="space-y-1 mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('lgpd.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('lgpd.description')}
            </p>
          </div>
          <div className="prose prose-sm dark:prose-invert">
            <p>{t('lgpd.complianceInfo')}</p>
            <ul>
              <li>{t('lgpd.dataProtection')}</li>
              <li>{t('lgpd.dataRetention')}</li>
              <li>{t('lgpd.userRights')}</li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage;