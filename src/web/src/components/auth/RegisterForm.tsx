import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { useAuth } from '../../hooks/useAuth';
import Input from '../common/Input';
import Select from '../common/Select';
import Button from '../common/Button';
import { validateCPF, validateCRM } from '../../utils/validation';
import { UserRole } from '../../types/auth';

interface RegisterFormProps {
  onSuccess?: (user: any) => void;
  redirectPath?: string;
  initialValues?: Partial<RegisterFormState>;
}

interface RegisterFormState {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  cpf: string;
  crmNumber: string;
  specialty: string;
  clinicName: string;
  clinicAddress: string;
  lgpdConsent: boolean;
}

const SPECIALTIES = [
  { value: 'clinico_geral', label: 'Clínico Geral' },
  { value: 'ortodontista', label: 'Ortodontista' },
  { value: 'endodontista', label: 'Endodontista' },
  { value: 'periodontista', label: 'Periodontista' },
  { value: 'cirurgiao', label: 'Cirurgião Dentista' },
];

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  redirectPath = '/dashboard',
  initialValues,
}) => {
  const { t } = useTranslation('auth');
  const router = useRouter();
  const { register, loading, error } = useAuth();

  const [formData, setFormData] = useState<RegisterFormState>({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    cpf: '',
    crmNumber: '',
    specialty: '',
    clinicName: '',
    clinicAddress: '',
    lgpdConsent: false,
    ...initialValues,
  });

  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RegisterFormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof RegisterFormState, string>> = {};

    // Required field validation
    if (!formData.fullName) errors.fullName = t('errors.required_field');
    if (!formData.email) errors.email = t('errors.required_field');
    if (!formData.password) errors.password = t('errors.required_field');
    if (!formData.confirmPassword) errors.confirmPassword = t('errors.required_field');
    if (!formData.cpf) errors.cpf = t('errors.required_field');
    if (!formData.crmNumber) errors.crmNumber = t('errors.required_field');
    if (!formData.specialty) errors.specialty = t('errors.required_field');
    if (!formData.clinicName) errors.clinicName = t('errors.required_field');
    if (!formData.clinicAddress) errors.clinicAddress = t('errors.required_field');

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      errors.email = t('errors.invalid_email');
    }

    // Password validation
    if (formData.password && formData.password.length < 8) {
      errors.password = t('errors.password_length');
    }

    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = t('errors.password_mismatch');
    }

    // CPF validation
    if (formData.cpf && !validateCPF(formData.cpf)) {
      errors.cpf = t('errors.invalid_cpf');
    }

    // CRM validation
    if (formData.crmNumber && !validateCRM(formData.crmNumber)) {
      errors.crmNumber = t('errors.invalid_crm');
    }

    // LGPD consent validation
    if (!formData.lgpdConsent) {
      errors.lgpdConsent = t('errors.lgpd_consent_required');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!validateForm()) {
        setIsSubmitting(false);
        return;
      }

      const userData = {
        email: formData.email,
        password: formData.password,
        full_name: formData.fullName,
        role: UserRole.MANAGER,
        profile: {
          cpf: formData.cpf,
          crm_number: formData.crmNumber,
          specialty: formData.specialty,
          clinic_name: formData.clinicName,
          clinic_address: formData.clinicAddress,
          lgpd_consent: formData.lgpdConsent,
          lgpd_consent_date: new Date().toISOString(),
        },
      };

      const user = await register(userData);

      if (onSuccess) {
        onSuccess(user);
      } else if (redirectPath) {
        router.push(redirectPath);
      }
    } catch (err) {
      setFormErrors({
        ...formErrors,
        submit: err.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof RegisterFormState) => (
    value: string | boolean
  ) => {
    setFormData({
      ...formData,
      [field]: value,
    });
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors({
        ...formErrors,
        [field]: '',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <Input
        id="fullName"
        name="fullName"
        label={t('labels.full_name')}
        value={formData.fullName}
        error={formErrors.fullName}
        onChange={handleInputChange('fullName')}
        required
      />

      <Input
        id="email"
        name="email"
        type="email"
        label={t('labels.email')}
        value={formData.email}
        error={formErrors.email}
        onChange={handleInputChange('email')}
        required
      />

      <Input
        id="password"
        name="password"
        type="password"
        label={t('labels.password')}
        value={formData.password}
        error={formErrors.password}
        onChange={handleInputChange('password')}
        required
      />

      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label={t('labels.confirm_password')}
        value={formData.confirmPassword}
        error={formErrors.confirmPassword}
        onChange={handleInputChange('confirmPassword')}
        required
      />

      <Input
        id="cpf"
        name="cpf"
        label={t('labels.cpf')}
        value={formData.cpf}
        error={formErrors.cpf}
        onChange={handleInputChange('cpf')}
        pattern="\d{3}\.\d{3}\.\d{3}-\d{2}"
        required
      />

      <Input
        id="crmNumber"
        name="crmNumber"
        label={t('labels.crm')}
        value={formData.crmNumber}
        error={formErrors.crmNumber}
        onChange={handleInputChange('crmNumber')}
        required
      />

      <Select
        name="specialty"
        label={t('labels.specialty')}
        options={SPECIALTIES}
        value={formData.specialty}
        error={formErrors.specialty}
        onChange={handleInputChange('specialty')}
        required
      />

      <Input
        id="clinicName"
        name="clinicName"
        label={t('labels.clinic_name')}
        value={formData.clinicName}
        error={formErrors.clinicName}
        onChange={handleInputChange('clinicName')}
        required
      />

      <Input
        id="clinicAddress"
        name="clinicAddress"
        label={t('labels.clinic_address')}
        value={formData.clinicAddress}
        error={formErrors.clinicAddress}
        onChange={handleInputChange('clinicAddress')}
        required
      />

      <div className="flex items-start">
        <input
          id="lgpdConsent"
          name="lgpdConsent"
          type="checkbox"
          checked={formData.lgpdConsent}
          onChange={(e) => handleInputChange('lgpdConsent')(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300"
        />
        <label htmlFor="lgpdConsent" className="ml-2 block text-sm text-gray-700">
          {t('labels.lgpd_consent')}
        </label>
      </div>
      {formErrors.lgpdConsent && (
        <p className="mt-1 text-sm text-red-600">{formErrors.lgpdConsent}</p>
      )}

      {formErrors.submit && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-600">{formErrors.submit}</p>
        </div>
      )}

      <Button
        type="submit"
        fullWidth
        loading={isSubmitting || loading}
        disabled={isSubmitting || loading}
      >
        {t('buttons.register')}
      </Button>
    </form>
  );
};

export default RegisterForm;