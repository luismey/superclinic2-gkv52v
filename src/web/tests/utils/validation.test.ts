// @ts-check
import { describe, test, expect } from '@jest/globals'; // v29.x
import {
  ValidationResult,
  validateEmail,
  validatePassword,
  validatePhoneNumber,
  validateCPF,
  validateCNPJ
} from '../../src/utils/validation';

// Test timeout configuration
jest.setTimeout(5000);

describe('Email Validation', () => {
  test('should validate correct email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@domain.com.br',
      'user+label@gmail.com',
      'first.last@subdomain.domain.com'
    ];

    validEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject invalid email formats', () => {
    const invalidEmails = [
      'invalid@email',
      '@domain.com',
      'user@.com',
      'user@domain.',
      'user name@domain.com',
      'user@domain..com'
    ];

    invalidEmails.forEach(email => {
      const result = validateEmail(email);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Por favor, insira um email válido');
    });
  });

  test('should handle edge cases', () => {
    const edgeCases = ['', ' ', null, undefined];

    edgeCases.forEach(email => {
      const result = validateEmail(email as string);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Password Validation', () => {
  test('should validate strong passwords', () => {
    const validPasswords = [
      'StrongPass123',
      'Complex1Password',
      'Secure123Password',
      'ValidP@ssw0rd'
    ];

    validPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject weak passwords', () => {
    const weakPasswords = [
      'short1',           // Too short
      'onlylowercase',    // No uppercase or numbers
      'ONLYUPPERCASE',    // No lowercase or numbers
      '12345678',         // Only numbers
      'NoNumbers',        // No numbers
      'no_uppercase1'     // No uppercase
    ];

    weakPasswords.forEach(password => {
      const result = validatePassword(password);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  test('should validate password length requirements', () => {
    const result = validatePassword('Short1');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('A senha deve conter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas e números');
  });
});

describe('Phone Number Validation', () => {
  test('should validate correct Brazilian phone formats', () => {
    const validPhones = [
      '(11) 99999-9999',  // Mobile SP
      '(21) 98888-8888',  // Mobile RJ
      '(47) 98777-7777',  // Mobile SC
      '(11) 3333-3333'    // Landline
    ];

    validPhones.forEach(phone => {
      const result = validatePhoneNumber(phone);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject invalid phone formats', () => {
    const invalidPhones = [
      '11999999999',      // No formatting
      '(11)99999-9999',   // No space after DDD
      '(11) 999999999',   // No hyphen
      '(00) 99999-9999',  // Invalid DDD
      '(11) 9999-9999',   // Old mobile format
      '(11) 99999-999'    // Incomplete number
    ];

    invalidPhones.forEach(phone => {
      const result = validatePhoneNumber(phone);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Formato de telefone inválido. Use: (XX) XXXXX-XXXX');
    });
  });
});

describe('CPF Validation', () => {
  test('should validate correct CPF formats', () => {
    const validCPFs = [
      '123.456.789-09',
      '987.654.321-00',
      '111.222.333-96'
    ];

    validCPFs.forEach(cpf => {
      const result = validateCPF(cpf);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject invalid CPF formats', () => {
    const invalidCPFs = [
      '123.456.789-00',   // Invalid check digit
      '111.111.111-11',   // Repeated numbers
      '123.456.789',      // Incomplete
      '12345678909',      // No formatting
      '123.456.789-0A'    // Invalid characters
    ];

    invalidCPFs.forEach(cpf => {
      const result = validateCPF(cpf);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CPF inválido. Verifique o formato e os dígitos verificadores');
    });
  });

  test('should validate CPF check digits', () => {
    // Test with known valid check digits
    const result = validateCPF('123.456.789-09');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('CNPJ Validation', () => {
  test('should validate correct CNPJ formats', () => {
    const validCNPJs = [
      '12.345.678/0001-90',
      '98.765.432/0001-10',
      '11.222.333/0001-81'
    ];

    validCNPJs.forEach(cnpj => {
      const result = validateCNPJ(cnpj);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  test('should reject invalid CNPJ formats', () => {
    const invalidCNPJs = [
      '12.345.678/0001-00',   // Invalid check digit
      '11.111.111/1111-11',   // Repeated numbers
      '12.345.678/0001',      // Incomplete
      '12345678000190',       // No formatting
      '12.345.678/0001-9A'    // Invalid characters
    ];

    invalidCNPJs.forEach(cnpj => {
      const result = validateCNPJ(cnpj);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('CNPJ inválido. Verifique o formato e os dígitos verificadores');
    });
  });

  test('should validate CNPJ check digits', () => {
    // Test with known valid check digits
    const result = validateCNPJ('12.345.678/0001-90');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe('Validation Result Type Safety', () => {
  test('should return properly typed validation results', () => {
    const emailResult = validateEmail('test@example.com');
    const passwordResult = validatePassword('StrongPass123');
    const phoneResult = validatePhoneNumber('(11) 99999-9999');
    const cpfResult = validateCPF('123.456.789-09');
    const cnpjResult = validateCNPJ('12.345.678/0001-90');

    const results: ValidationResult[] = [
      emailResult,
      passwordResult,
      phoneResult,
      cpfResult,
      cnpjResult
    ];

    results.forEach(result => {
      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.isValid).toBe('boolean');
    });
  });
});