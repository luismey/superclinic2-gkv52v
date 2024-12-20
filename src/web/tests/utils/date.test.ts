import { describe, test, expect } from '@jest/globals'; // v29.x
import MockDate from 'jest-mock-date'; // v1.x
import timezoneMock from 'timezone-mock'; // v1.x

import {
  formatDate,
  isBusinessHours,
  getDateRange,
  validateAppointmentDuration,
  getLocalTime,
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  TIMEZONE,
  MIN_APPOINTMENT_DURATION
} from '../../src/utils/date';

// Set up timezone mocking
beforeAll(() => {
  timezoneMock.register('America/Sao_Paulo');
});

afterAll(() => {
  timezoneMock.unregister();
});

// Reset date mocks and clear memoization cache before each test
beforeEach(() => {
  MockDate.reset();
  // Clear memoization cache by calling functions with different params
  formatDate(new Date(), 'test');
});

describe('formatDate', () => {
  test('formats date in Brazilian format (dd/MM/yyyy)', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('15/01/2024');
  });

  test('formats time in 24-hour format', () => {
    const date = new Date('2024-01-15T14:30:00Z');
    expect(formatDate(date, 'HH:mm')).toBe('11:30'); // -3 hours for São Paulo
  });

  test('handles DST transitions correctly', () => {
    // Brazilian DST start (first Sunday of November)
    const dstStart = new Date('2024-11-03T03:00:00Z');
    expect(formatDate(dstStart, 'HH:mm')).toBe('00:00');

    // Brazilian DST end (third Sunday of February)
    const dstEnd = new Date('2024-02-18T02:00:00Z');
    expect(formatDate(dstEnd, 'HH:mm')).toBe('23:00');
  });

  test('throws error for invalid date', () => {
    expect(() => formatDate(new Date('invalid'))).toThrow('Invalid date provided to formatDate');
  });

  test('memoizes results for performance', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    const firstCall = formatDate(date);
    const secondCall = formatDate(date);
    expect(firstCall).toBe(secondCall);
  });
});

describe('isBusinessHours', () => {
  test('returns true for valid business hours', () => {
    const businessHour = new Date('2024-01-15T12:00:00Z'); // 09:00 São Paulo time
    expect(isBusinessHours(businessHour)).toBe(true);
  });

  test('returns false for hours outside business hours', () => {
    const earlyHour = new Date('2024-01-15T10:00:00Z'); // 07:00 São Paulo time
    const lateHour = new Date('2024-01-15T22:00:00Z'); // 19:00 São Paulo time
    expect(isBusinessHours(earlyHour)).toBe(false);
    expect(isBusinessHours(lateHour)).toBe(false);
  });

  test('returns false for weekends', () => {
    const saturday = new Date('2024-01-13T15:00:00Z'); // Saturday
    const sunday = new Date('2024-01-14T15:00:00Z'); // Sunday
    expect(isBusinessHours(saturday)).toBe(false);
    expect(isBusinessHours(sunday)).toBe(false);
  });

  test('returns false for Brazilian holidays', () => {
    const newYear = new Date('2024-01-01T15:00:00Z'); // Ano Novo
    const carnival = new Date('2024-02-12T15:00:00Z'); // Carnaval
    expect(isBusinessHours(newYear)).toBe(false);
    expect(isBusinessHours(carnival)).toBe(false);
  });

  test('handles DST transitions correctly', () => {
    const dstTransition = new Date('2024-11-03T11:00:00Z'); // During DST transition
    expect(isBusinessHours(dstTransition)).toBe(true);
  });
});

