'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { format, zonedTimeToUtc } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@chakra-ui/react';

import Calendar from '../../components/appointments/Calendar';
import { appointmentsService } from '../../services/appointments';
import { 
  Appointment, 
  AppointmentFormData, 
  AppointmentStatus,
  ServiceType 
} from '../../types/appointments';

// Brazilian timezone constant
const TIMEZONE = 'America/Sao_Paulo';

// Component for managing healthcare appointments with LGPD compliance
const AppointmentsPage: React.FC = () => {
  // State management
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Toast notifications in Portuguese
  const toast = useToast();

  // Fetch appointments with LGPD compliance
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await appointmentsService.getAppointments({
        date_range: {
          start_date: new Date(),
          end_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          timezone: TIMEZONE
        }
      });

      // Format dates to Brazilian timezone
      const formattedAppointments = response.data.items.map(appointment => ({
        ...appointment,
        start_time: zonedTimeToUtc(appointment.start_time, TIMEZONE),
        end_time: zonedTimeToUtc(appointment.end_time, TIMEZONE)
      }));

      setAppointments(formattedAppointments);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Erro ao carregar agendamentos. Por favor, tente novamente.');
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os agendamentos',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Create new appointment with LGPD compliance
  const handleAppointmentCreate = useCallback(async (appointmentData: AppointmentFormData) => {
    try {
      setLoading(true);
      setError(null);

      // Validate Brazilian business hours
      const hour = new Date(appointmentData.start_time).getHours();
      if (hour < 8 || hour > 18) {
        throw new Error('Horário fora do período comercial (8h às 18h)');
      }

      // Create appointment with Google Calendar sync
      await appointmentsService.createAppointment({
        ...appointmentData,
        service_type: appointmentData.service_type || ServiceType.CONSULTATION,
        start_time: zonedTimeToUtc(appointmentData.start_time, TIMEZONE),
        end_time: zonedTimeToUtc(appointmentData.end_time, TIMEZONE)
      });

      toast({
        title: 'Sucesso',
        description: 'Consulta agendada com sucesso',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      // Refresh appointments list
      await fetchAppointments();
    } catch (err) {
      console.error('Error creating appointment:', err);
      setError('Erro ao criar agendamento. Por favor, tente novamente.');
      toast({
        title: 'Erro',
        description: err.message || 'Não foi possível criar o agendamento',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAppointments, toast]);

  // Update existing appointment
  const handleAppointmentUpdate = useCallback(async (
    id: string, 
    appointmentData: AppointmentFormData
  ) => {
    try {
      setLoading(true);
      setError(null);

      await appointmentsService.updateAppointment(id, {
        ...appointmentData,
        start_time: zonedTimeToUtc(appointmentData.start_time, TIMEZONE),
        end_time: zonedTimeToUtc(appointmentData.end_time, TIMEZONE)
      });

      toast({
        title: 'Sucesso',
        description: 'Consulta atualizada com sucesso',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      await fetchAppointments();
    } catch (err) {
      console.error('Error updating appointment:', err);
      setError('Erro ao atualizar agendamento. Por favor, tente novamente.');
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o agendamento',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAppointments, toast]);

  // Delete/cancel appointment
  const handleAppointmentDelete = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      await appointmentsService.cancelAppointment(id, 'Cancelado pelo usuário');

      toast({
        title: 'Sucesso',
        description: 'Consulta cancelada com sucesso',
        status: 'success',
        duration: 5000,
        isClosable: true,
      });

      await fetchAppointments();
    } catch (err) {
      console.error('Error deleting appointment:', err);
      setError('Erro ao cancelar agendamento. Por favor, tente novamente.');
      toast({
        title: 'Erro',
        description: 'Não foi possível cancelar o agendamento',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
  }, [fetchAppointments, toast]);

  // Initial load
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  return (
    <div className="flex flex-col h-full p-4 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Agenda de Consultas
        </h1>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-100 rounded-md">
          {error}
        </div>
      )}

      {/* Calendar component */}
      <div className="flex-1 min-h-0">
        <Calendar
          appointments={appointments}
          onAppointmentCreate={handleAppointmentCreate}
          onAppointmentUpdate={handleAppointmentUpdate}
          onAppointmentDelete={handleAppointmentDelete}
          region="BR"
          loading={loading}
        />
      </div>
    </div>
  );
};

export default AppointmentsPage;