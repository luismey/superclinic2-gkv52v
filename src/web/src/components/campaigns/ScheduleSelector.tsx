import React, { useState, useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { format, parse, isWithinInterval, setHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CampaignSchedule, CampaignType } from '../../types/campaigns';
import Input from '../common/Input';
import Select from '../common/Select';

// Brazilian timezone configurations with business hours
const BRAZILIAN_TIMEZONES = [
  {
    value: 'America/Sao_Paulo',
    label: 'Horário de Brasília (GMT-3)',
    businessHours: { start: '08:00', end: '18:00' }
  },
  {
    value: 'America/Manaus',
    label: 'Horário de Manaus (GMT-4)',
    businessHours: { start: '08:00', end: '18:00' }
  },
  {
    value: 'America/Rio_Branco',
    label: 'Horário do Acre (GMT-5)',
    businessHours: { start: '08:00', end: '18:00' }
  }
] as const;

// Time slot options in 30-minute intervals
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

interface ScheduleSelectorProps {
  campaignType: CampaignType;
  onChange: (schedule: CampaignSchedule) => void;
  defaultValue?: CampaignSchedule;
  businessHoursOnly: boolean;
  respectHolidays: boolean;
}

export const ScheduleSelector: React.FC<ScheduleSelectorProps> = ({
  campaignType,
  onChange,
  defaultValue,
  businessHoursOnly = true,
  respectHolidays = true,
}) => {
  // Form context for validation and state management
  const { register, watch, setValue, formState: { errors } } = useFormContext();

  // Local state for schedule configuration
  const [schedule, setSchedule] = useState<CampaignSchedule>(defaultValue || {
    start_date: new Date(),
    end_date: null,
    time_slots: [],
    timezone: 'America/Sao_Paulo',
    recurrence_pattern: null,
    businessHoursOnly: true,
    respectLocalHolidays: true,
  });

  // Watch form values for changes
  const watchedValues = watch(['start_date', 'end_date', 'timezone', 'time_slots']);

  // Memoized business hours for selected timezone
  const businessHours = useMemo(() => {
    const selectedTimezone = BRAZILIAN_TIMEZONES.find(tz => tz.value === schedule.timezone);
    return selectedTimezone?.businessHours || { start: '08:00', end: '18:00' };
  }, [schedule.timezone]);

  /**
   * Validates if a time slot is within business hours
   * @param slot - Time slot to validate
   * @returns boolean indicating if slot is valid
   */
  const isValidTimeSlot = (slot: string): boolean => {
    if (!businessHoursOnly) return true;

    const slotTime = parse(slot, 'HH:mm', new Date());
    const startTime = parse(businessHours.start, 'HH:mm', new Date());
    const endTime = parse(businessHours.end, 'HH:mm', new Date());

    return isWithinInterval(slotTime, { start: startTime, end: endTime });
  };

  /**
   * Handles timezone selection change
   * @param newTimezone - Selected timezone value
   */
  const handleTimezoneChange = (newTimezone: string) => {
    setSchedule(prev => {
      const updated = {
        ...prev,
        timezone: newTimezone,
        time_slots: prev.time_slots.filter(slot => isValidTimeSlot(slot))
      };
      onChange(updated);
      return updated;
    });
  };

  /**
   * Handles start date selection with validation
   * @param date - Selected start date
   */
  const handleStartDateChange = (date: Date) => {
    if (date < new Date()) {
      setValue('start_date', new Date(), { shouldValidate: true });
      return;
    }

    setSchedule(prev => {
      const updated = {
        ...prev,
        start_date: date,
        end_date: prev.end_date && date > prev.end_date ? null : prev.end_date
      };
      onChange(updated);
      return updated;
    });
  };

  /**
   * Handles time slot selection
   * @param slots - Selected time slots
   */
  const handleTimeSlotChange = (slots: string[]) => {
    const validSlots = slots.filter(isValidTimeSlot);
    setSchedule(prev => {
      const updated = { ...prev, time_slots: validSlots };
      onChange(updated);
      return updated;
    });
  };

  // Update form when default value changes
  useEffect(() => {
    if (defaultValue) {
      setSchedule(defaultValue);
      Object.entries(defaultValue).forEach(([key, value]) => {
        setValue(key, value, { shouldValidate: true });
      });
    }
  }, [defaultValue, setValue]);

  return (
    <div className="space-y-4">
      {/* Timezone Selection */}
      <Select
        name="timezone"
        label="Fuso Horário"
        options={BRAZILIAN_TIMEZONES.map(tz => ({
          value: tz.value,
          label: tz.label
        }))}
        value={schedule.timezone}
        onChange={handleTimezoneChange}
        error={errors.timezone?.message as string}
        required
      />

      {/* Start Date Selection */}
      <Input
        id="start_date"
        name="start_date"
        label="Data de Início"
        type="datetime-local"
        value={format(schedule.start_date, "yyyy-MM-dd'T'HH:mm", { locale: ptBR })}
        onChange={(value) => handleStartDateChange(new Date(value))}
        error={errors.start_date?.message as string}
        required
      />

      {/* End Date Selection (for non-triggered campaigns) */}
      {campaignType !== CampaignType.TRIGGERED && (
        <Input
          id="end_date"
          name="end_date"
          label="Data de Término"
          type="datetime-local"
          value={schedule.end_date ? format(schedule.end_date, "yyyy-MM-dd'T'HH:mm", { locale: ptBR }) : ''}
          onChange={(value) => {
            const date = value ? new Date(value) : null;
            setSchedule(prev => {
              const updated = { ...prev, end_date: date };
              onChange(updated);
              return updated;
            });
          }}
          error={errors.end_date?.message as string}
          min={format(schedule.start_date, "yyyy-MM-dd'T'HH:mm")}
        />
      )}

      {/* Time Slots Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
          Horários de Envio
          <span className="text-red-500 ml-1">*</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {TIME_SLOTS.map(slot => (
            <label
              key={slot}
              className={`
                flex items-center p-2 rounded border
                ${isValidTimeSlot(slot) ? 'cursor-pointer hover:bg-gray-50' : 'opacity-50 cursor-not-allowed'}
                ${schedule.time_slots.includes(slot) ? 'bg-blue-50 border-blue-500' : 'border-gray-300'}
              `}
            >
              <input
                type="checkbox"
                value={slot}
                checked={schedule.time_slots.includes(slot)}
                onChange={(e) => {
                  const slots = e.target.checked
                    ? [...schedule.time_slots, slot]
                    : schedule.time_slots.filter(s => s !== slot);
                  handleTimeSlotChange(slots);
                }}
                disabled={!isValidTimeSlot(slot)}
                className="mr-2"
              />
              {slot}
            </label>
          ))}
        </div>
        {errors.time_slots && (
          <p className="mt-1 text-sm text-red-500" role="alert">
            {errors.time_slots.message as string}
          </p>
        )}
      </div>

      {/* Business Hours Notice */}
      {businessHoursOnly && (
        <p className="text-sm text-gray-500">
          Horários disponíveis: {businessHours.start} às {businessHours.end}
        </p>
      )}
    </div>
  );
};

export default ScheduleSelector;