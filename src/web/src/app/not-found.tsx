'use client';

import React from 'react'; // v18.0.0
import { useRouter } from 'next/navigation'; // v13.0.0
import Button from '../components/common/Button';
import { DASHBOARD_ROUTES } from '../constants/routes';

/**
 * Custom 404 Not Found error page component.
 * Follows Material Design 3.0 principles and provides user-friendly navigation options.
 */
const NotFound: React.FC = () => {
  const router = useRouter();

  /**
   * Handles navigation back to the dashboard home page
   */
  const handleBackToHome = () => {
    router.push(DASHBOARD_ROUTES.HOME);
  };

  return (
    <main 
      className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"
      role="main"
      aria-labelledby="error-title"
    >
      <div className="text-center px-4 sm:px-6 py-8 space-y-8">
        {/* Error code with proper typography scale */}
        <p 
          className="text-6xl font-bold text-primary-600 dark:text-primary-400 font-display"
          aria-hidden="true"
        >
          404
        </p>

        {/* Error heading with semantic markup */}
        <h1 
          id="error-title"
          className="text-4xl font-bold text-gray-900 dark:text-gray-100 font-display"
        >
          Página não encontrada
        </h1>

        {/* Error message with accessible text */}
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-md mx-auto">
          Desculpe, não conseguimos encontrar a página que você está procurando. 
          Verifique o endereço ou volte para a página inicial.
        </p>

        {/* Navigation button with proper spacing and accessibility */}
        <div className="mt-8 flex justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={handleBackToHome}
            ariaLabel="Voltar para a página inicial"
            testId="back-to-home-button"
          >
            Voltar para a página inicial
          </Button>
        </div>
      </div>
    </main>
  );
};

export default NotFound;