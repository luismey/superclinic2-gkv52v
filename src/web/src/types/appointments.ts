// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseModel, createZodSchema } from './common';

// Global constants for appointment constraints
export const MIN_APPOINTMENT_DURATION_MINUTES = 30;
export const MAX_APPOINTMENT_DURATION_MINUTES = 180;
export const APPOINTMENT_SLOT_INTERVAL_MINUTES = 15;
export const MAX_FUTURE_BOOKING_DAYS = 90;

/**
 * Enumeration of possible appointment statuses
 */
export enum AppointmentStatus {
  SCHEDULED = 'SCHEDULED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED'
}

/**
 * Enumeration of available service types
 */
export enum ServiceType {
  CONSULTATION = 'CONSULTATION',
  FOLLOWUP = 'FOLLOWUP',
  PROCEDURE = 'PROCEDURE',
  EMERGENCY = 'EMERGENCY'
}

/**
 * Enumeration of appointment location types
 */
export enum LocationType {
  IN_PERSON = 'IN_PERSON',
  VIRTUAL = 'VIRTUAL'
}

/**
 * Enumeration of appointment payment statuses
 */
export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  REFUNDED = 'REFUNDED'
}

/**
 * Base interface for appointment data without ID and timestamps
 */
export interface AppointmentBase {
  start_time: Date;
  end_time: Date;
  service_type: ServiceType;
  location_type: LocationType;
  price: number;
  notes: string;
  is_first_visit: boolean;
}

/**
 * Complete appointment interface extending BaseModel and AppointmentBase
 */
export interface Appointment extends BaseModel, AppointmentBase {
  healthcare_provider_id: string;
  patient_id: string;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  calendar_event_id: string;
}

/**
 * Interface for appointment form data with validation rules
 */
export interface AppointmentFormData extends AppointmentBase {
  patient_id: string;
}

// Zod schema for appointment validation
export const appointmentBaseSchema = createZodSchema(
  z.object({
    start_time: z.date(),
    end_time: z.date(),
    service_type: z.nativeEnum(ServiceType),
    location_type: z.nativeEnum(LocationType),
    price: z.number().nonnegative(),
    notes: z.string().max(1000),
    is_first_visit: z.boolean()
  }).refine(
    (data) => {
      const durationMinutes = (data.end_time.getTime() - data.start_time.getTime()) / (1000 * 60);
      return durationMinutes >= MIN_APPOINTMENT_DURATION_MINUTES &&
             durationMinutes <= MAX_APPOINTMENT_DURATION_MINUTES;
    },
    {
      message: `Appointment duration must be between ${MIN_APPOINTMENT_DURATION_MINUTES} and ${MAX_APPOINTMENT_DURATION_MINUTES} minutes`
    }
  ).refine(
    (data) => {
      const minutesSinceStartOfDay = data.start_time.getHours() * 60 + data.start_time.getMinutes();
      return minutesSinceStartOfDay % APPOINTMENT_SLOT_INTERVAL_MINUTES === 0;
    },
    {
      message: `Appointment start time must be aligned to ${APPOINTMENT_SLOT_INTERVAL_MINUTES}-minute intervals`
    }
  )
);

export const appointmentSchema = createZodSchema(
  appointmentBaseSchema.extend({
    healthcare_provider_id: z.string().uuid(),
    patient_id: z.string().uuid(),
    status: z.nativeEnum(AppointmentStatus),
    payment_status: z.nativeEnum(PaymentStatus),
    calendar_event_id: z.string()
  })
);

export const appointmentFormSchema = createZodSchema(
  appointmentBaseSchema.extend({
    patient_id: z.string().uuid()
  }).refine(
    (data) => {
      const maxFutureDate = new Date();
      maxFutureDate.setDate(maxFutureDate.getDate() + MAX_FUTURE_BOOKING_DAYS);
      return data.start_time <= maxFutureDate;
    },
    {
      message: `Appointments cannot be scheduled more than ${MAX_FUTURE_BOOKING_DAYS} days in advance`
    }
  )
);

// Type guards
export const isAppointment = (obj: unknown): obj is Appointment => {
  try {
    appointmentSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
};

export const isAppointmentFormData = (obj: unknown): obj is AppointmentFormData => {
  try {
    appointmentFormSchema.parse(obj);
    return true;
  } catch {
    return false;
  }
};

// Utility types
export type AppointmentUpdate = Partial<AppointmentBase> & {
  status?: AppointmentStatus;
  payment_status?: PaymentStatus;
};

export type AppointmentCreateInput = Omit<Appointment, keyof BaseModel | 'calendar_event_id'>;

export type AppointmentWithPatient = Appointment & {
  patient: {
    id: string;
    name: string;
    phone: string;
  };
};