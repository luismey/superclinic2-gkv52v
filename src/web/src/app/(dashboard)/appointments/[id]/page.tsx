'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

import AppointmentForm from '@/components/appointments/AppointmentForm';
import { appointmentsService } from '@/services/appointments';
import { useToast } from '@/hooks/useToast';
import type { Appointment, AppointmentFormData } from '@/types/appointments';
import Loading from '@/components/common/Loading';

// Brazilian timezone constant
const TIMEZONE = 'America/Sao_Paulo';

interface AppointmentPageProps {
  params: {
    id: string;
  };
}

/**
 * Page component for viewing and editing individual healthcare appointments
 * Implements LGPD compliance and Brazilian healthcare regulations
 */
const AppointmentPage: React.FC<AppointmentPageProps> = ({ params }) => {
  const router = useRouter();
  const { showToast } = useToast();
  
  // State management
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);

  // Business hours configuration for Brazilian healthcare
  const businessHours = {
    start: 8,  // 8:00
    end: 18,   // 18:00
    lunchStart: 12, // 12:00
    lunchEnd: 13,   // 13:00
  };

  /**
   * Fetches appointment details with LGPD compliance
   */
  const fetchAppointmentDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await appointmentsService.getAppointmentById(params.id);
      
      // Convert dates to Brazilian timezone
      const appointment = {
        ...response.data,
        start_time: parseISO(response.data.start_time.toString()),
        end_time: parseISO(response.data.end_time.toString()),
      };
      
      setAppointment(appointment);

      // Fetch other appointments for availability checking
      const existingResponse = await appointmentsService.getAppointments({
        date_range: {
          start_date: appointment.start_time,
          end_date: appointment.end_time,
          timezone: TIMEZONE,
        },
      });
      
      setExistingAppointments(existingResponse.data.items.filter(apt => apt.id !== params.id));
    } catch (error) {
      showToast({
        message: 'Erro ao carregar consulta. Tente novamente.',
        type: 'error',
      });
      router.push('/appointments');
    } finally {
      setLoading(false);
    }
  }, [params.id, router, showToast]);

  useEffect(() => {
    fetchAppointmentDetails();
  }, [fetchAppointmentDetails]);

  /**
   * Handles form submission with validation and LGPD compliance
   */
  const handleSubmit = async (formData: AppointmentFormData) => {
    try {
      setSubmitting(true);

      await appointmentsService.updateAppointment(params.id, {
        ...formData,
        start_time: format(formData.start_time, "yyyy-MM-dd'T'HH:mm:ssxxx", {
          timeZone: TIMEZONE,
        }),
        end_time: format(formData.end_time, "yyyy-MM-dd'T'HH:mm:ssxxx", {
          timeZone: TIMEZONE,
        }),
      });

      showToast({
        message: 'Consulta atualizada com sucesso',
        type: 'success',
      });

      router.push('/appointments');
    } catch (error) {
      showToast({
        message: 'Erro ao atualizar consulta. Tente novamente.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handles appointment deletion with LGPD compliance
   */
  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja cancelar esta consulta?')) {
      return;
    }

    try {
      setSubmitting(true);
      await appointmentsService.deleteAppointment(params.id);

      showToast({
        message: 'Consulta cancelada com sucesso',
        type: 'success',
      });

      router.push('/appointments');
    } catch (error) {
      showToast({
        message: 'Erro ao cancelar consulta. Tente novamente.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loading text="Carregando detalhes da consulta..." />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">
          Consulta não encontrada
        </h1>
        <button
          onClick={() => router.push('/appointments')}
          className="text-primary-600 hover:text-primary-700"
        >
          Voltar para lista de consultas
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">
          {appointment.is_first_visit ? 'Primeira Consulta' : 'Consulta de Retorno'}
        </h1>
        <button
          onClick={handleDelete}
          className="text-red-600 hover:text-red-700"
          disabled={submitting}
        >
          Cancelar Consulta
        </button>
      </div>

      <AppointmentForm
        initialData={{
          patient_id: appointment.patient_id,
          service_type: appointment.service_type,
          location_type: appointment.location_type,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          price: appointment.price,
          notes: appointment.notes,
          is_first_visit: appointment.is_first_visit,
        }}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/appointments')}
        loading={submitting}
        existingAppointments={existingAppointments}
        businessHours={businessHours}
      />
    </div>
  );
};

export default AppointmentPage;