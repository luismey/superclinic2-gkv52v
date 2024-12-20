// @ts-check
import { format, zonedTimeToUtc } from 'date-fns-tz'; // v2.0.0
import api from '../lib/api';
import { API_ENDPOINTS } from '../constants/api';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
  TargetAudienceType,
  MessageTemplate,
  CampaignSchedule,
  CampaignMetrics,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFilters,
  requiresConsent,
} from '../types/campaigns';

/**
 * Healthcare-compliant campaign validation interface
 */
interface HealthcareCompliance {
  isCompliant: boolean;
  violations: string[];
  recommendations: string[];
  lgpdStatus: {
    consentRequired: boolean;
    consentMessage: string;
    dataRetentionDays: number;
  };
}

/**
 * Service for managing healthcare-compliant WhatsApp marketing campaigns
 */
const campaignService = {
  /**
   * Retrieves list of campaigns with healthcare compliance filtering
   * @param filters - Campaign filter criteria
   * @returns Promise resolving to filtered campaign list
   */
  async getCampaigns(filters?: CampaignFilters): Promise<Campaign[]> {
    try {
      const response = await api.get<Campaign[]>(API_ENDPOINTS.CAMPAIGNS.LIST, {
        params: {
          ...filters,
          // Convert dates to Brazil timezone
          ...(filters?.dateRange && {
            start_date: format(
              zonedTimeToUtc(filters.dateRange.start, 'America/Sao_Paulo'),
              "yyyy-MM-dd'T'HH:mm:ssXXX"
            ),
            end_date: format(
              zonedTimeToUtc(filters.dateRange.end, 'America/Sao_Paulo'),
              "yyyy-MM-dd'T'HH:mm:ssXXX"
            ),
          }),
        },
      });

      // Filter out campaigns that require but don't have LGPD consent
      return response.data.filter(campaign => {
        if (requiresConsent(campaign)) {
          return campaign.consentTracking.trackingEnabled;
        }
        return true;
      });
    } catch (error) {
      throw new Error(`Failed to fetch campaigns: ${error.message}`);
    }
  },

  /**
   * Validates campaign content for healthcare regulations and LGPD compliance
   * @param campaign - Campaign to validate
   * @returns Promise resolving to compliance validation result
   */
  async validateHealthcareCompliance(campaign: Campaign): Promise<HealthcareCompliance> {
    try {
      // Validate medical content and disclaimers
      const violations: string[] = [];
      const recommendations: string[] = [];

      // Check Portuguese language requirement
      if (campaign.template.language !== 'pt-BR') {
        violations.push('Campaign content must be in Brazilian Portuguese');
      }

      // Validate medical disclaimers
      if (!campaign.template.medicalDisclaimer) {
        violations.push('Medical disclaimer is required for healthcare campaigns');
      }

      // Check business hours compliance
      if (!campaign.schedule.businessHoursOnly) {
        recommendations.push('Consider restricting messages to business hours for better engagement');
      }

      // Validate LGPD consent requirements
      const lgpdStatus = {
        consentRequired: campaign.consentTracking.consentRequired,
        consentMessage: campaign.consentTracking.consentMessage,
        dataRetentionDays: campaign.consentTracking.consentExpiryDays,
      };

      // Validate target audience specific requirements
      if (campaign.target_audience === TargetAudienceType.POST_TREATMENT) {
        if (!campaign.template.content.includes('{{treatment_date}}')) {
          violations.push('Post-treatment campaigns must include treatment date reference');
        }
      }

      return {
        isCompliant: violations.length === 0,
        violations,
        recommendations,
        lgpdStatus,
      };
    } catch (error) {
      throw new Error(`Compliance validation failed: ${error.message}`);
    }
  },

  /**
   * Creates a new campaign with healthcare compliance checks
   * @param campaignData - Campaign creation data
   * @returns Promise resolving to created campaign
   */
  async createCampaign(campaignData: CreateCampaignInput): Promise<Campaign> {
    try {
      // Validate healthcare compliance before creation
      const compliance = await this.validateHealthcareCompliance(campaignData as Campaign);
      
      if (!compliance.isCompliant) {
        throw new Error(`Campaign violates healthcare compliance: ${compliance.violations.join(', ')}`);
      }

      // Ensure LGPD consent tracking for required campaigns
      if (compliance.lgpdStatus.consentRequired && !campaignData.consentTracking.trackingEnabled) {
        throw new Error('LGPD consent tracking must be enabled for this campaign type');
      }

      // Set default values for healthcare campaigns
      const enhancedData = {
        ...campaignData,
        status: CampaignStatus.DRAFT,
        schedule: {
          ...campaignData.schedule,
          timezone: 'America/Sao_Paulo',
          businessHoursOnly: true,
          respectLocalHolidays: true,
        },
        template: {
          ...campaignData.template,
          language: 'pt-BR',
          lgpdCompliant: true,
        },
      };

      const response = await api.post<Campaign>(
        API_ENDPOINTS.CAMPAIGNS.CREATE,
        enhancedData
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  },

  /**
   * Updates an existing campaign with compliance validation
   * @param id - Campaign ID
   * @param updates - Campaign update data
   * @returns Promise resolving to updated campaign
   */
  async updateCampaign(id: string, updates: UpdateCampaignInput): Promise<Campaign> {
    try {
      // Get existing campaign
      const currentCampaign = await api.get<Campaign>(`${API_ENDPOINTS.CAMPAIGNS.UPDATE.replace(':id', id)}`);
      
      // Merge updates with current campaign
      const updatedCampaign = {
        ...currentCampaign.data,
        ...updates,
      };

      // Validate compliance of updated campaign
      const compliance = await this.validateHealthcareCompliance(updatedCampaign);
      
      if (!compliance.isCompliant) {
        throw new Error(`Update violates healthcare compliance: ${compliance.violations.join(', ')}`);
      }

      const response = await api.put<Campaign>(
        API_ENDPOINTS.CAMPAIGNS.UPDATE.replace(':id', id),
        updates
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to update campaign: ${error.message}`);
    }
  },

  /**
   * Deletes a campaign with proper cleanup
   * @param id - Campaign ID
   * @returns Promise resolving when campaign is deleted
   */
  async deleteCampaign(id: string): Promise<void> {
    try {
      await api.delete(API_ENDPOINTS.CAMPAIGNS.DELETE.replace(':id', id));
    } catch (error) {
      throw new Error(`Failed to delete campaign: ${error.message}`);
    }
  },
};

export default campaignService;