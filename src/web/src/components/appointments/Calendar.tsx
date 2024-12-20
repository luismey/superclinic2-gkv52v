import React, { useState, useCallback, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react'; // v6.1.8
import timeGridPlugin from '@fullcalendar/timegrid'; // v6.1.8
import ptBrLocale from '@fullcalendar/core/locales/pt-br'; // v6.1.8
import { DateTime } from 'luxon'; // v3.0.0
import TimeSlotPicker from './TimeSlotPicker';
import AppointmentForm from './AppointmentForm';
import { 
  Appointment, 
  AppointmentFormData, 
  AppointmentStatus,
  ServiceType 
} from '../../types/appointments';

// Brazilian business hours configuration
const DEFAULT_BUSINESS_HOURS = {
  startTime: '08:00',
  endTime: '18:00',
  lunchBreak: {
    start: '12:00',
    end: '13:00'
  },
  daysOfWeek: [1, 2, 3, 4, 5, 6] // Monday to Saturday
};

interface CalendarProps {
  appointments: Appointment[];
  onAppointmentCreate: (appointment: AppointmentFormData) => Promise<void>;
  onAppointmentUpdate: (id: string, appointment: AppointmentFormData) => Promise<void>;
  onAppointmentDelete: (id: string) => Promise<void>;
  region: string;
  emergencyMode?: boolean;
}

interface AppointmentDialogState {
  isOpen: boolean;
  appointmentId?: string;
  selectedDate?: Date;
  mode: 'create' | 'edit';
}

export const Calendar: React.FC<CalendarProps> = ({
  appointments,
  onAppointmentCreate,
  onAppointmentUpdate,
  onAppointmentDelete,
  region,
  emergencyMode = false
}) => {
  // State management
  const [dialogState, setDialogState] = useState<AppointmentDialogState>({
    isOpen: false,
    mode: 'create'
  });
  const [loading, setLoading] = useState(false);

  // Format appointments for FullCalendar
  const calendarEvents = appointments.map(appointment => ({
    id: appointment.id,
    title: `${appointment.service_type} - ${appointment.patient_id}`,
    start: appointment.start_time,
    end: appointment.end_time,
    backgroundColor: getAppointmentColor(appointment.status),
    extendedProps: appointment
  }));

  // Get color based on appointment status
  const getAppointmentColor = (status: AppointmentStatus): string => {
    const statusColors = {
      [AppointmentStatus.SCHEDULED]: '#4A90E2',
      [AppointmentStatus.CONFIRMED]: '#00CC66',
      [AppointmentStatus.CANCELLED]: '#FF4D4D',
      [AppointmentStatus.COMPLETED]: '#64748B',
      [AppointmentStatus.NO_SHOW]: '#FFB020',
      [AppointmentStatus.RESCHEDULED]: '#9333EA'
    };
    return statusColors[status];
  };

  // Handle date selection for new appointments
  const handleDateSelect = useCallback(async (selectInfo: any) => {
    const selectedDateTime = DateTime.fromJSDate(selectInfo.start)
      .setZone('America/Sao_Paulo');

    // Check if selection is within business hours
    const hour = selectedDateTime.hour;
    const isLunchBreak = hour >= 12 && hour < 13;
    const isBusinessHours = hour >= 8 && hour < 18;
    const isWeekend = selectedDateTime.weekday === 7; // Sunday

    if (!emergencyMode && (isLunchBreak || !isBusinessHours || isWeekend)) {
      alert('Por favor, selecione um horário comercial válido.');
      return;
    }

    setDialogState({
      isOpen: true,
      selectedDate: selectInfo.start,
      mode: 'create'
    });
  }, [emergencyMode]);

  // Handle appointment click for editing
  const handleEventClick = useCallback((clickInfo: any) => {
    setDialogState({
      isOpen: true,
      appointmentId: clickInfo.event.id,
      mode: 'edit'
    });
  }, []);

  // Handle form submission
  const handleFormSubmit = useCallback(async (data: AppointmentFormData) => {
    try {
      setLoading(true);
      if (dialogState.mode === 'create') {
        await onAppointmentCreate(data);
      } else if (dialogState.appointmentId) {
        await onAppointmentUpdate(dialogState.appointmentId, data);
      }
      setDialogState({ isOpen: false, mode: 'create' });
    } catch (error) {
      console.error('Error handling appointment:', error);
      alert('Erro ao processar agendamento. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [dialogState, onAppointmentCreate, onAppointmentUpdate]);

  // Handle appointment deletion
  const handleDelete = useCallback(async () => {
    if (!dialogState.appointmentId || !confirm('Deseja realmente cancelar esta consulta?')) {
      return;
    }

    try {
      setLoading(true);
      await onAppointmentDelete(dialogState.appointmentId);
      setDialogState({ isOpen: false, mode: 'create' });
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Erro ao cancelar consulta. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [dialogState.appointmentId, onAppointmentDelete]);

  // Get initial appointment data for editing
  const getInitialFormData = useCallback((): AppointmentFormData | undefined => {
    if (dialogState.mode === 'edit' && dialogState.appointmentId) {
      const appointment = appointments.find(apt => apt.id === dialogState.appointmentId);
      if (appointment) {
        return {
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          service_type: appointment.service_type,
          location_type: appointment.location_type,
          price: appointment.price,
          notes: appointment.notes,
          is_first_visit: appointment.is_first_visit,
          patient_id: appointment.patient_id
        };
      }
    }
    return dialogState.selectedDate ? {
      start_time: dialogState.selectedDate,
      end_time: new Date(dialogState.selectedDate.getTime() + 30 * 60000),
      service_type: ServiceType.CONSULTATION,
      location_type: undefined,
      price: 0,
      notes: '',
      is_first_visit: true,
      patient_id: ''
    } : undefined;
  }, [dialogState, appointments]);

  return (
    <div className="h-full flex flex-col">
      <FullCalendar
        plugins={[timeGridPlugin]}
        initialView="timeGridWeek"
        locale={ptBrLocale}
        timeZone="America/Sao_Paulo"
        slotMinTime={emergencyMode ? "00:00:00" : "08:00:00"}
        slotMaxTime={emergencyMode ? "23:59:59" : "18:00:00"}
        slotDuration="00:30:00"
        allDaySlot={false}
        businessHours={DEFAULT_BUSINESS_HOURS}
        events={calendarEvents}
        selectable={true}
        selectMirror={true}
        select={handleDateSelect}
        eventClick={handleEventClick}
        headerToolbar={{
          left: 'prev,next today',
          center: 'title',
          right: 'timeGridWeek,timeGridDay'
        }}
        buttonText={{
          today: 'Hoje',
          week: 'Semana',
          day: 'Dia'
        }}
      />

      {dialogState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">
              {dialogState.mode === 'create' ? 'Nova Consulta' : 'Editar Consulta'}
            </h2>
            
            <AppointmentForm
              initialData={getInitialFormData()}
              onSubmit={handleFormSubmit}
              onCancel={() => setDialogState({ isOpen: false, mode: 'create' })}
              loading={loading}
              existingAppointments={appointments}
              businessHours={{
                start: 8,
                end: 18,
                lunchStart: 12,
                lunchEnd: 13
              }}
            />

            {dialogState.mode === 'edit' && (
              <button
                onClick={handleDelete}
                className="mt-4 text-red-600 hover:text-red-700"
                disabled={loading}
              >
                Cancelar Consulta
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;