/**
 * @fileoverview Date utility module for Porfin platform
 * Provides comprehensive date handling with Brazilian locale and timezone support
 * @version 1.0.0
 */

import { format } from 'date-fns'; // v2.30.0
import { ptBR } from 'date-fns/locale'; // v2.30.0
import { memoize } from 'lodash'; // v4.17.21
import { DateRange } from '../types/common';

// Constants for business hours and timezone configuration
export const BUSINESS_HOURS_START = 8;
export const BUSINESS_HOURS_END = 18;
export const TIMEZONE = 'America/Sao_Paulo';
export const MIN_APPOINTMENT_DURATION = 30; // minutes
export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy';
export const DEFAULT_TIME_FORMAT = 'HH:mm';

// Brazilian holidays (static for example - should be fetched from API in production)
const BRAZILIAN_HOLIDAYS = new Set([
  '2024-01-01', // Ano Novo
  '2024-02-12', // Carnaval
  '2024-02-13', // Carnaval
  '2024-03-29', // Sexta-feira Santa
  '2024-04-21', // Tiradentes
  '2024-05-01', // Dia do Trabalho
  // Add more holidays as needed
]);

/**
 * Memoized date formatter with Brazilian locale support
 * @param date - Date to format
 * @param formatStr - Format string (defaults to DEFAULT_DATE_FORMAT)
 * @returns Formatted date string in Brazilian Portuguese
 * @throws {Error} If date is invalid
 */
export const formatDate = memoize((date: Date, formatStr: string = DEFAULT_DATE_FORMAT): string => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to formatDate');
  }

  try {
    return format(date, formatStr, {
      locale: ptBR,
      timeZone: TIMEZONE,
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    throw new Error('Failed to format date');
  }
}, (date: Date, formatStr: string) => `${date.getTime()}-${formatStr}`);

/**
 * Checks if a given time is within business hours
 * Considers Brazilian timezone and holidays
 * @param date - Date to check
 * @returns Boolean indicating if time is within business hours
 */
export const isBusinessHours = (date: Date): boolean => {
  if (!date || !(date instanceof Date)) {
    return false;
  }

  const localDate = getLocalTime(date);
  const hour = localDate.getHours();
  const dayOfWeek = localDate.getDay();
  
  // Check if it's weekend
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }

  // Check if it's a holiday
  const dateString = format(localDate, 'yyyy-MM-dd');
  if (BRAZILIAN_HOLIDAYS.has(dateString)) {
    return false;
  }

  return hour >= BUSINESS_HOURS_START && hour < BUSINESS_HOURS_END;
};

/**
 * Creates a DateRange object for analytics periods
 * @param period - Period identifier ('today', 'week', 'month', 'custom')
 * @param timezone - Timezone (defaults to TIMEZONE)
 * @returns DateRange object with start and end dates
 */
export const getDateRange = (period: string, timezone: string = TIMEZONE): DateRange => {
  const now = new Date();
  const localNow = getLocalTime(now);
  let start = new Date(localNow);
  let end = new Date(localNow);

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'week':
      start.setDate(localNow.getDate() - localNow.getDay());
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'custom':
      // Custom period should be handled by passing explicit start/end dates
      throw new Error('Custom period requires explicit date range');
    default:
      throw new Error('Invalid period specified');
  }

  return {
    start_date: start,
    end_date: end,
    timezone,
  };
};

/**
 * Validates appointment duration and business hours
 * @param startTime - Appointment start time
 * @param endTime - Appointment end time
 * @returns Boolean indicating if appointment duration is valid
 */
export const validateAppointmentDuration = (startTime: Date, endTime: Date): boolean => {
  if (!startTime || !endTime || !(startTime instanceof Date) || !(endTime instanceof Date)) {
    return false;
  }

  const localStart = getLocalTime(startTime);
  const localEnd = getLocalTime(endTime);

  // Check if both times are within business hours
  if (!isBusinessHours(localStart) || !isBusinessHours(localEnd)) {
    return false;
  }

  // Calculate duration in minutes
  const durationMinutes = (localEnd.getTime() - localStart.getTime()) / (1000 * 60);

  // Validate minimum duration
  if (durationMinutes < MIN_APPOINTMENT_DURATION) {
    return false;
  }

  // Validate end time is after start time
  if (localEnd <= localStart) {
    return false;
  }

  return true;
};

/**
 * Converts UTC date to Brazilian local time with DST handling
 * @param date - UTC date to convert
 * @returns Date adjusted to Brazilian timezone
 * @throws {Error} If date is invalid
 */
export const getLocalTime = (date: Date): Date => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    throw new Error('Invalid date provided to getLocalTime');
  }

  try {
    // Create a new date object to avoid mutating the input
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }));
    
    // Adjust for DST if necessary
    const isDST = () => {
      const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
      const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
      return Math.max(jan, jul) !== date.getTimezoneOffset();
    };

    if (isDST()) {
      localDate.setHours(localDate.getHours() + 1);
    }

    return localDate;
  } catch (error) {
    console.error('Error converting to local time:', error);
    throw new Error('Failed to convert to local time');
  }
};

// Type guard for DateRange validation
export const isValidDateRange = (range: DateRange): boolean => {
  return (
    range.start_date instanceof Date &&
    range.end_date instanceof Date &&
    !isNaN(range.start_date.getTime()) &&
    !isNaN(range.end_date.getTime()) &&
    range.start_date <= range.end_date &&
    typeof range.timezone === 'string' &&
    range.timezone.length > 0
  );
};