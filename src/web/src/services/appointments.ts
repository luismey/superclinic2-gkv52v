// @ts-check
import { z } from 'zod'; // v3.22.0
import defu from 'defu'; // v6.1.2
import CryptoJS from 'crypto-js'; // v4.1.1

import api from '../lib/api';
import { API_ENDPOINTS } from '../constants/api';
import { 
  PaginatedResponse, 
  DateRange, 
  dateRangeSchema,
  QueryParams,
  createZodSchema 
} from '../types/common';

// Constants
const ENCRYPTION_KEY = process.env.NEXT_PUBLIC_PATIENT_DATA_KEY || '';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_RETRY_ATTEMPTS = 3;

// Appointment status enum
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
  NO_SHOW = 'no_show'
}

// Appointment type schema with LGPD compliance
export const appointmentSchema = createZodSchema(z.object({
  id: z.string().uuid(),
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  // Encrypted patient data
  encrypted_patient_data: z.string(),
  start_time: z.date(),
  end_time: z.date(),
  status: z.nativeEnum(AppointmentStatus),
  calendar_event_id: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.date(),
  updated_at: z.date(),
}));

export type Appointment = z.infer<typeof appointmentSchema>;

// Form data schema for creating appointments
export const appointmentFormSchema = createZodSchema(z.object({
  patient_id: z.string().uuid(),
  doctor_id: z.string().uuid(),
  patient_data: z.object({
    name: z.string().min(2),
    email: z.string().email(),
    phone: z.string(),
    document: z.string(),
  }),
  start_time: z.date(),
  end_time: z.date(),
  notes: z.string().optional(),
}));

export type AppointmentFormData = z.infer<typeof appointmentFormSchema>;

// Filter schema for appointment queries
export const appointmentFiltersSchema = createZodSchema(z.object({
  status: z.nativeEnum(AppointmentStatus).optional(),
  date_range: dateRangeSchema.optional(),
  doctor_id: z.string().uuid().optional(),
  patient_id: z.string().uuid().optional(),
}));

export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;

/**
 * Encrypts sensitive patient data according to LGPD requirements
 */
const encryptPatientData = (data: AppointmentFormData['patient_data']): string => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Patient data encryption key not configured');
  }
  return CryptoJS.AES.encrypt(JSON.stringify(data), ENCRYPTION_KEY).toString();
};

/**
 * Decrypts patient data with validation
 */
const decryptPatientData = (encryptedData: string): AppointmentFormData['patient_data'] => {
  if (!ENCRYPTION_KEY) {
    throw new Error('Patient data encryption key not configured');
  }
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  return appointmentFormSchema.shape.patient_data.parse(decryptedData);
};

/**
 * Appointments service with LGPD compliance and Google Calendar integration
 */
export const appointmentsService = {
  /**
   * Retrieves paginated list of appointments with decrypted patient data
   */
  async getAppointments(
    filters: AppointmentFilters = {},
    pagination: QueryParams = {}
  ): Promise<PaginatedResponse<Appointment>> {
    // Validate filters
    const validatedFilters = appointmentFiltersSchema.parse(filters);

    try {
      const response = await api.getPaginated<PaginatedResponse<Appointment>>(
        API_ENDPOINTS.APPOINTMENTS.LIST,
        {
          ...pagination,
          filters: validatedFilters
        },
        {
          validateSchema: z.object({
            items: z.array(appointmentSchema),
            total: z.number(),
            page: z.number(),
            page_size: z.number(),
            total_pages: z.number(),
            has_next: z.boolean(),
            has_previous: z.boolean(),
          })
        }
      );

      // Decrypt patient data for each appointment
      return {
        ...response.data,
        items: response.data.items.map(appointment => ({
          ...appointment,
          patient_data: decryptPatientData(appointment.encrypted_patient_data)
        }))
      };
    } catch (error) {
      console.error('Failed to fetch appointments:', error);
      throw error;
    }
  },

  /**
   * Creates a new appointment with Google Calendar sync
   */
  async createAppointment(data: AppointmentFormData): Promise<Appointment> {
    // Validate input data
    const validatedData = appointmentFormSchema.parse(data);

    // Encrypt sensitive patient data
    const encrypted_patient_data = encryptPatientData(validatedData.patient_data);

    try {
      // Check time slot availability first
      const availabilityResponse = await api.get(
        API_ENDPOINTS.APPOINTMENTS.AVAILABILITY,
        {
          params: {
            doctor_id: validatedData.doctor_id,
            start_time: validatedData.start_time.toISOString(),
            end_time: validatedData.end_time.toISOString()
          }
        }
      );

      if (!availabilityResponse.data.available) {
        throw new Error('Time slot is not available');
      }

      // Create appointment with retry logic for Google Calendar sync
      let attempt = 0;
      let lastError: Error | null = null;

      while (attempt < MAX_RETRY_ATTEMPTS) {
        try {
          const response = await api.post<Appointment>(
            API_ENDPOINTS.APPOINTMENTS.SCHEDULE,
            {
              ...validatedData,
              encrypted_patient_data,
              status: AppointmentStatus.SCHEDULED
            },
            { validateSchema: appointmentSchema }
          );

          // Sync with Google Calendar
          await api.post(
            API_ENDPOINTS.APPOINTMENTS.SYNC,
            { appointment_id: response.data.id }
          );

          return {
            ...response.data,
            patient_data: validatedData.patient_data
          };
        } catch (error) {
          lastError = error as Error;
          attempt++;
          if (attempt < MAX_RETRY_ATTEMPTS) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        }
      }

      throw lastError || new Error('Failed to create appointment');
    } catch (error) {
      console.error('Failed to create appointment:', error);
      throw error;
    }
  },

  /**
   * Updates an existing appointment
   */
  async updateAppointment(
    id: string,
    data: Partial<AppointmentFormData>
  ): Promise<Appointment> {
    try {
      const updateData: any = { ...data };
      
      // Encrypt patient data if provided
      if (data.patient_data) {
        updateData.encrypted_patient_data = encryptPatientData(data.patient_data);
        delete updateData.patient_data;
      }

      const response = await api.put<Appointment>(
        `${API_ENDPOINTS.APPOINTMENTS.LIST}/${id}`,
        updateData,
        { validateSchema: appointmentSchema }
      );

      return {
        ...response.data,
        patient_data: decryptPatientData(response.data.encrypted_patient_data)
      };
    } catch (error) {
      console.error('Failed to update appointment:', error);
      throw error;
    }
  },

  /**
   * Cancels an appointment with Google Calendar sync
   */
  async cancelAppointment(id: string, reason?: string): Promise<Appointment> {
    try {
      const response = await api.post<Appointment>(
        API_ENDPOINTS.APPOINTMENTS.CANCEL.replace(':id', id),
        { reason },
        { validateSchema: appointmentSchema }
      );

      // Sync cancellation with Google Calendar
      await api.post(
        API_ENDPOINTS.APPOINTMENTS.SYNC,
        { 
          appointment_id: id,
          action: 'cancel'
        }
      );

      return {
        ...response.data,
        patient_data: decryptPatientData(response.data.encrypted_patient_data)
      };
    } catch (error) {
      console.error('Failed to cancel appointment:', error);
      throw error;
    }
  }
};

export default appointmentsService;