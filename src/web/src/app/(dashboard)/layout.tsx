'use client';

import React, { useEffect } from 'react';
import { redirect } from 'next/navigation';

// Internal components and hooks
import DashboardLayout from '../../components/layout/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';

// Props interface
interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Protected dashboard layout component that provides consistent structure and authentication
 * for all dashboard pages. Implements Material Design 3.0 principles and LGPD compliance.
 */
const Layout: React.FC<LayoutProps> = ({ children }) => {
  // Authentication state management
  const { isAuthenticated, loading, user } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      redirect('/login');
    }
  }, [isAuthenticated, loading]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div 
        className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"
        role="status"
        aria-label="Verificando autenticação"
      >
        <div className="h-32 w-32 animate-pulse rounded-lg bg-primary-100 dark:bg-primary-800">
          <span className="sr-only">Carregando...</span>
        </div>
      </div>
    );
  }

  // Return null during redirect
  if (!isAuthenticated) {
    return null;
  }

  // Render dashboard layout with authenticated user
  return (
    <div 
      className="flex min-h-screen flex-col bg-white dark:bg-gray-800"
      data-testid="dashboard-layout"
    >
      <DashboardLayout>
        {/* Error boundary could be added here for graceful error handling */}
        {children}
      </DashboardLayout>

      {/* LGPD compliance notice */}
      {user && !user.lgpd_consent && (
        <div 
          className="fixed bottom-0 left-0 right-0 bg-gray-900 p-4 text-white"
          role="alert"
          aria-live="polite"
        >
          <div className="mx-auto max-w-7xl">
            <p className="text-sm">
              Utilizamos cookies e tecnologias semelhantes para melhorar sua experiência.
              Ao continuar navegando, você concorda com nossa{' '}
              <a 
                href="/privacy-policy" 
                className="underline hover:text-primary-300"
                target="_blank"
                rel="noopener noreferrer"
              >
                Política de Privacidade
              </a>
              .
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;