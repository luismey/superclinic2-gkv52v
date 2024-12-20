import React, { useState, FormEvent, useCallback } from 'react';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../hooks/useAuth';
import Input from '../common/Input';
import Button from '../common/Button';

interface PasswordResetFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  onSuccess,
  onCancel
}) => {
  // Hooks
  const { t } = useTranslation('auth');
  const { resetPassword, loading, error } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  // Email validation with Brazilian format support
  const validateEmail = useCallback((email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (!email) {
      setEmailError(t('errors.email_required'));
      return false;
    }

    if (!emailRegex.test(email)) {
      setEmailError(t('errors.email_invalid'));
      return false;
    }

    setEmailError('');
    return true;
  }, [t]);

  // Handle form submission with rate limiting
  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Check rate limiting
    if (isBlocked) {
      setEmailError(t('errors.too_many_attempts'));
      return;
    }

    // Validate email
    if (!validateEmail(email)) {
      return;
    }

    try {
      await resetPassword(email);
      setAttempts(0);
      onSuccess?.();
    } catch (error) {
      // Increment attempts counter
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      // Block after 3 attempts for 15 minutes
      if (newAttempts >= 3) {
        setIsBlocked(true);
        setTimeout(() => {
          setIsBlocked(false);
          setAttempts(0);
        }, 15 * 60 * 1000); // 15 minutes
        setEmailError(t('errors.account_blocked'));
      } else {
        setEmailError(t('errors.reset_failed'));
      }
    }
  }, [email, attempts, isBlocked, validateEmail, resetPassword, onSuccess, t]);

  return (
    <form 
      onSubmit={handleSubmit}
      className="flex flex-col space-y-4 w-full max-w-md mx-auto p-6 bg-surface rounded-lg shadow-md"
      noValidate
    >
      <h2 className="text-xl font-semibold text-center mb-4">
        {t('reset_password.title')}
      </h2>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {t('reset_password.description')}
      </p>

      <Input
        id="email"
        name="email"
        type="email"
        label={t('fields.email')}
        value={email}
        error={emailError}
        onChange={setEmail}
        placeholder={t('placeholders.email')}
        autoComplete="email"
        required
        disabled={loading || isBlocked}
        aria-describedby="email-error"
      />

      {error && (
        <div 
          role="alert" 
          className="text-error text-sm mt-1 font-medium"
        >
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={loading}
          disabled={isBlocked}
          aria-label={t('buttons.reset_password')}
        >
          {t('buttons.reset_password')}
        </Button>

        {onCancel && (
          <Button
            type="button"
            variant="outline"
            fullWidth
            onClick={onCancel}
            disabled={loading}
            aria-label={t('buttons.cancel')}
          >
            {t('buttons.cancel')}
          </Button>
        )}
      </div>

      {isBlocked && (
        <p 
          role="alert" 
          className="text-error text-sm text-center mt-4"
        >
          {t('errors.account_blocked_description')}
        </p>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
        {t('reset_password.lgpd_notice')}
      </p>
    </form>
  );
};

export default PasswordResetForm;