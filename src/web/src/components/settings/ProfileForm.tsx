import React, { useEffect, useState } from 'react'; // ^18.0.0
import { useForm } from 'react-hook-form'; // ^7.45.0
import { z } from 'zod'; // ^3.22.0
import { format } from 'date-fns/locale/pt-BR'; // ^2.30.0

import Input from '../common/Input';
import Button from '../common/Button';
import { useAuth } from '../../hooks/useAuth';
import { settingsService } from '../../services/settings';
import { COLORS, SPACING } from '../../constants/ui';

// Validation schema for Brazilian healthcare professional data
const profileFormSchema = z.object({
  full_name: z.string().min(3, 'Nome completo deve ter no mínimo 3 caracteres'),
  email: z.string().email('Email inválido'),
  phone: z.string().regex(/^\([1-9]{2}\) (?:[2-8]|9[1-9])[0-9]{3}\-[0-9]{4}$/, 'Telefone inválido'),
  crm_number: z.string().regex(/^\d{5,6}$/, 'Número CRM inválido'),
  crm_state: z.string().length(2, 'UF do CRM inválida'),
  clinic_name: z.string().min(3, 'Nome da clínica deve ter no mínimo 3 caracteres'),
  clinic_address: z.string().min(10, 'Endereço deve ser completo'),
  clinic_cnpj: z.string().regex(/^\d{2}\.\d{3}\.\d{3}\/\d{4}\-\d{2}$/, 'CNPJ inválido'),
  specialization: z.string().min(3, 'Especialização é obrigatória'),
  language_preference: z.literal('pt-BR'),
  timezone: z.string().default('America/Sao_Paulo'),
  lgpd_consent: z.boolean().refine(val => val === true, {
    message: 'É necessário aceitar os termos da LGPD'
  }),
  notification_preferences: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    whatsapp: z.boolean(),
    in_app: z.boolean()
  })
});

type ProfileFormData = z.infer<typeof profileFormSchema>;

const ProfileForm: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<ProfileFormData>({
    defaultValues: {
      language_preference: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      notification_preferences: {
        email: true,
        sms: true,
        whatsapp: true,
        in_app: true
      }
    }
  });

  // Load existing profile data
  useEffect(() => {
    const loadProfileData = async () => {
      try {
        setLoading(true);
        const profileData = await settingsService.getProfileSettings();
        reset({
          full_name: profileData.clinic_name,
          email: user?.email || '',
          phone: profileData.clinic_phone,
          crm_number: profileData.crm_number,
          crm_state: profileData.crm_number.substring(0, 2),
          clinic_name: profileData.clinic_name,
          clinic_address: profileData.clinic_address,
          clinic_cnpj: profileData.clinic_cnpj,
          specialization: profileData.specialties[0] || '',
          lgpd_consent: true,
          language_preference: 'pt-BR',
          timezone: profileData.timezone,
          notification_preferences: profileData.notification_preferences
        });
      } catch (error) {
        setSubmitError('Erro ao carregar dados do perfil');
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadProfileData();
    }
  }, [user, reset]);

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setLoading(true);
      setSubmitError(null);

      // Validate form data
      const validated = profileFormSchema.parse(data);

      // Update profile settings
      await settingsService.updateProfileSettings({
        clinic_name: validated.clinic_name,
        clinic_address: validated.clinic_address,
        clinic_phone: validated.phone,
        crm_number: validated.crm_number,
        specialties: [validated.specialization],
        timezone: validated.timezone,
        notification_preferences: validated.notification_preferences,
        lgpd_consent_settings: {
          consent_given: validated.lgpd_consent,
          consent_date: new Date(),
          consent_version: '1.0'
        }
      });

      // Show success message
      alert('Perfil atualizado com sucesso!');
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Erro ao atualizar perfil'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form 
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-6 max-w-2xl mx-auto p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md"
    >
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        Configurações do Perfil
      </h2>

      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Informações Pessoais
        </h3>
        
        <Input
          id="full_name"
          label="Nome Completo"
          type="text"
          error={errors.full_name?.message}
          {...register('full_name')}
        />

        <Input
          id="email"
          label="Email"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          id="phone"
          label="Telefone"
          type="tel"
          placeholder="(XX) XXXXX-XXXX"
          error={errors.phone?.message}
          {...register('phone')}
        />
      </div>

      {/* Professional Information */}
      <div className="space-y-4 mt-8">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Informações Profissionais
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="crm_number"
            label="CRM"
            type="text"
            error={errors.crm_number?.message}
            {...register('crm_number')}
          />

          <Input
            id="crm_state"
            label="UF do CRM"
            type="text"
            maxLength={2}
            error={errors.crm_state?.message}
            {...register('crm_state')}
          />
        </div>

        <Input
          id="specialization"
          label="Especialização"
          type="text"
          error={errors.specialization?.message}
          {...register('specialization')}
        />
      </div>

      {/* Clinic Information */}
      <div className="space-y-4 mt-8">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Informações da Clínica
        </h3>

        <Input
          id="clinic_name"
          label="Nome da Clínica"
          type="text"
          error={errors.clinic_name?.message}
          {...register('clinic_name')}
        />

        <Input
          id="clinic_address"
          label="Endereço da Clínica"
          type="text"
          error={errors.clinic_address?.message}
          {...register('clinic_address')}
        />

        <Input
          id="clinic_cnpj"
          label="CNPJ"
          type="text"
          placeholder="XX.XXX.XXX/XXXX-XX"
          error={errors.clinic_cnpj?.message}
          {...register('clinic_cnpj')}
        />
      </div>

      {/* Notification Preferences */}
      <div className="space-y-4 mt-8">
        <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Preferências de Notificação
        </h3>

        <div className="space-y-2">
          {Object.entries({
            email: 'Email',
            sms: 'SMS',
            whatsapp: 'WhatsApp',
            in_app: 'No Aplicativo'
          }).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center space-x-2 text-gray-700 dark:text-gray-300"
            >
              <input
                type="checkbox"
                {...register(`notification_preferences.${key as keyof ProfileFormData['notification_preferences']}`)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* LGPD Consent */}
      <div className="mt-8">
        <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
          <input
            type="checkbox"
            {...register('lgpd_consent')}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span>
            Concordo com o processamento dos meus dados de acordo com a LGPD
          </span>
        </label>
        {errors.lgpd_consent && (
          <p className="mt-1 text-sm text-red-600">{errors.lgpd_consent.message}</p>
        )}
      </div>

      {/* Error Message */}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      {/* Form Actions */}
      <div className="flex justify-end space-x-4 mt-8">
        <Button
          type="button"
          variant="outline"
          onClick={() => reset()}
          disabled={loading || !isDirty}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          loading={loading}
          disabled={loading || !isDirty}
        >
          Salvar Alterações
        </Button>
      </div>
    </form>
  );
};

export default ProfileForm;