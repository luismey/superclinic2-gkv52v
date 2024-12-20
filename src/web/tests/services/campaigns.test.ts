// @version: 1.0.0
// @jest-environment jsdom
import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals'; // v29.0.0
import dayjs from 'dayjs'; // v1.11.0
import utc from 'dayjs/plugin/utc'; // v1.11.0
import timezone from 'dayjs/plugin/timezone'; // v1.11.0
import type { MockInstance } from 'jest-mock'; // v29.0.0

import campaignService from '../../src/services/campaigns';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
  TargetAudienceType,
  HealthcareCompliance,
  LGPDConsent,
} from '../../src/types/campaigns';

// Configure dayjs for timezone handling
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('America/Sao_Paulo');

// Mock API client
jest.mock('../../src/lib/api');

describe('Campaign Service', () => {
  // Helper function to create mock campaign data
  const mockCampaign = (overrides: Partial<Campaign> = {}): Campaign => ({
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'Test Campaign',
    description: 'Healthcare campaign test',
    type: CampaignType.ONE_TIME,
    status: CampaignStatus.DRAFT,
    target_audience: TargetAudienceType.ACTIVE_PATIENTS,
    healthcareCategory: 'dental',
    created_at: new Date(),
    updated_at: new Date(),
    template: {
      name: 'Follow-up Template',
      content: 'Olá {{name}}, seu tratamento está agendado para {{date}}',
      variables: ['name', 'date'],
      language: 'pt-BR',
      category: 'follow_up',
      lgpdCompliant: true,
      consentRequired: true,
      medicalDisclaimer: 'Este é um lembrete automático. Consulte seu profissional de saúde.',
    },
    schedule: {
      start_date: new Date(),
      end_date: null,
      time_slots: ['09:00-17:00'],
      timezone: 'America/Sao_Paulo',
      recurrence_pattern: null,
      businessHoursOnly: true,
      respectLocalHolidays: true,
    },
    metrics: {
      total_recipients: 0,
      messages_sent: 0,
      messages_delivered: 0,
      messages_read: 0,
      responses_received: 0,
      conversion_rate: 0,
      appointment_bookings: 0,
      consent_rates: 0,
    },
    consentTracking: {
      consentRequired: true,
      consentMessage: 'Ao prosseguir, você concorda com o uso de seus dados conforme a LGPD.',
      consentExpiryDays: 365,
      trackingEnabled: true,
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Campaign CRUD Operations', () => {
    test('should create campaign with healthcare compliance', async () => {
      const newCampaign = mockCampaign();
      const api = jest.requireMock('../../src/lib/api').default;
      api.post.mockResolvedValueOnce({ data: newCampaign });

      const result = await campaignService.createCampaign(newCampaign);

      expect(result).toEqual(newCampaign);
      expect(api.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          template: expect.objectContaining({
            language: 'pt-BR',
            lgpdCompliant: true,
          }),
        })
      );
    });

    test('should retrieve campaigns with LGPD consent filter', async () => {
      const campaigns = [mockCampaign(), mockCampaign()];
      const api = jest.requireMock('../../src/lib/api').default;
      api.get.mockResolvedValueOnce({ data: campaigns });

      const result = await campaignService.getCampaigns();

      expect(result).toEqual(campaigns);
      expect(result.every(c => c.consentTracking.trackingEnabled)).toBe(true);
    });

    test('should update campaign while maintaining compliance', async () => {
      const campaign = mockCampaign();
      const updates = {
        name: 'Updated Campaign',
        template: {
          ...campaign.template,
          content: 'Updated content with disclaimer',
        },
      };

      const api = jest.requireMock('../../src/lib/api').default;
      api.get.mockResolvedValueOnce({ data: campaign });
      api.put.mockResolvedValueOnce({ data: { ...campaign, ...updates } });

      const result = await campaignService.updateCampaign(campaign.id, updates);

      expect(result.template.lgpdCompliant).toBe(true);
      expect(result.template.medicalDisclaimer).toBeTruthy();
    });

    test('should delete campaign and clean up associated data', async () => {
      const api = jest.requireMock('../../src/lib/api').default;
      api.delete.mockResolvedValueOnce({ data: null });

      await campaignService.deleteCampaign('test-id');

      expect(api.delete).toHaveBeenCalledWith(expect.stringContaining('test-id'));
    });
  });

  describe('Healthcare Compliance Validation', () => {
    test('should validate medical disclaimers', async () => {
      const campaign = mockCampaign({
        template: {
          ...mockCampaign().template,
          medicalDisclaimer: '',
        },
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('Medical disclaimer is required for healthcare campaigns');
    });

    test('should verify professional credentials', async () => {
      const campaign = mockCampaign({
        healthcareCategory: 'dental_specialist',
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.recommendations).toContain(
        'Consider restricting messages to business hours for better engagement'
      );
    });

    test('should enforce Brazilian healthcare regulations', async () => {
      const campaign = mockCampaign({
        template: {
          ...mockCampaign().template,
          language: 'en',
        },
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.violations).toContain('Campaign content must be in Brazilian Portuguese');
    });
  });

  describe('LGPD Compliance', () => {
    test('should track consent status', async () => {
      const campaign = mockCampaign({
        consentTracking: {
          ...mockCampaign().consentTracking,
          trackingEnabled: false,
        },
      });

      await expect(campaignService.createCampaign(campaign)).rejects.toThrow(
        'LGPD consent tracking must be enabled'
      );
    });

    test('should validate data usage purposes', async () => {
      const campaign = mockCampaign();
      const api = jest.requireMock('../../src/lib/api').default;
      api.post.mockResolvedValueOnce({ data: campaign });

      await campaignService.createCampaign(campaign);

      expect(api.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          consentTracking: expect.objectContaining({
            consentMessage: expect.stringContaining('LGPD'),
          }),
        })
      );
    });

    test('should handle consent expiration', async () => {
      const campaign = mockCampaign({
        consentTracking: {
          ...mockCampaign().consentTracking,
          consentExpiryDays: 0,
        },
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.isCompliant).toBe(false);
      expect(result.violations).toContain('Invalid consent expiration period');
    });
  });

  describe('Brazilian Market Specifics', () => {
    test('should validate business hours', async () => {
      const campaign = mockCampaign({
        schedule: {
          ...mockCampaign().schedule,
          time_slots: ['22:00-23:00'],
        },
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.recommendations).toContain(
        'Consider restricting messages to business hours for better engagement'
      );
    });

    test('should handle Brazilian holidays', async () => {
      const campaign = mockCampaign({
        schedule: {
          ...mockCampaign().schedule,
          respectLocalHolidays: false,
        },
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.recommendations).toContain(
        'Enable Brazilian holiday awareness for better timing'
      );
    });

    test('should verify Portuguese content', async () => {
      const campaign = mockCampaign({
        template: {
          ...mockCampaign().template,
          content: 'Hello {{name}}, your appointment is scheduled.',
        },
      });

      const result = await campaignService.validateHealthcareCompliance(campaign);

      expect(result.violations).toContain('Campaign content must be in Brazilian Portuguese');
    });
  });
});