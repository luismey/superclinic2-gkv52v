import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'next-i18next';
import { zodResolver } from '@hookform/resolvers/zod';
import Select from '../common/Select';
import { TargetAudienceType } from '../../types/campaigns';

// Version comments for external dependencies
// next-i18next: ^14.0.0
// @hookform/resolvers/zod: ^3.0.0

interface TargetAudienceSelectorProps {
  value: TargetAudienceType;
  onChange: (value: TargetAudienceType) => void;
  error?: string;
  disabled?: boolean;
  showLGPDInfo?: boolean;
  customValidation?: (type: TargetAudienceType) => Promise<boolean>;
}

/**
 * Healthcare-focused audience option interface with LGPD information
 */
interface AudienceOption {
  value: TargetAudienceType;
  label: string;
  description: string;
  lgpdImpact: string;
  requiresConsent: boolean;
}

/**
 * Generates localized options for healthcare-specific target audiences
 * @param t - Translation function
 * @returns Array of audience options with LGPD information
 */
const getAudienceOptions = (t: (key: string) => string): AudienceOption[] => [
  {
    value: TargetAudienceType.NEW_LEADS,
    label: t('campaigns.audience.newLeads.label'),
    description: t('campaigns.audience.newLeads.description'),
    lgpdImpact: t('campaigns.audience.newLeads.lgpd'),
    requiresConsent: true
  },
  {
    value: TargetAudienceType.ACTIVE_PATIENTS,
    label: t('campaigns.audience.activePatients.label'),
    description: t('campaigns.audience.activePatients.description'),
    lgpdImpact: t('campaigns.audience.activePatients.lgpd'),
    requiresConsent: false
  },
  {
    value: TargetAudienceType.POST_TREATMENT,
    label: t('campaigns.audience.postTreatment.label'),
    description: t('campaigns.audience.postTreatment.description'),
    lgpdImpact: t('campaigns.audience.postTreatment.lgpd'),
    requiresConsent: true
  },
  {
    value: TargetAudienceType.CUSTOM,
    label: t('campaigns.audience.custom.label'),
    description: t('campaigns.audience.custom.description'),
    lgpdImpact: t('campaigns.audience.custom.lgpd'),
    requiresConsent: true
  }
];

/**
 * Validates audience selection against LGPD and healthcare requirements
 * @param type - Selected audience type
 * @param customValidation - Optional custom validation function
 * @returns Promise<boolean> indicating validation result
 */
const validateAudienceSelection = async (
  type: TargetAudienceType,
  customValidation?: (type: TargetAudienceType) => Promise<boolean>
): Promise<boolean> => {
  // Base validation for LGPD compliance
  const requiresExplicitConsent = [
    TargetAudienceType.NEW_LEADS,
    TargetAudienceType.POST_TREATMENT,
    TargetAudienceType.CUSTOM
  ].includes(type);

  if (requiresExplicitConsent && !customValidation) {
    return false;
  }

  // Execute custom validation if provided
  if (customValidation) {
    return await customValidation(type);
  }

  return true;
};

/**
 * A healthcare-focused form component for selecting target audience types
 * in WhatsApp campaign creation and management.
 */
export const TargetAudienceSelector: React.FC<TargetAudienceSelectorProps> = ({
  value,
  onChange,
  error,
  disabled = false,
  showLGPDInfo = true,
  customValidation
}) => {
  const { t } = useTranslation('campaigns');

  // Memoize audience options to prevent unnecessary recalculations
  const audienceOptions = useMemo(() => getAudienceOptions(t), [t]);

  // Handle audience selection with validation
  const handleChange = useCallback(async (newValue: string) => {
    const audienceType = newValue as TargetAudienceType;
    const isValid = await validateAudienceSelection(audienceType, customValidation);
    
    if (isValid) {
      onChange(audienceType);
    }
  }, [onChange, customValidation]);

  // Find current option for LGPD info display
  const currentOption = audienceOptions.find(option => option.value === value);

  return (
    <div className="space-y-2">
      <Select
        name="target-audience"
        label={t('campaigns.audience.label')}
        value={value}
        onChange={handleChange}
        error={error}
        disabled={disabled}
        options={audienceOptions.map(option => ({
          value: option.value,
          label: option.label
        }))}
        aria-describedby={showLGPDInfo ? 'lgpd-info' : undefined}
      />

      {/* LGPD Information Display */}
      {showLGPDInfo && currentOption && (
        <div 
          id="lgpd-info"
          className="mt-2 text-sm rounded-md bg-blue-50 dark:bg-blue-900 p-3"
          role="region"
          aria-label={t('campaigns.audience.lgpdInfo')}
        >
          <p className="font-medium text-blue-800 dark:text-blue-200">
            {t('campaigns.audience.lgpdImpact')}
          </p>
          <p className="mt-1 text-blue-700 dark:text-blue-300">
            {currentOption.lgpdImpact}
          </p>
          {currentOption.requiresConsent && (
            <p className="mt-2 text-amber-700 dark:text-amber-300">
              {t('campaigns.audience.consentRequired')}
            </p>
          )}
        </div>
      )}

      {/* Description for screen readers */}
      <p className="sr-only">
        {currentOption?.description}
      </p>
    </div>
  );
};

export default TargetAudienceSelector;