describe('getDateRange', () => {
  test('returns correct daily range', () => {
    MockDate.set('2024-01-15T15:00:00Z');
    const range = getDateRange('today');
    
    expect(range.start_date.getHours()).toBe(0);
    expect(range.start_date.getMinutes()).toBe(0);
    expect(range.end_date.getHours()).toBe(23);
    expect(range.end_date.getMinutes()).toBe(59);
    expect(range.timezone).toBe(TIMEZONE);
  });

  test('returns correct weekly range', () => {
    MockDate.set('2024-01-15T15:00:00Z'); // Tuesday
    const range = getDateRange('week');
    
    expect(range.start_date.getDay()).toBe(0); // Sunday
    expect(range.end_date.getDay()).toBe(6); // Saturday
    expect(range.start_date.getHours()).toBe(0);
    expect(range.end_date.getHours()).toBe(23);
  });

  test('returns correct monthly range', () => {
    MockDate.set('2024-01-15T15:00:00Z');
    const range = getDateRange('month');
    
    expect(range.start_date.getDate()).toBe(1);
    expect(range.end_date.getDate()).toBe(31); // January has 31 days
    expect(range.start_date.getHours()).toBe(0);
    expect(range.end_date.getHours()).toBe(23);
  });

  test('throws error for invalid period', () => {
    expect(() => getDateRange('invalid')).toThrow('Invalid period specified');
  });

  test('throws error for custom period without dates', () => {
    expect(() => getDateRange('custom')).toThrow('Custom period requires explicit date range');
  });
});

describe('validateAppointmentDuration', () => {
  test('validates minimum appointment duration', () => {
    const start = new Date('2024-01-15T15:00:00Z'); // 12:00 São Paulo time
    const endValid = new Date('2024-01-15T15:30:00Z'); // 30 minutes
    const endInvalid = new Date('2024-01-15T15:29:00Z'); // 29 minutes
    
    expect(validateAppointmentDuration(start, endValid)).toBe(true);
    expect(validateAppointmentDuration(start, endInvalid)).toBe(false);
  });

  test('validates business hours compliance', () => {
    const startEarly = new Date('2024-01-15T10:00:00Z'); // 07:00 São Paulo time
    const startValid = new Date('2024-01-15T12:00:00Z'); // 09:00 São Paulo time
    const endValid = new Date('2024-01-15T12:30:00Z'); // 09:30 São Paulo time
    
    expect(validateAppointmentDuration(startEarly, endValid)).toBe(false);
    expect(validateAppointmentDuration(startValid, endValid)).toBe(true);
  });

  test('handles DST transitions', () => {
    const startDST = new Date('2024-11-03T11:00:00Z'); // During DST
    const endDST = new Date('2024-11-03T11:30:00Z');
    expect(validateAppointmentDuration(startDST, endDST)).toBe(true);
  });

  test('validates end time after start time', () => {
    const start = new Date('2024-01-15T15:00:00Z');
    const end = new Date('2024-01-15T14:00:00Z'); // Before start
    expect(validateAppointmentDuration(start, end)).toBe(false);
  });
});

describe('getLocalTime', () => {
  test('converts UTC to São Paulo time correctly', () => {
    const utcDate = new Date('2024-01-15T15:00:00Z');
    const localDate = getLocalTime(utcDate);
    expect(localDate.getHours()).toBe(12); // -3 hours for São Paulo
  });

  test('handles DST transitions correctly', () => {
    // DST start
    const dstStart = new Date('2024-11-03T03:00:00Z');
    const localDSTStart = getLocalTime(dstStart);
    expect(localDSTStart.getHours()).toBe(0);

    // DST end
    const dstEnd = new Date('2024-02-18T02:00:00Z');
    const localDSTEnd = getLocalTime(dstEnd);
    expect(localDSTEnd.getHours()).toBe(23);
  });

  test('maintains date immutability', () => {
    const originalDate = new Date('2024-01-15T15:00:00Z');
    const originalTime = originalDate.getTime();
    getLocalTime(originalDate);
    expect(originalDate.getTime()).toBe(originalTime);
  });

  test('throws error for invalid date', () => {
    expect(() => getLocalTime(new Date('invalid'))).toThrow('Invalid date provided to getLocalTime');
  });

  test('handles large datasets efficiently', () => {
    const dates = Array.from({ length: 1000 }, (_, i) => 
      new Date(2024, 0, 1 + Math.floor(i / 24), i % 24));
    
    const startTime = performance.now();
    dates.forEach(date => getLocalTime(date));
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(1000); // Should process 1000 dates in less than 1 second
  });
});