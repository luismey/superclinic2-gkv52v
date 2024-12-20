// @ts-check
import { useState, useEffect, useCallback, useMemo } from 'react'; // v18.0.0
import { format, utcToZonedTime } from 'date-fns-tz'; // v2.0.0
import { useAppDispatch, useAppSelector } from '../store';
import {
  Campaign,
  CampaignStatus,
  HealthcareCompliance,
  LGPDConsent,
} from '../types/campaigns';
import campaignService from '../services/campaigns';
import {
  campaignActions,
  selectCampaigns,
  selectCampaignById,
  selectCampaignLoading,
  selectCampaignError,
  selectComplianceStatus,
} from '../store/campaignSlice';

/**
 * Enhanced custom hook for managing WhatsApp marketing campaigns with healthcare compliance
 * @param id - Optional campaign ID for single campaign operations
 */
export function useCampaign(id?: string) {
  // Local state for enhanced campaign management
  const [localCompliance, setLocalCompliance] = useState<HealthcareCompliance | null>(null);
  const [lgpdStatus, setLgpdStatus] = useState<LGPDConsent | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // Redux state management
  const dispatch = useAppDispatch();
  const campaigns = useAppSelector(selectCampaigns);
  const campaign = useAppSelector((state) => id ? selectCampaignById(state, id) : null);
  const loading = useAppSelector(selectCampaignLoading);
  const error = useAppSelector(selectCampaignError);
  const complianceStatus = useAppSelector(selectComplianceStatus);

  // Brazilian timezone handling
  const brTimeZone = 'America/Sao_Paulo';

  /**
   * Fetches all campaigns with healthcare compliance validation
   */
  const fetchCampaigns = useCallback(async () => {
    try {
      dispatch(campaignActions.setLoading(true));
      const response = await campaignService.getCampaigns();
      dispatch(campaignActions.setCampaigns(response));
    } catch (error) {
      dispatch(campaignActions.setError(error.message));
    } finally {
      dispatch(campaignActions.setLoading(false));
    }
  }, [dispatch]);

  /**
   * Fetches a single campaign by ID with compliance status
   */
  const fetchCampaignById = useCallback(async (campaignId: string) => {
    if (!campaignId) return;

    try {
      dispatch(campaignActions.setLoading(true));
      const response = await campaignService.getCampaignById(campaignId);
      dispatch(campaignActions.setCurrentCampaign(response));
      
      // Validate healthcare compliance
      const compliance = await validateCompliance(response);
      setLocalCompliance(compliance);
    } catch (error) {
      dispatch(campaignActions.setError(error.message));
    } finally {
      dispatch(campaignActions.setLoading(false));
    }
  }, [dispatch]);

  /**
   * Creates a new campaign with healthcare compliance checks
   */
  const createCampaign = useCallback(async (data: Omit<Campaign, 'id'>) => {
    try {
      dispatch(campaignActions.setLoading(true));
      setValidationErrors([]);

      // Validate healthcare compliance
      const compliance = await validateCompliance(data as Campaign);
      if (!compliance.isCompliant) {
        setValidationErrors(compliance.violations);
        throw new Error('Healthcare compliance validation failed');
      }

      // Check LGPD consent requirements
      const consentStatus = await checkLGPDConsent(data);
      if (!consentStatus.hasConsent) {
        throw new Error('LGPD consent requirements not met');
      }

      // Convert schedule times to Brazil timezone
      const enhancedData = {
        ...data,
        schedule: {
          ...data.schedule,
          start_date: utcToZonedTime(data.schedule.start_date, brTimeZone),
          end_date: data.schedule.end_date 
            ? utcToZonedTime(data.schedule.end_date, brTimeZone)
            : null,
        },
      };

      const response = await campaignService.createCampaign(enhancedData);
      dispatch(campaignActions.addCampaign(response));
      return response;
    } catch (error) {
      dispatch(campaignActions.setError(error.message));
      throw error;
    } finally {
      dispatch(campaignActions.setLoading(false));
    }
  }, [dispatch]);

  /**
   * Updates an existing campaign with compliance validation
   */
  const updateCampaign = useCallback(async (campaignId: string, updates: Partial<Campaign>) => {
    try {
      dispatch(campaignActions.setLoading(true));
      setValidationErrors([]);

      // Validate healthcare compliance for updates
      const compliance = await validateCompliance({ ...campaign, ...updates } as Campaign);
      if (!compliance.isCompliant) {
        setValidationErrors(compliance.violations);
        throw new Error('Healthcare compliance validation failed');
      }

      const response = await campaignService.updateCampaign(campaignId, updates);
      dispatch(campaignActions.updateCampaign(response));
      return response;
    } catch (error) {
      dispatch(campaignActions.setError(error.message));
      throw error;
    } finally {
      dispatch(campaignActions.setLoading(false));
    }
  }, [dispatch, campaign]);

  /**
   * Deletes a campaign with proper cleanup
   */
  const deleteCampaign = useCallback(async (campaignId: string) => {
    try {
      dispatch(campaignActions.setLoading(true));
      await campaignService.deleteCampaign(campaignId);
      dispatch(campaignActions.removeCampaign(campaignId));
    } catch (error) {
      dispatch(campaignActions.setError(error.message));
      throw error;
    } finally {
      dispatch(campaignActions.setLoading(false));
    }
  }, [dispatch]);

  /**
   * Validates campaign content for healthcare compliance
   */
  const validateCompliance = useCallback(async (campaignData: Campaign): Promise<HealthcareCompliance> => {
    try {
      const compliance = await campaignService.validateHealthcareCompliance(campaignData);
      setLocalCompliance(compliance);
      return compliance;
    } catch (error) {
      console.error('Compliance validation failed:', error);
      throw error;
    }
  }, []);

  /**
   * Checks LGPD consent status for campaign audience
   */
  const checkLGPDConsent = useCallback(async (campaignData: Campaign | Partial<Campaign>): Promise<LGPDConsent> => {
    try {
      const consent = await campaignService.validateLGPDConsent(campaignData);
      setLgpdStatus(consent);
      return consent;
    } catch (error) {
      console.error('LGPD consent validation failed:', error);
      throw error;
    }
  }, []);

  // Load campaign data on mount or ID change
  useEffect(() => {
    if (id) {
      fetchCampaignById(id);
    } else {
      fetchCampaigns();
    }
  }, [id, fetchCampaignById, fetchCampaigns]);

  // Memoized campaign metrics
  const campaignMetrics = useMemo(() => {
    if (!campaign) return null;
    return {
      deliveryRate: (campaign.metrics.messages_delivered / campaign.metrics.messages_sent) * 100,
      conversionRate: (campaign.metrics.conversion_rate) * 100,
      consentRate: (campaign.metrics.consent_rates) * 100,
    };
  }, [campaign]);

  return {
    // Campaign data
    campaigns,
    campaign,
    loading,
    error,
    validationErrors,
    
    // Compliance and consent
    complianceStatus: localCompliance,
    lgpdStatus,
    
    // Campaign metrics
    metrics: campaignMetrics,
    
    // Operations
    fetchCampaigns,
    fetchCampaignById,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    validateCompliance,
    checkLGPDConsent,
  };
}