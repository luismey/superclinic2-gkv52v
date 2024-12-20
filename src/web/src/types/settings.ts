// @ts-check
import { z } from 'zod'; // v3.22.0
import { BaseModel } from './common';
import { UserRole } from './auth';

// Global constants for Brazilian market settings
export const TIMEZONE_DEFAULT = 'America/Sao_Paulo';
export const BUSINESS_HOURS_DEFAULT = {
  weekday_start: '09:00',
  weekday_end: '18:00',
  weekend_start: '10:00',
  weekend_end: '14:00',
  closed_days: [0], // Sunday
} as const;

// WhatsApp message queue configuration
export interface MessageQueueConfig extends BaseModel {
  max_retries: number;
  retry_delay: number; // milliseconds
  batch_size: number;
  rate_limit: number; // messages per second
  priority_levels: ('high' | 'medium' | 'low')[];
  error_handling: 'discard' | 'retry' | 'dead-letter';
}

// WhatsApp Business API configuration
export interface WhatsAppConfig extends BaseModel {
  phone_number: string;
  business_name: string;
  business_description: string;
  is_verified: boolean;
  webhook_url: string;
  message_queue_settings: MessageQueueConfig;
  multi_device_support: boolean;
  api_version: string;
  template_namespace?: string;
  callback_verification_token: string;
  message_templates: WhatsAppTemplate[];
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: {
    type: 'HEADER' | 'BODY' | 'FOOTER';
    text: string;
    parameters?: string[];
  }[];
}

// Language configuration for AI assistants
export interface LanguageConfig {
  primary_language: 'pt-BR';
  fallback_language?: string;
  translation_enabled: boolean;
  custom_vocabulary: Record<string, string>;
  sentiment_analysis: boolean;
}

// AI assistant configuration
export interface AIAssistantConfig extends BaseModel {
  name: string;
  role: 'sales' | 'support' | 'scheduling' | 'billing';
  knowledge_base_ids: string[];
  response_template: string;
  is_active: boolean;
  language_settings: LanguageConfig;
  context_window_size: number;
  max_response_tokens: number;
  temperature: number;
  healthcare_compliance: boolean;
  sensitive_data_handling: string[];
}

// Business hours configuration
export interface BusinessHours {
  weekday_start: string;
  weekday_end: string;
  weekend_start: string;
  weekend_end: string;
  closed_days: number[];
  holiday_calendar: string;
  lunch_break?: {
    start: string;
    end: string;
  };
}

// LGPD compliance configuration
export interface LGPDConsentConfig extends BaseModel {
  data_retention_period: number; // days
  consent_template: string;
  data_processing_purposes: string[];
  data_sharing_policies: DataSharingPolicy[];
  data_subject_rights: string[];
  privacy_policy_version: string;
  last_updated: Date;
  dpo_contact: string;
}

export interface DataSharingPolicy {
  recipient_type: string;
  purpose: string;
  data_categories: string[];
  retention_period: number;
  legal_basis: string;
}

// Backup contact information
export interface BackupContactInfo {
  email: string;
  phone: string;
  whatsapp: string;
  emergency_contact: string;
}

// Healthcare practice profile settings
export interface ProfileSettings extends BaseModel {
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  business_hours: BusinessHours;
  timezone: string;
  lgpd_consent_settings: LGPDConsentConfig;
  backup_contact_info: BackupContactInfo;
  specialties: string[];
  crm_number: string;
  epao_certified: boolean;
  payment_methods: ('PIX' | 'CREDIT' | 'DEBIT' | 'BOLETO')[];
}

// Team member settings
export interface TeamMemberSettings extends BaseModel {
  user_id: string;
  role: UserRole;
  permissions: string[];
  working_hours: BusinessHours;
  assigned_specialties: string[];
  max_daily_appointments: number;
  vacation_dates: Date[];
}

// Notification preferences
export interface NotificationPreferences extends BaseModel {
  channels: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    in_app: boolean;
  };
  types: {
    appointment_reminders: boolean;
    payment_confirmations: boolean;
    campaign_updates: boolean;
    system_alerts: boolean;
  };
  quiet_hours: {
    start: string;
    end: string;
  };
}

// Zod schemas for runtime validation
export const whatsAppConfigSchema = z.object({
  phone_number: z.string().regex(/^\+55\d{10,11}$/),
  business_name: z.string().min(3).max(100),
  business_description: z.string().max(500),
  is_verified: z.boolean(),
  webhook_url: z.string().url(),
  message_queue_settings: z.object({
    max_retries: z.number().int().min(1).max(10),
    retry_delay: z.number().min(1000).max(60000),
    batch_size: z.number().int().min(1).max(1000),
    rate_limit: z.number().int().min(1).max(80)
  }),
  multi_device_support: z.boolean()
});

export const aiAssistantConfigSchema = z.object({
  name: z.string().min(3).max(50),
  role: z.enum(['sales', 'support', 'scheduling', 'billing']),
  knowledge_base_ids: z.array(z.string().uuid()),
  response_template: z.string(),
  is_active: z.boolean(),
  language_settings: z.object({
    primary_language: z.literal('pt-BR'),
    translation_enabled: z.boolean(),
    custom_vocabulary: z.record(z.string())
  }),
  context_window_size: z.number().int().min(1000).max(16000)
});

export const lgpdConsentConfigSchema = z.object({
  data_retention_period: z.number().int().min(30).max(3650),
  consent_template: z.string(),
  data_processing_purposes: z.array(z.string()),
  data_sharing_policies: z.array(z.object({
    recipient_type: z.string(),
    purpose: z.string(),
    data_categories: z.array(z.string()),
    retention_period: z.number(),
    legal_basis: z.string()
  }))
});