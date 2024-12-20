import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'; // v29.x
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
  formatPhoneNumber,
  truncateText
} from '../../src/utils/format';

// Mock Intl.NumberFormat for consistent test results
const mockFormat = jest.fn();
const originalIntl = global.Intl;

beforeEach(() => {
  global.Intl = {
    ...originalIntl,
    NumberFormat: jest.fn().mockImplementation(() => ({
      format: mockFormat
    }))
  } as typeof global.Intl;
});

afterEach(() => {
  global.Intl = originalIntl;
  jest.clearAllMocks();
});

describe('formatCurrency', () => {
  it('should format positive numbers with BRL currency symbol', () => {
    mockFormat.mockReturnValue('R$ 1.234,56');
    expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
    expect(mockFormat).toHaveBeenCalledWith(1234.56);
  });

  it('should format negative numbers with correct symbol placement', () => {
    mockFormat.mockReturnValue('-R$ 1.234,56');
    expect(formatCurrency(-1234.56)).toBe('-R$ 1.234,56');
    expect(mockFormat).toHaveBeenCalledWith(-1234.56);
  });

  it('should format zero value correctly', () => {
    mockFormat.mockReturnValue('R$ 0,00');
    expect(formatCurrency(0)).toBe('R$ 0,00');
    expect(mockFormat).toHaveBeenCalledWith(0);
  });

  it('should handle undefined and null values', () => {
    expect(formatCurrency(undefined)).toBe('---');
    expect(formatCurrency(null)).toBe('---');
  });

  it('should format without currency symbol when specified', () => {
    mockFormat.mockReturnValue('R$ 1.234,56');
    expect(formatCurrency(1234.56, false)).toBe('1.234,56');
  });

  it('should handle very large numbers appropriately', () => {
    const largeNumber = Number.MAX_SAFE_INTEGER + 1;
    expect(formatCurrency(largeNumber)).toBe('---');
  });
});

describe('formatNumber', () => {
  it('should format integers with thousand separators', () => {
    mockFormat.mockReturnValue('1.234.567');
    expect(formatNumber(1234567, 0)).toBe('1.234.567');
    expect(mockFormat).toHaveBeenCalledWith(1234567);
  });

  it('should format decimal numbers with specified precision', () => {
    mockFormat.mockReturnValue('1.234,567');
    expect(formatNumber(1234.5674, 3)).toBe('1.234,567');
    expect(mockFormat).toHaveBeenCalledWith(1234.5674);
  });

  it('should handle string number inputs', () => {
    mockFormat.mockReturnValue('1.234,56');
    expect(formatNumber('1234.56')).toBe('1.234,56');
  });

  it('should handle invalid inputs', () => {
    expect(formatNumber(undefined)).toBe('---');
    expect(formatNumber('')).toBe('---');
    expect(formatNumber('invalid')).toBe('---');
  });

  it('should handle very small numbers when scientific notation is disabled', () => {
    expect(formatNumber(1e-7, 2, false)).toBe('0');
  });
});

describe('formatPercentage', () => {
  it('should format decimal values as percentages', () => {
    mockFormat.mockReturnValue('45,0%');
    expect(formatPercentage(0.45)).toBe('45,0%');
    expect(mockFormat).toHaveBeenCalledWith(0.45);
  });

  it('should format whole numbers correctly', () => {
    mockFormat.mockReturnValue('100,0%');
    expect(formatPercentage(1)).toBe('100,0%');
    expect(mockFormat).toHaveBeenCalledWith(1);
  });

  it('should handle custom decimal places', () => {
    mockFormat.mockReturnValue('45,00%');
    expect(formatPercentage(0.45, 2)).toBe('45,00%');
  });

  it('should handle negative percentages', () => {
    mockFormat.mockReturnValue('-45,0%');
    expect(formatPercentage(-0.45)).toBe('-45,0%');
    expect(mockFormat).toHaveBeenCalledWith(-0.45);
  });

  it('should handle invalid inputs', () => {
    expect(formatPercentage(undefined)).toBe('---');
    expect(formatPercentage(null)).toBe('---');
    expect(formatPercentage(NaN)).toBe('---');
  });
});

describe('formatPhoneNumber', () => {
  it('should format mobile numbers correctly', () => {
    expect(formatPhoneNumber('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhoneNumber('5511987654321')).toBe('(11) 98765-4321');
  });

  it('should format landline numbers correctly', () => {
    expect(formatPhoneNumber('1134567890')).toBe('(11) 3456-7890');
    expect(formatPhoneNumber('551134567890')).toBe('(11) 3456-7890');
  });

  it('should handle numbers with country code', () => {
    expect(formatPhoneNumber('11987654321', true)).toBe('+55 (11) 98765-4321');
  });

  it('should preserve original input for invalid numbers', () => {
    expect(formatPhoneNumber('invalid')).toBe('invalid');
    expect(formatPhoneNumber('123')).toBe('123');
  });

  it('should handle numbers with different area codes', () => {
    expect(formatPhoneNumber('21987654321')).toBe('(21) 98765-4321');
    expect(formatPhoneNumber('8134567890')).toBe('(81) 3456-7890');
  });

  it('should reject invalid area codes', () => {
    expect(formatPhoneNumber('00987654321')).toBe('00987654321');
    expect(formatPhoneNumber('99987654321')).toBe('99987654321');
  });
});

describe('truncateText', () => {
  // Note: This function wasn't in the original utils/format.ts file
  // Adding tests for completeness based on requirements
  
  it('should truncate text longer than specified length', () => {
    const longText = 'Este é um texto muito longo que precisa ser truncado';
    expect(truncateText(longText, 20)).toBe('Este é um texto mui...');
  });

  it('should not truncate text shorter than specified length', () => {
    const shortText = 'Texto curto';
    expect(truncateText(shortText, 20)).toBe('Texto curto');
  });

  it('should handle empty strings', () => {
    expect(truncateText('', 20)).toBe('');
  });

  it('should handle undefined input', () => {
    expect(truncateText(undefined, 20)).toBe('');
  });

  it('should handle special characters correctly', () => {
    const specialText = 'Olá, João! Como você está?';
    expect(truncateText(specialText, 10)).toBe('Olá, João...');
  });

  it('should preserve word boundaries when possible', () => {
    const text = 'Uma frase com várias palavras';
    expect(truncateText(text, 15, true)).toBe('Uma frase com...');
  });
});