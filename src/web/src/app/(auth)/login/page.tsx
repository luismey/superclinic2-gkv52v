'use client';

import React, { useEffect } from 'react';
import { redirect } from 'next/navigation';
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro';
import { Metadata } from 'next';
import { useAuth } from '../../../hooks/useAuth';
import LoginForm from '../../../components/auth/LoginForm';
import { COLORS, SPACING } from '../../../constants/ui';

// Metadata configuration with security headers
export const generateMetadata = (): Metadata => {
  return {
    title: 'Login | Porfin',
    description: 'Acesse sua conta Porfin - Plataforma segura de gestão para profissionais de saúde',
    robots: 'noindex, nofollow',
    viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
    themeColor: COLORS.light.primary,
    openGraph: {
      title: 'Login | Porfin',
      description: 'Acesse sua conta Porfin - Plataforma segura de gestão para profissionais de saúde',
      locale: 'pt_BR',
      type: 'website',
    },
    other: {
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    },
  };
};

/**
 * Login page component with enhanced security features and LGPD compliance
 */
const LoginPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Initialize device fingerprinting
  useEffect(() => {
    const initializeFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load({
          apiKey: process.env.NEXT_PUBLIC_FP_API_KEY,
        });
        await fp.get();
      } catch (error) {
        console.error('Fingerprint initialization failed:', error);
      }
    };

    initializeFingerprint();
  }, []);

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      redirect('/dashboard');
    }
  }, [isAuthenticated, isLoading]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-md p-8 space-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
        <div className="text-center">
          <img
            src="/logo.svg"
            alt="Porfin"
            className="mx-auto h-12 w-auto"
            width={48}
            height={48}
          />
          <h1 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
            Bem-vindo(a) ao Porfin
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Plataforma segura de gestão para profissionais de saúde
          </p>
        </div>

        <LoginForm />

        {/* LGPD Compliance Notice */}
        <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          Ao acessar, você concorda com nossa{' '}
          <a href="/privacy" className="text-primary-600 hover:underline">
            Política de Privacidade
          </a>{' '}
          e{' '}
          <a href="/terms" className="text-primary-600 hover:underline">
            Termos de Uso
          </a>
          , em conformidade com a LGPD.
        </p>
      </div>
    </main>
  );
};

export default LoginPage;