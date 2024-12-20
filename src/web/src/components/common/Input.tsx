// @ts-check
import React, { useState, useCallback } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.2
import { validateForm } from '../../lib/validation';
import { COLORS, SPACING, TYPE_SCALE } from '../../constants/ui';

// Input component props interface
interface InputProps {
  id: string;
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'tel' | 'number';
  placeholder?: string;
  value: string;
  error?: string;
  pattern?: string;
  inputMode?: 'text' | 'email' | 'tel' | 'numeric' | 'decimal';
  autoComplete?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  maxLength?: number;
  disabled?: boolean;
  required?: boolean;
  readOnly?: boolean;
  onChange: (value: string) => void;
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

// Input component with accessibility and validation support
const Input: React.FC<InputProps> = ({
  id,
  name,
  label,
  type = 'text',
  placeholder,
  value,
  error,
  pattern,
  inputMode,
  autoComplete,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  maxLength,
  disabled = false,
  required = false,
  readOnly = false,
  onChange,
  onBlur,
  onFocus,
}) => {
  // State for focus management
  const [isFocused, setIsFocused] = useState(false);

  // Generate unique IDs for accessibility
  const inputId = `input-${id}`;
  const errorId = `error-${id}`;
  const descriptionId = `description-${id}`;

  // Compute input classes based on state
  const getInputClasses = useCallback(() => {
    return classNames(
      // Base styles
      'w-full px-4 py-3 rounded-md transition-all duration-200',
      'font-sans text-base leading-normal',
      'bg-white dark:bg-gray-800',
      'border-2',
      
      // Focus and hover states
      'hover:border-gray-400 dark:hover:border-gray-500',
      'focus:outline-none focus:ring-2 focus:ring-offset-2',
      
      // Error state
      error
        ? 'border-red-500 focus:border-red-500 focus:ring-red-200'
        : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200',
      
      // Disabled state
      disabled && 'opacity-50 cursor-not-allowed bg-gray-100',
      
      // High contrast support
      '@media (forced-colors: active) {border-width: 2px}',
      
      // Touch target size for mobile
      'min-h-[44px] sm:min-h-[48px]'
    );
  }, [error, disabled]);

  // Handle input change with validation
  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      
      // Validate input based on type
      const validationResult = validateForm({
        [name]: newValue
      }, {
        [name]: {
          type,
          required,
          pattern
        }
      });

      // Call onChange with validated value
      onChange(newValue);
    },
    [name, type, required, pattern, onChange]
  );

  // Handle blur event
  const handleBlur = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(event);
    },
    [onBlur]
  );

  // Handle focus event
  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    },
    [onFocus]
  );

  return (
    <div className="relative w-full">
      {/* Label */}
      <label
        htmlFor={inputId}
        className={classNames(
          'block mb-2 text-sm font-medium',
          error ? 'text-red-500' : 'text-gray-700 dark:text-gray-200',
          disabled && 'opacity-50'
        )}
      >
        {label}
        {required && (
          <span className="ml-1 text-red-500" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {/* Input field */}
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        pattern={pattern}
        inputMode={inputMode}
        autoComplete={autoComplete}
        maxLength={maxLength}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={ariaLabel || label}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={classNames(
          error && errorId,
          ariaDescribedBy,
          'description' && descriptionId
        )}
        className={getInputClasses()}
      />

      {/* Error message */}
      {error && (
        <div
          id={errorId}
          role="alert"
          className="mt-2 text-sm text-red-500 dark:text-red-400"
        >
          {error}
        </div>
      )}

      {/* Visually hidden description for screen readers */}
      <div id={descriptionId} className="sr-only">
        {required ? 'Campo obrigatório. ' : ''}
        {placeholder}
      </div>
    </div>
  );
};

export default Input;