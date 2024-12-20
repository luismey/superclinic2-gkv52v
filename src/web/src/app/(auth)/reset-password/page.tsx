'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from 'next-i18next';

import PasswordResetForm from '../../../components/auth/PasswordResetForm';
import { useAuth } from '../../../hooks/useAuth';
import { AUTH_ROUTES } from '../../../constants/routes';

/**
 * Password reset page component with enhanced security and accessibility features.
 * Implements LGPD compliance and Brazilian Portuguese localization.
 */
const ResetPasswordPage: React.FC = () => {
  // Hooks
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation('auth');
  const { resetPassword, validateResetToken } = useAuth();

  // State
  const [isValidToken, setIsValidToken] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validates reset token from URL
   */
  const validateToken = useCallback(async (token: string) => {
    try {
      const isValid = await validateResetToken(token);
      setIsValidToken(isValid);
      setError(null);
    } catch (err) {
      setIsValidToken(false);
      setError(t('errors.invalid_reset_token'));
    } finally {
      setIsLoading(false);
    }
  }, [validateResetToken, t]);

  /**
   * Handles successful password reset
   */
  const handleResetSuccess = useCallback(async (email: string) => {
    try {
      // Show success message
      const message = t('messages.password_reset_success');
      
      // Announce success to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'alert');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = message;
      document.body.appendChild(announcement);

      // Navigate to login after delay
      setTimeout(() => {
        document.body.removeChild(announcement);
        router.push(AUTH_ROUTES.LOGIN);
      }, 3000);
    } catch (err) {
      setError(t('errors.navigation_failed'));
    }
  }, [router, t]);

  // Validate token on mount
  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(t('errors.missing_reset_token'));
      setIsLoading(false);
      return;
    }

    validateToken(token);
  }, [searchParams, validateToken, t]);

  // Loading state
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center min-h-screen"
        role="status"
        aria-label={t('messages.validating_token')}
      >
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Error state
  if (error || !isValidToken) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen p-4"
        role="alert"
      >
        <div className="text-red-500 text-lg font-medium mb-4">
          {error || t('errors.invalid_reset_token')}
        </div>
        <button
          onClick={() => router.push(AUTH_ROUTES.LOGIN)}
          className="text-primary-600 hover:text-primary-700 font-medium"
          aria-label={t('buttons.return_to_login')}
        >
          {t('buttons.return_to_login')}
        </button>
      </div>
    );
  }

  // Success state - render form
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          {t('reset_password.title')}
        </h1>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <PasswordResetForm
            onSuccess={handleResetSuccess}
            onCancel={() => router.push(AUTH_ROUTES.LOGIN)}
          />
        </div>

        <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
          {t('reset_password.lgpd_notice')}
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;