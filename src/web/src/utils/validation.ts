// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseModel } from '../types/common';
import { AuthUser } from '../types/auth';

// Constants for validation patterns and messages
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_REGEX = /^\([1-9]{2}\) (?:[2-8]|9[1-9])[0-9]{3}\-[0-9]{4}$/;
const CPF_REGEX = /^\d{3}\.\d{3}\.\d{3}\-\d{2}$/;
const CNPJ_REGEX = /^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/;
const PASSWORD_MIN_LENGTH = 8;

// Validation messages in Brazilian Portuguese
const VALIDATION_MESSAGES = {
  EMAIL_INVALID: 'Por favor, insira um email válido',
  PASSWORD_WEAK: 'A senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas e números',
  PHONE_INVALID: 'Formato de telefone inválido. Use: (XX) XXXXX-XXXX',
  CPF_INVALID: 'CPF inválido. Verifique o formato e os dígitos verificadores',
  CNPJ_INVALID: 'CNPJ inválido. Verifique o formato e os dígitos verificadores'
} as const;

// Core validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Zod schemas for core validations
export const emailSchema = z.string().email().regex(EMAIL_REGEX, VALIDATION_MESSAGES.EMAIL_INVALID);

export const passwordSchema = z.string()
  .min(PASSWORD_MIN_LENGTH)
  .regex(/[a-z]/, 'Deve conter pelo menos uma letra minúscula')
  .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula')
  .regex(/[0-9]/, 'Deve conter pelo menos um número');

export const phoneSchema = z.string().regex(PHONE_REGEX, VALIDATION_MESSAGES.PHONE_INVALID);

export const cpfSchema = z.string().regex(CPF_REGEX, VALIDATION_MESSAGES.CPF_INVALID);

export const cnpjSchema = z.string().regex(CNPJ_REGEX, VALIDATION_MESSAGES.CNPJ_INVALID);

/**
 * Validates email format using Zod schema
 * @param email - Email to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateEmail(email: string): ValidationResult {
  try {
    emailSchema.parse(email);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return { isValid: false, errors: [VALIDATION_MESSAGES.EMAIL_INVALID] };
  }
}

/**
 * Validates password strength using Zod schema
 * @param password - Password to validate
 * @returns ValidationResult with validation status and errors
 */
export function validatePassword(password: string): ValidationResult {
  try {
    passwordSchema.parse(password);
    return { isValid: true, errors: [] };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => err.message)
      };
    }
    return { isValid: false, errors: [VALIDATION_MESSAGES.PASSWORD_WEAK] };
  }
}

/**
 * Validates Brazilian phone number format
 * @param phoneNumber - Phone number to validate
 * @returns ValidationResult with validation status and errors
 */
export function validatePhoneNumber(phoneNumber: string): ValidationResult {
  try {
    phoneSchema.parse(phoneNumber);
    return { isValid: true, errors: [] };
  } catch (error) {
    return { isValid: false, errors: [VALIDATION_MESSAGES.PHONE_INVALID] };
  }
}

/**
 * Validates Brazilian CPF with check digit verification
 * @param cpf - CPF to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateCPF(cpf: string): ValidationResult {
  try {
    cpfSchema.parse(cpf);
    
    // Remove non-numeric characters
    const numbers = cpf.replace(/\D/g, '');
    
    // Validate check digits
    let sum = 0;
    let remainder: number;
    
    // Validate first check digit
    for (let i = 1; i <= 9; i++) {
      sum += parseInt(numbers.substring(i - 1, i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers.substring(9, 10))) {
      return { isValid: false, errors: [VALIDATION_MESSAGES.CPF_INVALID] };
    }
    
    // Validate second check digit
    sum = 0;
    for (let i = 1; i <= 10; i++) {
      sum += parseInt(numbers.substring(i - 1, i)) * (12 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10 || remainder === 11) remainder = 0;
    if (remainder !== parseInt(numbers.substring(10, 11))) {
      return { isValid: false, errors: [VALIDATION_MESSAGES.CPF_INVALID] };
    }
    
    return { isValid: true, errors: [] };
  } catch (error) {
    return { isValid: false, errors: [VALIDATION_MESSAGES.CPF_INVALID] };
  }
}

/**
 * Validates Brazilian CNPJ with check digit verification
 * @param cnpj - CNPJ to validate
 * @returns ValidationResult with validation status and errors
 */
export function validateCNPJ(cnpj: string): ValidationResult {
  try {
    cnpjSchema.parse(cnpj);
    
    // Remove non-numeric characters
    const numbers = cnpj.replace(/\D/g, '');
    
    // Validate check digits
    let size = 12;
    let pos = size - 7;
    let sum = 0;
    let result: number;

    // Validate first check digit
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(numbers.charAt(size))) {
      return { isValid: false, errors: [VALIDATION_MESSAGES.CNPJ_INVALID] };
    }

    // Validate second check digit
    size = 13;
    pos = size - 7;
    sum = 0;
    for (let i = size; i >= 1; i--) {
      sum += parseInt(numbers.charAt(size - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
    if (result !== parseInt(numbers.charAt(size))) {
      return { isValid: false, errors: [VALIDATION_MESSAGES.CNPJ_INVALID] };
    }

    return { isValid: true, errors: [] };
  } catch (error) {
    return { isValid: false, errors: [VALIDATION_MESSAGES.CNPJ_INVALID] };
  }
}

// Type guard for ValidationResult
export function isValidationResult(obj: unknown): obj is ValidationResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'isValid' in obj &&
    typeof obj.isValid === 'boolean' &&
    'errors' in obj &&
    Array.isArray((obj as ValidationResult).errors) &&
    (obj as ValidationResult).errors.every(error => typeof error === 'string')
  );
}