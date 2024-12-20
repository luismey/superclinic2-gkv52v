'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'next-i18next';
import { useAnalytics } from '@firebase/analytics';
import PasswordResetForm from '../../../components/auth/PasswordResetForm';
import { useAuth } from '../../../hooks/useAuth';
import Toast from '../../../components/common/Toast';
import { ToastType } from '../../../hooks/useToast';

/**
 * Forgot Password page component with enhanced security and LGPD compliance
 * Implements requirements from Technical Specifications/7.1.1 Authentication Methods
 */
const ForgotPasswordPage: React.FC = () => {
  // Hooks initialization
  const router = useRouter();
  const { t } = useTranslation('auth');
  const analytics = useAnalytics();
  const { resetPassword, loading, error } = useAuth();

  // Local state management
  const [showSuccess, setShowSuccess] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockExpiry, setBlockExpiry] = useState<Date | null>(null);

  // Constants
  const MAX_ATTEMPTS = 5;
  const BLOCK_DURATION = 15 * 60 * 1000; // 15 minutes

  /**
   * Check if user is blocked from making reset attempts
   */
  useEffect(() => {
    if (blockExpiry && new Date() < blockExpiry) {
      setIsBlocked(true);
    } else {
      setIsBlocked(false);
      setAttempts(0);
      setBlockExpiry(null);
    }
  }, [blockExpiry]);

  /**
   * Handle password reset request with rate limiting and security logging
   */
  const handleResetRequest = useCallback(async (email: string) => {
    try {
      // Check if user is blocked
      if (isBlocked) {
        const remainingTime = blockExpiry ? Math.ceil((blockExpiry.getTime() - Date.now()) / 60000) : 0;
        throw new Error(t('errors.account_blocked', { minutes: remainingTime }));
      }

      // Increment attempt counter
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // Check if max attempts reached
      if (newAttempts >= MAX_ATTEMPTS) {
        const expiry = new Date(Date.now() + BLOCK_DURATION);
        setBlockExpiry(expiry);
        setIsBlocked(true);
        
        // Log security event
        analytics.logEvent('security_block', {
          reason: 'max_reset_attempts',
          email: email,
          duration: BLOCK_DURATION
        });

        throw new Error(t('errors.max_attempts_reached'));
      }

      // Attempt password reset
      await resetPassword(email);

      // Log successful attempt
      analytics.logEvent('password_reset_requested', {
        success: true
      });

      setShowSuccess(true);
      
      // Reset attempts on success
      setAttempts(0);

    } catch (error) {
      // Log failed attempt
      analytics.logEvent('password_reset_requested', {
        success: false,
        error: error.message
      });

      throw error;
    }
  }, [analytics, attempts, blockExpiry, isBlocked, resetPassword, t]);

  /**
   * Handle successful reset request
   */
  const handleSuccess = useCallback(() => {
    router.push('/login?reset=requested');
  }, [router]);

  /**
   * Handle form cancellation
   */
  const handleCancel = useCallback(() => {
    router.push('/login');
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md space-y-6">
        <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          {t('forgot_password.title')}
        </h1>

        <p className="text-sm text-center mb-8 text-gray-600 dark:text-gray-400">
          {t('forgot_password.description')}
        </p>

        <PasswordResetForm
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />

        {/* LGPD compliance notice */}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
          {t('forgot_password.lgpd_notice')}
        </p>
      </div>

      {/* Success notification */}
      {showSuccess && (
        <Toast
          type={ToastType.SUCCESS}
          duration={5000}
          onClose={() => setShowSuccess(false)}
        />
      )}

      {/* Error notification */}
      {error && (
        <Toast
          type={ToastType.ERROR}
          duration={5000}
          onClose={() => setShowSuccess(false)}
        />
      )}
    </div>
  );
};

export default ForgotPasswordPage;