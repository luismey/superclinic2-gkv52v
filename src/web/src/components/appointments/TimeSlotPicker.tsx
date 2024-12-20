// @ts-check
import React, { useMemo, useCallback } from 'react';
import { format, isWithinInterval, addMinutes, setMinutes, setHours } from 'date-fns'; // v2.30.0
import { ptBR } from 'date-fns/locale'; // v2.30.0
import { isHoliday } from '@date/holidays-br'; // v1.0.0
import Select from '../common/Select';
import type { AppointmentBase } from '../../types/appointments';

// Constants for Brazilian business hours
const BUSINESS_HOURS = {
  START: 8, // 8:00
  END: 18,  // 18:00
  LUNCH_START: 12, // 12:00
  LUNCH_END: 13,   // 13:00
} as const;

const SLOT_INTERVAL = 30; // 30-minute slots

interface TimeSlotPickerProps {
  selectedDate: Date;
  selectedTime: string;
  existingAppointments: AppointmentBase[];
  duration: number;
  onChange: (time: string) => void;
  error?: string;
  allowEmergency?: boolean;
  region?: string;
}

/**
 * Checks if a time slot is within lunch break (12:00-13:00)
 * @param date - Date to check
 * @returns boolean indicating if time is during lunch break
 */
const isLunchBreak = (date: Date): boolean => {
  const hours = date.getHours();
  return hours >= BUSINESS_HOURS.LUNCH_START && hours < BUSINESS_HOURS.LUNCH_END;
};

/**
 * Checks if a time slot is within business hours (8:00-18:00)
 * @param date - Date to check
 * @returns boolean indicating if time is during business hours
 */
const isBusinessHours = (date: Date): boolean => {
  const hours = date.getHours();
  return hours >= BUSINESS_HOURS.START && hours < BUSINESS_HOURS.END;
};

/**
 * Checks if a slot is available based on existing appointments
 * @param slotStart - Start time of slot
 * @param slotEnd - End time of slot
 * @param existingAppointments - List of existing appointments
 * @param allowEmergency - Whether to allow emergency slots
 * @returns boolean indicating slot availability
 */
const isSlotAvailable = (
  slotStart: Date,
  slotEnd: Date,
  existingAppointments: AppointmentBase[],
  allowEmergency: boolean = false
): boolean => {
  // Allow emergency slots outside business hours if enabled
  if (!isBusinessHours(slotStart) && !allowEmergency) {
    return false;
  }

  // Block lunch break slots unless it's an emergency
  if (isLunchBreak(slotStart) && !allowEmergency) {
    return false;
  }

  // Check for conflicts with existing appointments
  return !existingAppointments.some(appointment =>
    isWithinInterval(slotStart, {
      start: appointment.start_time,
      end: appointment.end_time
    }) ||
    isWithinInterval(slotEnd, {
      start: appointment.start_time,
      end: appointment.end_time
    })
  );
};

/**
 * Generates available time slots for the selected date
 * @param date - Selected date
 * @param duration - Appointment duration in minutes
 * @param existingAppointments - List of existing appointments
 * @param allowEmergency - Whether to allow emergency slots
 * @param region - Brazilian region for holiday checking
 * @returns Array of available time slots
 */
const generateTimeSlots = (
  date: Date,
  duration: number,
  existingAppointments: AppointmentBase[],
  allowEmergency: boolean = false,
  region?: string
): Array<{ value: string; label: string }> => {
  const slots: Array<{ value: string; label: string }> = [];
  
  // Check if date is a holiday
  if (region && isHoliday(date, region) && !allowEmergency) {
    return slots;
  }

  // Start from beginning of day
  let currentSlot = setMinutes(setHours(date, BUSINESS_HOURS.START), 0);
  const dayEnd = setHours(date, BUSINESS_HOURS.END);

  while (currentSlot < dayEnd) {
    const slotEnd = addMinutes(currentSlot, duration);
    
    if (isSlotAvailable(currentSlot, slotEnd, existingAppointments, allowEmergency)) {
      slots.push({
        value: format(currentSlot, 'HH:mm'),
        label: format(currentSlot, "HH:mm", { locale: ptBR }),
      });
    }
    
    currentSlot = addMinutes(currentSlot, SLOT_INTERVAL);
  }

  return slots;
};

/**
 * TimeSlotPicker component for selecting appointment time slots
 * Supports Brazilian business hours, holidays, and lunch breaks
 */
const TimeSlotPicker: React.FC<TimeSlotPickerProps> = ({
  selectedDate,
  selectedTime,
  existingAppointments,
  duration,
  onChange,
  error,
  allowEmergency = false,
  region = 'BR'
}) => {
  // Generate available time slots
  const availableSlots = useMemo(() => 
    generateTimeSlots(
      selectedDate,
      duration,
      existingAppointments,
      allowEmergency,
      region
    ),
    [selectedDate, duration, existingAppointments, allowEmergency, region]
  );

  // Handle time selection change
  const handleTimeChange = useCallback((time: string) => {
    onChange(time);
  }, [onChange]);

  return (
    <Select
      name="timeSlot"
      label="Horário da Consulta"
      value={selectedTime}
      onChange={handleTimeChange}
      options={availableSlots}
      placeholder="Selecione um horário"
      error={error}
      required
      aria-label="Selecione o horário da consulta"
      aria-describedby={error ? 'timeSlot-error' : undefined}
    />
  );
};

export default TimeSlotPicker;