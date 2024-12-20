import { format } from 'date-fns'; // v2.30.0
import { ptBR } from 'date-fns/locale'; // v2.30.0
import type { DateRange } from '../types/common';

// Constants for formatting configuration
const CURRENCY_LOCALE = 'pt-BR';
const CURRENCY_CODE = 'BRL';
const DECIMAL_PLACES = 2;
const PERCENTAGE_MULTIPLIER = 100;
const PHONE_REGEX = /^\+?55?(\d{2})(9?\d{8})$/;
const FALLBACK_LOCALE = 'en-US';

// Memoized formatter instances for performance
const currencyFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: DECIMAL_PLACES,
  maximumFractionDigits: DECIMAL_PLACES,
});

const numberFormatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: DECIMAL_PLACES,
});

/**
 * Formats a number as Brazilian Real (BRL) currency
 * @param value - Number to format
 * @param includeSymbol - Whether to include the currency symbol
 * @returns Formatted currency string with proper BRL formatting
 */
export function formatCurrency(
  value: number | undefined | null,
  includeSymbol = true
): string {
  try {
    // Handle invalid inputs
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '---';
    }

    // Validate number range
    if (Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      console.warn('Currency value exceeds safe integer range');
      return '---';
    }

    const formatted = currencyFormatter.format(value);
    
    // Remove currency symbol if not requested
    return includeSymbol 
      ? formatted 
      : formatted.replace(/R\$\s?/, '');
  } catch (error) {
    console.error('Error formatting currency:', error);
    return '---';
  }
}

/**
 * Formats a number with Brazilian locale-specific separators
 * @param value - Number to format
 * @param decimals - Number of decimal places
 * @param allowScientific - Whether to allow scientific notation
 * @returns Formatted number string
 */
export function formatNumber(
  value: number | string | undefined,
  decimals = DECIMAL_PLACES,
  allowScientific = false
): string {
  try {
    // Handle invalid inputs
    if (value === undefined || value === '') {
      return '---';
    }

    // Parse string input to number
    const numValue = typeof value === 'string' ? parseFloat(value) : value;

    // Handle special cases
    if (Number.isNaN(numValue) || !Number.isFinite(numValue)) {
      return '---';
    }

    // Handle scientific notation
    if (!allowScientific && Math.abs(numValue) < 1e-6) {
      return '0';
    }

    const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: true,
    });

    return formatter.format(numValue);
  } catch (error) {
    console.error('Error formatting number:', error);
    return '---';
  }
}

/**
 * Formats a percentage value with Brazilian locale
 * @param value - Number to format as percentage
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number | undefined | null,
  decimals = 1
): string {
  try {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return '---';
    }

    const percentValue = value * PERCENTAGE_MULTIPLIER;
    
    const formatter = new Intl.NumberFormat(CURRENCY_LOCALE, {
      style: 'percent',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

    return formatter.format(value);
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return '---';
  }
}

/**
 * Formats a Brazilian phone number
 * @param phoneNumber - Phone number to format
 * @param includeCountryCode - Whether to include +55 country code
 * @returns Formatted phone number string
 */
export function formatPhoneNumber(
  phoneNumber: string,
  includeCountryCode = false
): string {
  try {
    // Remove non-numeric characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Extract components using regex
    const match = cleaned.match(PHONE_REGEX);
    if (!match) {
      return phoneNumber; // Return original if invalid
    }

    const [, areaCode, number] = match;
    
    // Validate area code (11-99)
    if (parseInt(areaCode) < 11 || parseInt(areaCode) > 99) {
      return phoneNumber;
    }

    // Format based on length (with or without 9th digit)
    const formattedNumber = number.length === 9
      ? `${number.slice(0, 5)}-${number.slice(5)}`
      : `${number.slice(0, 4)}-${number.slice(4)}`;

    return includeCountryCode
      ? `+55 (${areaCode}) ${formattedNumber}`
      : `(${areaCode}) ${formattedNumber}`;
  } catch (error) {
    console.error('Error formatting phone number:', error);
    return phoneNumber;
  }
}

/**
 * Formats a date range in Brazilian format
 * @param dateRange - DateRange object containing start and end dates
 * @param showTime - Whether to include time in the format
 * @returns Formatted date range string
 */
export function formatDateRange(
  dateRange: DateRange,
  showTime = false
): string {
  try {
    const { start_date, end_date } = dateRange;
    
    const dateFormat = showTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy';
    
    const formattedStart = format(start_date, dateFormat, { locale: ptBR });
    const formattedEnd = format(end_date, dateFormat, { locale: ptBR });

    return `${formattedStart} - ${formattedEnd}`;
  } catch (error) {
    console.error('Error formatting date range:', error);
    return '---';
  }
}

/**
 * Formats a date in Brazilian format
 * @param date - Date to format
 * @param showTime - Whether to include time
 * @param includeWeekday - Whether to include weekday name
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string | number,
  showTime = false,
  includeWeekday = false
): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;

    if (!dateObj || Number.isNaN(dateObj.getTime())) {
      return '---';
    }

    const dateFormat = [
      includeWeekday ? 'EEEE, ' : '',
      'dd/MM/yyyy',
      showTime ? ' HH:mm' : '',
    ].join('');

    return format(dateObj, dateFormat, { locale: ptBR });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '---';
  }
}

/**
 * Formats a file size in bytes to human readable format
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places
 * @returns Formatted file size string
 */
export function formatFileSize(
  bytes: number,
  decimals = 2
): string {
  try {
    if (bytes === 0) return '0 Bytes';
    if (!bytes || Number.isNaN(bytes)) return '---';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
  } catch (error) {
    console.error('Error formatting file size:', error);
    return '---';
  }
}