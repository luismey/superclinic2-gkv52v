'use client';

import React, { useEffect } from 'react';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { rateLimit } from '@vercel/edge';
import RegisterForm from '../../../components/auth/RegisterForm';
import { useAuth } from '../../../hooks/useAuth';
import { useAnalytics } from '../../../hooks/useAnalytics';
import { AUTH_ERROR_CODES } from '../../../constants/auth';
import { COLORS, SPACING, TYPE_SCALE } from '../../../constants/ui';

// Generate metadata for the registration page
export const generateMetadata = (): Metadata => {
  return {
    title: 'Cadastro | Porfin',
    description: 'Crie sua conta na Porfin - Plataforma de gestão para profissionais de saúde com proteção LGPD',
    robots: {
      index: false,
      follow: false,
    },
    viewport: {
      width: 'device-width',
      initialScale: 1,
      maximumScale: 1,
    },
    openGraph: {
      title: 'Cadastro | Porfin',
      description: 'Plataforma de gestão para profissionais de saúde',
      type: 'website',
      locale: 'pt_BR',
    },
    other: {
      'lgpd-consent': 'required',
      'lgpd-data-collected': 'nome, email, profissão, registro profissional',
      'lgpd-data-purpose': 'autenticação e verificação profissional',
      'lgpd-data-retention': 'conforme política de privacidade',
    },
  };
};

// Rate limiting configuration
const RATE_LIMIT = {
  uniqueTokenPerInterval: 500, // Max unique tokens per interval
  interval: 60 * 1000, // 1 minute in milliseconds
};

/**
 * Enhanced register page component with LGPD compliance and healthcare validation
 */
const Register = () => {
  const { user, loading } = useAuth();
  const { trackRegistration } = useAnalytics();

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user) {
      redirect('/dashboard');
    }
  }, [user]);

  // Handle successful registration
  const handleRegistrationSuccess = async (user: any) => {
    try {
      // Track successful registration
      await trackRegistration({
        userId: user.id,
        userRole: user.role,
        registrationSource: 'web',
        timestamp: new Date().toISOString(),
      });

      // Redirect to dashboard
      redirect('/dashboard');
    } catch (error) {
      console.error('Failed to track registration:', error);
    }
  };

  // Apply rate limiting
  const rateLimitResult = rateLimit({
    uniqueTokenPerInterval: RATE_LIMIT.uniqueTokenPerInterval,
    interval: RATE_LIMIT.interval,
  });

  if (!rateLimitResult.success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Muitas tentativas
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Por favor, aguarde alguns minutos antes de tentar novamente.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo */}
        <img
          className="mx-auto h-12 w-auto"
          src="/logo.svg"
          alt="Porfin"
        />
        
        {/* Title */}
        <h1 className={`mt-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100 ${TYPE_SCALE.sizes.xl}`}>
          Crie sua conta
        </h1>
        
        {/* Subtitle */}
        <p className={`mt-2 text-center text-gray-600 dark:text-gray-400 ${TYPE_SCALE.sizes.sm}`}>
          Plataforma de gestão para profissionais de saúde
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-gray-800 py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {/* LGPD Notice */}
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-200">
              Seus dados serão tratados de acordo com a LGPD. 
              Consulte nossa <a href="/privacy" className="underline">Política de Privacidade</a>.
            </p>
          </div>

          {/* Registration Form */}
          <RegisterForm
            onSuccess={handleRegistrationSuccess}
            redirectPath="/dashboard"
          />
        </div>
      </div>

      {/* Healthcare Provider Notice */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Exclusivo para profissionais de saúde com registro ativo no conselho profissional.
        </p>
      </div>
    </div>
  );
};

export default Register;