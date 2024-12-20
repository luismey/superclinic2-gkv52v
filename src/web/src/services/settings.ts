// @ts-check
import { z } from 'zod'; // v3.22.0
import {
  WhatsAppConfig,
  AIAssistantConfig,
  ProfileSettings,
  TeamMember,
  BillingInfo,
  whatsAppConfigSchema,
  aiAssistantConfigSchema,
  lgpdConsentConfigSchema,
} from '../types/settings';
import api from '../lib/api';
import {
  getSecureStorage,
  setSecureStorage,
  StorageKeys,
} from '../lib/storage';
import { API_ENDPOINTS } from '../constants/api';
import { UserRole } from '../types/auth';

// Cache TTL for settings (15 minutes)
const SETTINGS_CACHE_TTL = 15 * 60 * 1000;

// Enhanced validation schemas with Brazilian market requirements
const enhancedWhatsAppConfigSchema = whatsAppConfigSchema.extend({
  business_hours: z.object({
    timezone: z.literal('America/Sao_Paulo'),
    weekday_start: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    weekday_end: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  }),
  message_templates: z.array(z.object({
    language: z.literal('pt-BR'),
    status: z.enum(['APPROVED', 'PENDING', 'REJECTED']),
    category: z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']),
  })),
});

/**
 * Settings service for managing application configuration
 * Implements LGPD compliance and Brazilian market requirements
 */
class SettingsService {
  /**
   * Retrieves WhatsApp Business API configuration
   * @returns Promise<WhatsAppConfig>
   */
  async getWhatsAppConfig(): Promise<WhatsAppConfig> {
    try {
      // Check cache first
      const cachedConfig = await getSecureStorage<WhatsAppConfig>(
        StorageKeys.USER_PREFERENCES
      );

      if (cachedConfig?.updated_at && 
          Date.now() - new Date(cachedConfig.updated_at).getTime() < SETTINGS_CACHE_TTL) {
        return cachedConfig;
      }

      // Fetch fresh configuration
      const response = await api.get<WhatsAppConfig>(
        API_ENDPOINTS.SETTINGS.INTEGRATIONS + '/whatsapp',
        {
          validateSchema: enhancedWhatsAppConfigSchema,
        }
      );

      // Cache the validated configuration
      await setSecureStorage(StorageKeys.USER_PREFERENCES, response.data);

      return response.data;
    } catch (error) {
      console.error('Failed to fetch WhatsApp configuration:', error);
      throw error;
    }
  }

  /**
   * Updates WhatsApp Business API configuration with LGPD compliance
   * @param config - WhatsApp configuration update
   * @returns Promise<WhatsAppConfig>
   */
  async updateWhatsAppConfig(config: Partial<WhatsAppConfig>): Promise<WhatsAppConfig> {
    try {
      // Validate configuration
      const validatedConfig = enhancedWhatsAppConfigSchema.parse(config);

      // Update configuration
      const response = await api.put<WhatsAppConfig>(
        API_ENDPOINTS.SETTINGS.INTEGRATIONS + '/whatsapp',
        validatedConfig,
        {
          validateSchema: enhancedWhatsAppConfigSchema,
        }
      );

      // Update cache
      await setSecureStorage(StorageKeys.USER_PREFERENCES, response.data);

      return response.data;
    } catch (error) {
      console.error('Failed to update WhatsApp configuration:', error);
      throw error;
    }
  }

  /**
   * Retrieves AI assistant configuration with Brazilian Portuguese optimization
   * @returns Promise<AIAssistantConfig>
   */
  async getAIAssistantConfig(): Promise<AIAssistantConfig> {
    try {
      const response = await api.get<AIAssistantConfig>(
        API_ENDPOINTS.SETTINGS.INTEGRATIONS + '/ai-assistant',
        {
          validateSchema: aiAssistantConfigSchema,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to fetch AI assistant configuration:', error);
      throw error;
    }
  }

  /**
   * Updates AI assistant configuration with enhanced security
   * @param config - AI assistant configuration update
   * @returns Promise<AIAssistantConfig>
   */
  async updateAIAssistantConfig(config: Partial<AIAssistantConfig>): Promise<AIAssistantConfig> {
    try {
      // Validate configuration
      const validatedConfig = aiAssistantConfigSchema.parse(config);

      const response = await api.put<AIAssistantConfig>(
        API_ENDPOINTS.SETTINGS.INTEGRATIONS + '/ai-assistant',
        validatedConfig,
        {
          validateSchema: aiAssistantConfigSchema,
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to update AI assistant configuration:', error);
      throw error;
    }
  }

  /**
   * Retrieves profile settings with LGPD compliance
   * @returns Promise<ProfileSettings>
   */
  async getProfileSettings(): Promise<ProfileSettings> {
    try {
      const response = await api.get<ProfileSettings>(
        API_ENDPOINTS.SETTINGS.PROFILE,
        {
          validateSchema: z.object({
            lgpd_consent_settings: lgpdConsentConfigSchema,
          }).passthrough(),
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to fetch profile settings:', error);
      throw error;
    }
  }

  /**
   * Updates profile settings with enhanced validation
   * @param settings - Profile settings update
   * @returns Promise<ProfileSettings>
   */
  async updateProfileSettings(settings: Partial<ProfileSettings>): Promise<ProfileSettings> {
    try {
      const response = await api.put<ProfileSettings>(
        API_ENDPOINTS.SETTINGS.PROFILE,
        settings,
        {
          validateSchema: z.object({
            lgpd_consent_settings: lgpdConsentConfigSchema,
          }).passthrough(),
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to update profile settings:', error);
      throw error;
    }
  }

  /**
   * Manages team member settings with role-based access control
   * @param memberId - Team member ID
   * @param settings - Team member settings update
   * @returns Promise<TeamMember>
   */
  async updateTeamMemberSettings(
    memberId: string,
    settings: Partial<TeamMember>
  ): Promise<TeamMember> {
    try {
      // Validate role permissions
      const validRoles = [UserRole.ADMIN, UserRole.MANAGER];
      if (!validRoles.includes(settings.role as UserRole)) {
        throw new Error('Invalid role assignment');
      }

      const response = await api.put<TeamMember>(
        `${API_ENDPOINTS.SETTINGS.TEAM}/${memberId}`,
        settings
      );

      return response.data;
    } catch (error) {
      console.error('Failed to update team member settings:', error);
      throw error;
    }
  }

  /**
   * Manages billing settings with Brazilian payment methods
   * @param settings - Billing settings update
   * @returns Promise<BillingInfo>
   */
  async updateBillingSettings(settings: Partial<BillingInfo>): Promise<BillingInfo> {
    try {
      const response = await api.put<BillingInfo>(
        API_ENDPOINTS.SETTINGS.BILLING,
        settings
      );

      return response.data;
    } catch (error) {
      console.error('Failed to update billing settings:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const settingsService = new SettingsService();