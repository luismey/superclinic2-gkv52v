// @ts-check
import { BaseModel } from './common';

/**
 * Enum representing possible campaign statuses
 * @enum {string}
 */
export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Enum representing types of healthcare campaigns
 * @enum {string}
 */
export enum CampaignType {
  ONE_TIME = 'one_time',
  RECURRING = 'recurring',
  TRIGGERED = 'triggered',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  TREATMENT_FOLLOWUP = 'treatment_followup'
}

/**
 * Enum representing healthcare-specific target audience types
 * @enum {string}
 */
export enum TargetAudienceType {
  NEW_LEADS = 'new_leads',
  ACTIVE_PATIENTS = 'active_patients',
  POST_TREATMENT = 'post_treatment',
  FOLLOW_UP_REQUIRED = 'follow_up_required',
  TREATMENT_SPECIFIC = 'treatment_specific',
  CUSTOM = 'custom'
}

/**
 * Interface for LGPD-compliant healthcare message templates
 */
export interface MessageTemplate {
  name: string;
  content: string;
  variables: string[];
  language: string;
  category: string;
  lgpdCompliant: boolean;
  consentRequired: boolean;
  medicalDisclaimer: string;
}

/**
 * Interface for Brazilian timezone-aware campaign scheduling
 */
export interface CampaignSchedule {
  start_date: Date;
  end_date: Date | null;
  time_slots: string[];
  timezone: string;
  recurrence_pattern: string | null;
  businessHoursOnly: boolean;
  respectLocalHolidays: boolean;
}

/**
 * Interface for healthcare campaign performance metrics
 */
export interface CampaignMetrics {
  total_recipients: number;
  messages_sent: number;
  messages_delivered: number;
  messages_read: number;
  responses_received: number;
  conversion_rate: number;
  appointment_bookings: number;
  consent_rates: number;
}

/**
 * Interface for LGPD consent management
 */
export interface ConsentTracking {
  consentRequired: boolean;
  consentMessage: string;
  consentExpiryDays: number;
  trackingEnabled: boolean;
}

/**
 * Main interface for healthcare campaign configuration
 * Extends BaseModel for common fields (id, created_at, updated_at)
 */
export interface Campaign extends BaseModel {
  name: string;
  description: string;
  type: CampaignType;
  status: CampaignStatus;
  target_audience: TargetAudienceType;
  template: MessageTemplate;
  schedule: CampaignSchedule;
  metrics: CampaignMetrics;
  consentTracking: ConsentTracking;
  healthcareCategory: string;
}

/**
 * Type guard to check if a campaign is active
 * @param campaign - Campaign to check
 * @returns boolean indicating if campaign is active
 */
export function isActiveCampaign(campaign: Campaign): boolean {
  return campaign.status === CampaignStatus.ACTIVE;
}

/**
 * Type guard to check if a campaign requires LGPD consent
 * @param campaign - Campaign to check
 * @returns boolean indicating if campaign requires consent
 */
export function requiresConsent(campaign: Campaign): boolean {
  return campaign.consentTracking.consentRequired;
}

/**
 * Type for campaign creation without metrics and system-generated fields
 */
export type CreateCampaignInput = Omit<Campaign, keyof BaseModel | 'metrics'>;

/**
 * Type for campaign update operations
 */
export type UpdateCampaignInput = Partial<CreateCampaignInput>;

/**
 * Type for campaign metrics update operations
 */
export type UpdateCampaignMetrics = Partial<CampaignMetrics>;

/**
 * Type for campaign schedule update operations
 */
export type UpdateCampaignSchedule = Partial<CampaignSchedule>;

/**
 * Type for message template update operations
 */
export type UpdateMessageTemplate = Partial<MessageTemplate>;

/**
 * Type for consent tracking update operations
 */
export type UpdateConsentTracking = Partial<ConsentTracking>;

/**
 * Type for campaign filter options
 */
export interface CampaignFilters {
  status?: CampaignStatus[];
  type?: CampaignType[];
  target_audience?: TargetAudienceType[];
  healthcareCategory?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Type for campaign sort options
 */
export type CampaignSortField = 
  | 'name'
  | 'created_at'
  | 'start_date'
  | 'conversion_rate'
  | 'messages_sent'
  | 'consent_rates';