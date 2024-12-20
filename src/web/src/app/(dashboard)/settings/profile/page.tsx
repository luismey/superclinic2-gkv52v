'use client';

import React from 'react'; // ^18.0.0
import { Metadata } from 'next'; // ^13.0.0
import Card from '@/components/common/Card';
import ProfileForm from '@/components/settings/ProfileForm';

/**
 * Metadata configuration for the profile settings page
 * Implements SEO optimization with Brazilian Portuguese content
 */
export const metadata: Metadata = {
  title: 'Configurações do Perfil | Porfin',
  description: 'Gerencie suas informações profissionais e configurações da clínica com conformidade LGPD',
  openGraph: {
    title: 'Configurações do Perfil | Porfin',
    description: 'Gerencie suas informações profissionais e configurações da clínica',
    locale: 'pt-BR',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * Profile settings page component with enhanced Material Design and LGPD compliance
 * Implements requirements from Technical Specifications/3.1.1 Design Specifications
 */
const ProfilePage: React.FC = () => {
  return (
    <div className="container max-w-4xl mx-auto px-4 md:px-6 py-8">
      {/* Page Header */}
      <header className="mb-8 grid gap-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Configurações do Perfil
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Gerencie suas informações profissionais e configurações da clínica em conformidade com a LGPD
        </p>
      </header>

      {/* Profile Settings Card */}
      <Card 
        elevation="md"
        className="bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow duration-200"
      >
        <div className="grid gap-6 p-6">
          <ProfileForm />
        </div>
      </Card>

      {/* LGPD Compliance Notice */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Suas informações são protegidas de acordo com a Lei Geral de Proteção de Dados (LGPD).
          Mantemos apenas os dados necessários para a prestação dos nossos serviços.
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;