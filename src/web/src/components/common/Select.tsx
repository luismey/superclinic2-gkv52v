// @ts-check
import React, { useState, useCallback, useId } from 'react';
import classNames from 'classnames'; // v2.3.2
import { validateForm, type ValidationResult } from '../../lib/validation';
import { COLORS, SPACING, TYPE_SCALE, FOCUS_STYLES } from '../../constants/ui';

// Interface for select options
interface SelectOption {
  value: string;
  label: string;
}

// Props interface for the Select component
interface SelectProps {
  id?: string;
  name: string;
  label: string;
  options: SelectOption[];
  value: string;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
  validationSchema?: unknown;
  errorMessageId?: string;
  autoValidate?: boolean;
}

/**
 * Generates class names for the select element based on state
 * @param hasError - Whether the select has an error
 * @param disabled - Whether the select is disabled
 * @param isFocused - Whether the select is focused
 */
const getSelectClasses = (hasError: boolean, disabled: boolean, isFocused: boolean): string => {
  return classNames(
    // Base classes following Material Design 3.0
    'w-full px-4 py-2 rounded-md',
    'text-base leading-normal',
    'bg-white dark:bg-gray-800',
    'transition-all duration-200',
    'appearance-none',
    
    // Border styles
    'border',
    {
      'border-red-500': hasError,
      'border-gray-300 dark:border-gray-600': !hasError,
      'hover:border-primary-500': !disabled && !hasError,
    },
    
    // Focus styles with accessibility
    {
      [FOCUS_STYLES.default]: isFocused && !disabled,
      'outline-none': !isFocused,
    },
    
    // Disabled state
    {
      'opacity-50 cursor-not-allowed': disabled,
      'cursor-pointer': !disabled,
    },
    
    // Typography
    'font-sans',
    TYPE_SCALE.sizes.sm,
    
    // Spacing based on 8px grid
    `mb-${SPACING.grid.sm / 4}`,
    
    // Custom arrow icon for select
    'bg-no-repeat bg-[right_1rem_center]',
    'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%236B7280\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")]'
  );
};

/**
 * A reusable, accessible select component following Material Design 3.0 principles
 */
export const Select: React.FC<SelectProps> = ({
  id,
  name,
  label,
  options,
  value,
  placeholder,
  error,
  disabled = false,
  required = false,
  onChange,
  onBlur,
  validationSchema,
  errorMessageId,
  autoValidate = false,
}) => {
  // Generate unique ID if not provided
  const uniqueId = useId();
  const selectId = id || `select-${uniqueId}`;
  const errorId = errorMessageId || `${selectId}-error`;

  // State management
  const [isFocused, setIsFocused] = useState(false);
  const [validationState, setValidationState] = useState<ValidationResult>({
    success: true,
    errors: {},
    data: null,
  });

  // Validation handler
  const validateField = useCallback(() => {
    if (validationSchema && autoValidate) {
      const result = validateForm(validationSchema, { [name]: value });
      setValidationState(result);
      return result.success;
    }
    return true;
  }, [validationSchema, autoValidate, name, value]);

  // Event handlers
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    if (autoValidate) {
      validateField();
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLSelectElement>) => {
    setIsFocused(false);
    validateField();
    onBlur?.();
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  // Compute error state
  const hasError = Boolean(error || (!validationState.success && validationState.errors[name]));
  const errorMessage = error || validationState.errors[name];

  // Generate select classes
  const selectClasses = getSelectClasses(hasError, disabled, isFocused);

  return (
    <div className="relative mb-4">
      {/* Label */}
      <label
        htmlFor={selectId}
        className={classNames(
          'block mb-2 text-sm font-medium',
          'text-gray-700 dark:text-gray-200',
          { 'text-red-500': hasError }
        )}
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Select Element */}
      <select
        id={selectId}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        disabled={disabled}
        required={required}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={selectClasses}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Error Message */}
      {hasError && (
        <p
          id={errorId}
          className="mt-2 text-sm text-red-500"
          role="alert"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default Select;