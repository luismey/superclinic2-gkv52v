import React, { useCallback, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { format, addMinutes, parseISO } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import Input from '../common/Input';
import Button from '../common/Button';
import TimeSlotPicker from './TimeSlotPicker';
import { 
  ServiceType, 
  LocationType,
  AppointmentFormData,
  AppointmentBase,
  MIN_APPOINTMENT_DURATION_MINUTES,
  MAX_APPOINTMENT_DURATION_MINUTES
} from '../../types/appointments';

// Default durations in minutes for Brazilian healthcare services
const SERVICE_DURATIONS = {
  [ServiceType.CONSULTATION]: 30,
  [ServiceType.FOLLOWUP]: 30,
  [ServiceType.PROCEDURE]: 60,
  [ServiceType.EMERGENCY]: 45
};

interface AppointmentFormProps {
  initialData?: AppointmentFormData;
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  onCancel: () => void;
  loading: boolean;
  existingAppointments: AppointmentBase[];
  businessHours: {
    start: number;
    end: number;
    lunchStart?: number;
    lunchEnd?: number;
  };
}

// Validation schema with Brazilian Portuguese messages
const validationSchema = yup.object().shape({
  patient_id: yup
    .string()
    .required('Seleção de paciente é obrigatória'),
  
  service_type: yup
    .string()
    .oneOf(Object.values(ServiceType))
    .required('Tipo de serviço é obrigatório'),
  
  location_type: yup
    .string()
    .oneOf(Object.values(LocationType))
    .required('Tipo de atendimento é obrigatório'),
  
  start_time: yup
    .date()
    .required('Horário inicial é obrigatório')
    .test('business-hours', 'Fora do horário comercial', (value, ctx) => {
      if (!value) return false;
      const hours = value.getHours();
      return hours >= ctx.parent.businessHours.start && hours < ctx.parent.businessHours.end;
    }),
  
  end_time: yup
    .date()
    .required('Horário final é obrigatório')
    .test('duration', 'Duração inválida', (value, ctx) => {
      if (!value || !ctx.parent.start_time) return false;
      const duration = (value.getTime() - ctx.parent.start_time.getTime()) / (1000 * 60);
      return duration >= MIN_APPOINTMENT_DURATION_MINUTES && duration <= MAX_APPOINTMENT_DURATION_MINUTES;
    })
    .test('overlap', 'Conflito com consulta existente', (value, ctx) => {
      if (!value || !ctx.parent.start_time) return false;
      return !ctx.parent.existingAppointments.some(apt => 
        (ctx.parent.start_time >= apt.start_time && ctx.parent.start_time < apt.end_time) ||
        (value > apt.start_time && value <= apt.end_time)
      );
    }),
  
  price: yup
    .number()
    .transform(value => typeof value === 'string' ? parseFloat(value.replace(/[^\d,]/g, '').replace(',', '.')) : value)
    .min(0, 'Preço deve ser positivo')
    .required('Preço é obrigatório'),
  
  notes: yup
    .string()
    .max(500, 'Observações não podem exceder 500 caracteres'),
  
  is_first_visit: yup
    .boolean(),
  
  health_insurance: yup
    .string()
    .nullable(),
  
  emergency: yup
    .boolean()
    .default(false)
});

export const AppointmentForm: React.FC<AppointmentFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  loading,
  existingAppointments,
  businessHours
}) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<AppointmentFormData>({
    defaultValues: initialData,
    resolver: yup.resolver(validationSchema)
  });

  const serviceType = watch('service_type');
  const startTime = watch('start_time');

  // Format currency in Brazilian Real (BRL)
  const formatCurrency = useCallback((value: string) => {
    const numericValue = value.replace(/[^\d]/g, '');
    const floatValue = parseInt(numericValue) / 100;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(floatValue);
  }, []);

  // Handle service type changes and update duration
  const handleServiceTypeChange = useCallback((type: ServiceType) => {
    setValue('service_type', type);
    if (startTime) {
      setValue(
        'end_time',
        addMinutes(startTime, SERVICE_DURATIONS[type])
      );
    }
  }, [setValue, startTime]);

  // Handle time slot selection
  const handleTimeSlotChange = useCallback((time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const newStartTime = new Date();
    newStartTime.setHours(hours, minutes, 0, 0);
    
    setValue('start_time', newStartTime);
    setValue(
      'end_time',
      addMinutes(newStartTime, SERVICE_DURATIONS[serviceType])
    );
  }, [setValue, serviceType]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Service Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Serviço
          </label>
          <select
            {...register('service_type')}
            onChange={(e) => handleServiceTypeChange(e.target.value as ServiceType)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value="">Selecione o tipo</option>
            <option value={ServiceType.CONSULTATION}>Consulta</option>
            <option value={ServiceType.FOLLOWUP}>Retorno</option>
            <option value={ServiceType.PROCEDURE}>Procedimento</option>
            <option value={ServiceType.EMERGENCY}>Emergência</option>
          </select>
          {errors.service_type && (
            <p className="mt-1 text-sm text-red-600">{errors.service_type.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Atendimento
          </label>
          <select
            {...register('location_type')}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
          >
            <option value={LocationType.IN_PERSON}>Presencial</option>
            <option value={LocationType.VIRTUAL}>Teleconsulta</option>
          </select>
          {errors.location_type && (
            <p className="mt-1 text-sm text-red-600">{errors.location_type.message}</p>
          )}
        </div>
      </div>

      {/* Time Slot Selection */}
      <TimeSlotPicker
        selectedDate={startTime || new Date()}
        selectedTime={startTime ? format(startTime, 'HH:mm') : ''}
        existingAppointments={existingAppointments}
        duration={SERVICE_DURATIONS[serviceType]}
        onChange={handleTimeSlotChange}
        error={errors.start_time?.message}
        allowEmergency={serviceType === ServiceType.EMERGENCY}
      />

      {/* Price Input with Brazilian currency format */}
      <Input
        id="price"
        label="Valor da Consulta"
        type="text"
        {...register('price')}
        onChange={(value) => setValue('price', formatCurrency(value))}
        error={errors.price?.message}
        inputMode="numeric"
        placeholder="R$ 0,00"
      />

      {/* Additional Fields */}
      <div className="space-y-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('is_first_visit')}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label className="ml-2 block text-sm text-gray-700">
            Primeira Consulta
          </label>
        </div>

        <Input
          id="health_insurance"
          label="Convênio (opcional)"
          {...register('health_insurance')}
          error={errors.health_insurance?.message}
        />

        <Input
          id="notes"
          label="Observações"
          {...register('notes')}
          error={errors.notes?.message}
        />
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading}
        >
          {initialData ? 'Atualizar Consulta' : 'Agendar Consulta'}
        </Button>
      </div>
    </form>
  );
};

export default AppointmentForm;