import { renderHook, act } from '@testing-library/react-hooks';
import { Provider } from 'react-redux';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import MockedWebSocket from 'jest-websocket-mock';

import { useCampaign } from '../../src/hooks/useCampaign';
import campaignService from '../../src/services/campaigns';
import { configureStore } from '@reduxjs/toolkit';
import campaignReducer from '../../src/store/campaignSlice';
import { 
  Campaign, 
  CampaignStatus, 
  CampaignType, 
  TargetAudienceType 
} from '../../src/types/campaigns';

// Mock campaign data with healthcare compliance fields
const mockCampaign: Campaign = {
  id: '123',
  name: 'Test Campaign',
  description: 'Healthcare campaign test',
  type: CampaignType.TREATMENT_FOLLOWUP,
  status: CampaignStatus.DRAFT,
  target_audience: TargetAudienceType.POST_TREATMENT,
  template: {
    name: 'Follow-up Template',
    content: 'Olá {{name}}, seu tratamento foi realizado em {{treatment_date}}',
    variables: ['name', 'treatment_date'],
    language: 'pt-BR',
    category: 'healthcare',
    lgpdCompliant: true,
    consentRequired: true,
    medicalDisclaimer: 'Este é um lembrete médico oficial.'
  },
  schedule: {
    start_date: new Date(),
    end_date: new Date(Date.now() + 86400000),
    time_slots: ['09:00-18:00'],
    timezone: 'America/Sao_Paulo',
    recurrence_pattern: null,
    businessHoursOnly: true,
    respectLocalHolidays: true
  },
  metrics: {
    total_recipients: 100,
    messages_sent: 50,
    messages_delivered: 45,
    messages_read: 30,
    responses_received: 10,
    conversion_rate: 0.2,
    appointment_bookings: 5,
    consent_rates: 0.95
  },
  consentTracking: {
    consentRequired: true,
    consentMessage: 'Você concorda em receber comunicações médicas?',
    consentExpiryDays: 365,
    trackingEnabled: true
  },
  healthcareCategory: 'post_treatment_care',
  created_at: new Date(),
  updated_at: new Date()
};

// Mock WebSocket server
let mockWebSocket: MockedWebSocket;

// Setup test environment
const setupTest = () => {
  // Create mock store
  const store = configureStore({
    reducer: {
      campaign: campaignReducer
    }
  });

  // Setup WebSocket mock
  mockWebSocket = new MockedWebSocket('ws://localhost:8000');

  // Mock service functions
  const mockServiceFunctions = {
    getCampaigns: jest.spyOn(campaignService, 'getCampaigns'),
    getCampaignById: jest.spyOn(campaignService, 'getCampaignById'),
    validateHealthcareCompliance: jest.spyOn(campaignService, 'validateHealthcareCompliance'),
    validateLGPDConsent: jest.spyOn(campaignService, 'validateLGPDConsent')
  };

  // Create wrapper with Provider
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return { store, mockServiceFunctions, wrapper };
};

describe('useCampaign', () => {
  let cleanup: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (cleanup) cleanup();
    mockWebSocket.close();
  });

  it('should validate healthcare compliance when creating campaign', async () => {
    const { mockServiceFunctions, wrapper } = setupTest();
    
    // Mock compliance validation response
    mockServiceFunctions.validateHealthcareCompliance.mockResolvedValue({
      isCompliant: true,
      violations: [],
      recommendations: [],
      lgpdStatus: {
        consentRequired: true,
        consentMessage: mockCampaign.consentTracking.consentMessage,
        dataRetentionDays: mockCampaign.consentTracking.consentExpiryDays
      }
    });

    const { result } = renderHook(() => useCampaign(), { wrapper });

    await act(async () => {
      await result.current.createCampaign(mockCampaign);
    });

    expect(mockServiceFunctions.validateHealthcareCompliance).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          language: 'pt-BR',
          medicalDisclaimer: expect.any(String)
        })
      })
    );
  });

  it('should enforce LGPD consent requirements', async () => {
    const { mockServiceFunctions, wrapper } = setupTest();

    // Mock LGPD consent validation
    mockServiceFunctions.validateLGPDConsent.mockResolvedValue({
      hasConsent: true,
      consentDate: new Date(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      consentType: 'explicit',
      dataUsageScope: ['marketing', 'treatment_followup']
    });

    const { result } = renderHook(() => useCampaign(), { wrapper });

    await act(async () => {
      await result.current.checkLGPDConsent(mockCampaign);
    });

    expect(result.current.lgpdStatus).toEqual(
      expect.objectContaining({
        hasConsent: true,
        consentType: 'explicit'
      })
    );
  });

  it('should handle real-time campaign status updates', async () => {
    const { wrapper } = setupTest();
    const { result } = renderHook(() => useCampaign(mockCampaign.id), { wrapper });

    // Simulate WebSocket campaign status update
    await act(async () => {
      mockWebSocket.send(JSON.stringify({
        type: 'campaign_update',
        payload: {
          id: mockCampaign.id,
          status: CampaignStatus.ACTIVE,
          metrics: {
            messages_delivered: 60,
            conversion_rate: 0.25
          }
        }
      }));
    });

    expect(result.current.campaign?.status).toBe(CampaignStatus.ACTIVE);
    expect(result.current.metrics?.conversionRate).toBe(25);
  });

  it('should validate medical content in campaign templates', async () => {
    const { mockServiceFunctions, wrapper } = setupTest();
    
    const invalidCampaign = {
      ...mockCampaign,
      template: {
        ...mockCampaign.template,
        medicalDisclaimer: '', // Missing required disclaimer
        content: 'Conteúdo sem referência à data do tratamento' // Missing required variable
      }
    };

    mockServiceFunctions.validateHealthcareCompliance.mockResolvedValue({
      isCompliant: false,
      violations: [
        'Medical disclaimer is required for healthcare campaigns',
        'Post-treatment campaigns must include treatment date reference'
      ],
      recommendations: [],
      lgpdStatus: {
        consentRequired: true,
        consentMessage: '',
        dataRetentionDays: 365
      }
    });

    const { result } = renderHook(() => useCampaign(), { wrapper });

    await act(async () => {
      try {
        await result.current.createCampaign(invalidCampaign);
      } catch (error) {
        // Expected to throw
      }
    });

    expect(result.current.validationErrors).toHaveLength(2);
    expect(result.current.validationErrors).toContain(
      'Medical disclaimer is required for healthcare campaigns'
    );
  });

  it('should handle campaign metrics updates correctly', async () => {
    const { mockServiceFunctions, wrapper } = setupTest();
    
    mockServiceFunctions.getCampaignById.mockResolvedValue({
      ...mockCampaign,
      metrics: {
        ...mockCampaign.metrics,
        messages_delivered: 75,
        conversion_rate: 0.3
      }
    });

    const { result } = renderHook(() => useCampaign(mockCampaign.id), { wrapper });

    await act(async () => {
      await result.current.fetchCampaignById(mockCampaign.id);
    });

    expect(result.current.metrics).toEqual({
      deliveryRate: (75 / mockCampaign.metrics.messages_sent) * 100,
      conversionRate: 30,
      consentRate: mockCampaign.metrics.consent_rates * 100
    });
  });
});