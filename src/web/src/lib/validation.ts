// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseModel } from '../types/common';
import { ValidationUtils } from '../utils/validation';

// Error messages in Brazilian Portuguese
const ERROR_MESSAGES = {
  required: 'Campo obrigatório',
  invalid_email: 'Email inválido',
  invalid_password: 'Senha deve ter no mínimo 8 caracteres',
  invalid_phone: 'Número de telefone inválido',
  invalid_cpf: 'CPF inválido',
  invalid_cnpj: 'CNPJ inválido',
  invalid_format: 'Formato inválido',
  invalid_length: 'Comprimento inválido',
  invalid_characters: 'Caracteres inválidos',
  invalid_check_digit: 'Dígito verificador inválido'
} as const;

// Base model schema extending common BaseModel
export const baseModelSchema = z.object({
  id: z.string().uuid(),
  created_at: z.date(),
  updated_at: z.date()
});

// Brazilian format validation schemas
export const brazilianFormatSchemas = {
  cpfSchema: z.string()
    .min(14, ERROR_MESSAGES.invalid_length)
    .max(14, ERROR_MESSAGES.invalid_length)
    .refine(ValidationUtils.validateCPF, {
      message: ERROR_MESSAGES.invalid_cpf
    }),

  cnpjSchema: z.string()
    .min(18, ERROR_MESSAGES.invalid_length)
    .max(18, ERROR_MESSAGES.invalid_length)
    .refine(ValidationUtils.validateCNPJ, {
      message: ERROR_MESSAGES.invalid_cnpj
    }),

  phoneSchema: z.string()
    .min(15, ERROR_MESSAGES.invalid_length)
    .max(15, ERROR_MESSAGES.invalid_length)
    .refine(ValidationUtils.validatePhoneNumber, {
      message: ERROR_MESSAGES.invalid_phone
    })
} as const;

// Validation result interface
export interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
  data: unknown;
}

// Validation options interface
export interface ValidationOptions {
  strict?: boolean;
  customRules?: CustomValidationRule[];
  customMessages?: Record<string, string>;
}

// Custom validation rule interface
interface CustomValidationRule {
  field: string;
  validator: (value: unknown) => boolean;
  message: string;
}

/**
 * Enhanced form validation with Brazilian format support
 * @param schema - Zod schema for validation
 * @param data - Data to validate
 * @param options - Validation options
 * @returns ValidationResult with typed errors
 */
export function validateForm(
  schema: z.ZodSchema,
  data: unknown,
  options: ValidationOptions = {}
): ValidationResult {
  try {
    // Parse and validate using Zod schema
    const validatedData = options.strict 
      ? schema.strict().parse(data)
      : schema.parse(data);

    // Apply custom validation rules if provided
    const customErrors: Record<string, string> = {};
    if (options.customRules) {
      for (const rule of options.customRules) {
        const value = (data as Record<string, unknown>)[rule.field];
        if (!rule.validator(value)) {
          customErrors[rule.field] = rule.message;
        }
      }
    }

    // Return success if no custom errors
    if (Object.keys(customErrors).length === 0) {
      return {
        success: true,
        errors: {},
        data: validatedData
      };
    }

    // Return with custom errors
    return {
      success: false,
      errors: customErrors,
      data: null
    };

  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        const message = options.customMessages?.[path] || err.message;
        errors[path] = message;
      });

      return {
        success: false,
        errors,
        data: null
      };
    }

    // Handle unexpected errors
    return {
      success: false,
      errors: { _error: 'Erro de validação inesperado' },
      data: null
    };
  }
}

// Helper function to create form field schema with Brazilian validation
export function createFieldSchema<T extends z.ZodType>(
  fieldSchema: T,
  options: {
    required?: boolean;
    customValidator?: (value: unknown) => boolean;
    customMessage?: string;
  } = {}
): z.ZodType {
  let schema = fieldSchema;

  if (options.required) {
    schema = schema.required_error(ERROR_MESSAGES.required);
  } else {
    schema = schema.optional();
  }

  if (options.customValidator) {
    schema = schema.refine(options.customValidator, {
      message: options.customMessage || ERROR_MESSAGES.invalid_format
    });
  }

  return schema;
}

// Common field schemas with Brazilian format support
export const commonFieldSchemas = {
  email: createFieldSchema(
    z.string().email(ERROR_MESSAGES.invalid_email)
      .refine(ValidationUtils.validateEmail, {
        message: ERROR_MESSAGES.invalid_email
      })
  ),

  password: createFieldSchema(
    z.string()
      .min(8, ERROR_MESSAGES.invalid_password)
      .refine(ValidationUtils.validatePassword, {
        message: ERROR_MESSAGES.invalid_password
      })
  ),

  phone: createFieldSchema(brazilianFormatSchemas.phoneSchema),
  cpf: createFieldSchema(brazilianFormatSchemas.cpfSchema),
  cnpj: createFieldSchema(brazilianFormatSchemas.cnpjSchema),

  date: createFieldSchema(
    z.date().refine((date) => !isNaN(date.getTime()), {
      message: ERROR_MESSAGES.invalid_format
    })
  ),

  currency: createFieldSchema(
    z.string().regex(/^\d+(\.\d{2})?$/, ERROR_MESSAGES.invalid_format)
  )
} as const;

// Export validation utilities namespace
export const ValidationUtils = {
  validateEmail: ValidationUtils.validateEmail,
  validatePassword: ValidationUtils.validatePassword,
  validatePhoneNumber: ValidationUtils.validatePhoneNumber,
  validateCPF: ValidationUtils.validateCPF,
  validateCNPJ: ValidationUtils.validateCNPJ
} as const;