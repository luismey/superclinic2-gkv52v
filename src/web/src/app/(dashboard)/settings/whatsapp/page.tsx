'use client';

import React from 'react'; // ^18.0.0
import { Metadata } from 'next'; // ^13.0.0
import WhatsAppConfig from '../../../../components/settings/WhatsAppConfig';
import { COLORS, SPACING } from '../../../../constants/ui';

/**
 * Generates metadata for the WhatsApp settings page
 * Implements SEO and accessibility requirements
 */
export const generateMetadata = (): Metadata => {
  return {
    title: 'Configurações do WhatsApp | Porfin',
    description: 'Configure sua integração com WhatsApp Business API, incluindo número de telefone, detalhes comerciais e webhooks.',
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: 'Configurações do WhatsApp | Porfin',
      description: 'Gerencie sua integração com WhatsApp Business',
      locale: 'pt-BR',
      type: 'website',
    },
    alternates: {
      canonical: '/settings/whatsapp',
    },
  };
};

/**
 * WhatsApp settings page component implementing Material Design 3.0 principles
 * and WCAG 2.1 Level AA accessibility standards
 */
const WhatsAppSettingsPage: React.FC = () => {
  return (
    <main 
      className="min-h-screen bg-gray-50 dark:bg-gray-900"
      role="main"
      aria-labelledby="whatsapp-settings-title"
    >
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
          <h1 
            id="whatsapp-settings-title"
            className="text-2xl font-semibold text-gray-900 dark:text-gray-100"
          >
            Configurações do WhatsApp
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 max-w-4xl">
            Configure sua integração com o WhatsApp Business API, incluindo verificação de número,
            detalhes comerciais e configurações de webhook.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8"
        style={{
          '--spacing-grid': `${SPACING.grid.base}px`,
        } as React.CSSProperties}
      >
        {/* Error Boundary Container */}
        <div 
          role="alert" 
          aria-live="polite"
          className="space-y-6"
        >
          {/* WhatsApp Configuration Form */}
          <WhatsAppConfig />
        </div>
      </div>
    </main>
  );
};

export default WhatsAppSettingsPage;