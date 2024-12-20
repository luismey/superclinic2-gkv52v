'use client';

import React, { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Analytics } from '@vercel/analytics/react'; // v1.0.0
import { useAuth } from '../hooks/useAuth';
import Button from '../components/common/Button';

/**
 * Landing page component for the Porfin platform
 * Implements responsive design and clear value propositions for healthcare professionals
 */
const LandingPage: React.FC = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  // Handle navigation to registration with analytics
  const handleGetStarted = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      // Track conversion event
      Analytics.track('signup_initiated', {
        source: 'landing_page',
        timestamp: new Date().toISOString()
      });
      router.push('/register');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router]);

  // Handle navigation to login with analytics
  const handleLogin = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      Analytics.track('login_initiated', {
        source: 'landing_page',
        timestamp: new Date().toISOString()
      });
      router.push('/login');
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router]);

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  if (isLoading) {
    return null; // Or loading spinner
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-sm border-b border-gray-100 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Image
              src="/logo.svg"
              alt="Porfin"
              width={120}
              height={32}
              priority
            />
          </div>
          <nav className="hidden md:flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogin}
              ariaLabel="Fazer login"
            >
              Login
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleGetStarted}
              ariaLabel="Começar agora"
            >
              Começar Agora
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 pt-24 pb-12 sm:px-6 lg:px-8">
        <div className="text-center space-y-8 py-12 lg:py-20">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900">
            Automatize seu Consultório com IA
          </h1>
          <p className="text-xl sm:text-2xl text-gray-600 max-w-2xl mx-auto">
            Gerencie pacientes, automatize WhatsApp e aumente suas conversões com inteligência artificial
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <Button
              variant="primary"
              size="lg"
              onClick={handleGetStarted}
              ariaLabel="Começar gratuitamente"
            >
              Começar Gratuitamente
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/demo')}
              ariaLabel="Agendar demonstração"
            >
              Agendar Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-12">
          {/* WhatsApp Business */}
          <div className="p-6 rounded-lg bg-white shadow-md">
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <Image
                src="/icons/whatsapp.svg"
                alt="WhatsApp"
                width={24}
                height={24}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              WhatsApp Business
            </h3>
            <p className="text-gray-600">
              Integração completa com WhatsApp para atendimento automatizado
            </p>
          </div>

          {/* AI Assistant */}
          <div className="p-6 rounded-lg bg-white shadow-md">
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <Image
                src="/icons/ai.svg"
                alt="AI"
                width={24}
                height={24}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Assistente Virtual
            </h3>
            <p className="text-gray-600">
              IA avançada para converter leads e agendar consultas
            </p>
          </div>

          {/* Analytics */}
          <div className="p-6 rounded-lg bg-white shadow-md">
            <div className="h-12 w-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
              <Image
                src="/icons/analytics.svg"
                alt="Analytics"
                width={24}
                height={24}
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Analytics
            </h3>
            <p className="text-gray-600">
              Métricas detalhadas do seu negócio em tempo real
            </p>
          </div>
        </div>

        {/* LGPD Compliance Notice */}
        <div className="text-center text-sm text-gray-500 mt-8">
          <p>
            Seus dados são protegidos de acordo com a LGPD.{' '}
            <a
              href="/privacy"
              className="text-primary-600 hover:text-primary-700"
              aria-label="Ver política de privacidade"
            >
              Política de Privacidade
            </a>
          </p>
        </div>
      </main>

      {/* Analytics Integration */}
      <Analytics />
    </div>
  );
};

export default LandingPage;