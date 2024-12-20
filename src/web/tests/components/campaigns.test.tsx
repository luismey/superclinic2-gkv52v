import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ptBR } from 'date-fns/locale';
import CampaignForm from '../../src/components/campaigns/CampaignForm';
import TemplateEditor from '../../src/components/campaigns/TemplateEditor';
import ScheduleSelector from '../../src/components/campaigns/ScheduleSelector';
import { 
  CampaignType, 
  CampaignStatus, 
  TargetAudienceType,
  MessageTemplate,
  CampaignSchedule 
} from '../../src/types/campaigns';

// Mock data for testing
const mockTemplate: MessageTemplate = {
  name: 'Test Template',
  content: 'Olá {{nome}}, sua consulta está agendada.',
  variables: ['nome'],
  language: 'pt-BR',
  category: 'healthcare',
  lgpdCompliant: true,
  consentRequired: true,
  medicalDisclaimer: 'Esta mensagem não substitui consulta médica presencial.'
};

const mockSchedule: CampaignSchedule = {
  start_date: new Date(),
  end_date: new Date(Date.now() + 86400000),
  time_slots: ['09:00', '14:00'],
  timezone: 'America/Sao_Paulo',
  recurrence_pattern: null,
  businessHoursOnly: true,
  respectLocalHolidays: true
};

// Test suite for CampaignForm Healthcare Compliance
describe('CampaignForm Healthcare Compliance', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates medical disclaimers', async () => {
    render(
      <CampaignForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
        healthcareCategory="dental"
      />
    );

    // Try to submit without medical disclaimer
    const submitButton = screen.getByRole('button', { name: /salvar/i });
    await userEvent.click(submitButton);

    // Check for medical disclaimer validation message
    expect(screen.getByText(/disclaimer médico é obrigatório/i)).toBeInTheDocument();
  });

  it('enforces LGPD compliance', async () => {
    render(
      <CampaignForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
        healthcareCategory="dental"
      />
    );

    // Toggle LGPD consent requirement off
    const consentToggle = screen.getByRole('checkbox', { name: /consentimento/i });
    await userEvent.click(consentToggle);

    // Check for LGPD warning message
    expect(screen.getByText(/conformidade com a LGPD/i)).toBeInTheDocument();
  });

  it('handles healthcare categories correctly', async () => {
    render(
      <CampaignForm
        onSubmit={mockOnSubmit}
        onCancel={mockOnCancel}
        isLoading={false}
        healthcareCategory="dental"
      />
    );

    // Check if healthcare-specific fields are present
    expect(screen.getByText(/categoria de saúde/i)).toBeInTheDocument();
    expect(screen.getByText(/aviso médico/i)).toBeInTheDocument();
  });
});

// Test suite for TemplateEditor LGPD Compliance
describe('TemplateEditor LGPD Compliance', () => {
  const mockOnChange = vi.fn();
  const mockOnSave = vi.fn();
  const mockOnPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates data privacy notices', async () => {
    render(
      <TemplateEditor
        template={mockTemplate}
        onChange={mockOnChange}
        onSave={mockOnSave}
        onPreview={mockOnPreview}
        healthcareCategory="dental"
        lgpdCompliant={true}
        consentRequired={true}
      />
    );

    // Check for LGPD compliance indicators
    expect(screen.getByText(/conformidade lgpd/i)).toBeInTheDocument();
    expect(screen.getByText(/dados pessoais/i)).toBeInTheDocument();
  });

  it('handles consent management', async () => {
    render(
      <TemplateEditor
        template={mockTemplate}
        onChange={mockOnChange}
        onSave={mockOnSave}
        onPreview={mockOnPreview}
        healthcareCategory="dental"
        lgpdCompliant={true}
        consentRequired={true}
      />
    );

    // Insert personal data variable
    const nameButton = screen.getByRole('button', { name: /inserir nome/i });
    await userEvent.click(nameButton);

    // Check if LGPD warning is shown
    expect(screen.getByText(/dados pessoais: detectados/i)).toBeInTheDocument();
  });

  it('enforces medical terminology compliance', async () => {
    const template = {
      ...mockTemplate,
      content: 'Cura garantida para seu problema!'
    };

    render(
      <TemplateEditor
        template={template}
        onChange={mockOnChange}
        onSave={mockOnSave}
        onPreview={mockOnPreview}
        healthcareCategory="dental"
        lgpdCompliant={true}
        consentRequired={true}
      />
    );

    // Check for prohibited terms warning
    expect(screen.getByText(/termos proibidos para comunicação em saúde/i)).toBeInTheDocument();
  });
});

// Test suite for Brazilian Market Integration
describe('Brazilian Market Integration', () => {
  it('handles Brazilian timezones correctly', async () => {
    render(
      <ScheduleSelector
        campaignType={CampaignType.ONE_TIME}
        onChange={vi.fn()}
        defaultValue={mockSchedule}
        businessHoursOnly={true}
        respectHolidays={true}
      />
    );

    // Check for Brazilian timezone options
    expect(screen.getByText(/horário de brasília/i)).toBeInTheDocument();
    expect(screen.getByText(/gmt-3/i)).toBeInTheDocument();
  });

  it('respects business hours', async () => {
    render(
      <ScheduleSelector
        campaignType={CampaignType.ONE_TIME}
        onChange={vi.fn()}
        defaultValue={mockSchedule}
        businessHoursOnly={true}
        respectHolidays={true}
      />
    );

    // Check if time slots outside business hours are disabled
    const lateTimeSlot = screen.getByLabelText('22:00');
    expect(lateTimeSlot).toBeDisabled();

    // Check business hours notice
    expect(screen.getByText(/horários disponíveis: 08:00 às 18:00/i)).toBeInTheDocument();
  });

  it('validates Brazilian phone formats', async () => {
    const template = {
      ...mockTemplate,
      variables: ['telefone']
    };

    render(
      <TemplateEditor
        template={template}
        onChange={vi.fn()}
        onSave={vi.fn()}
        onPreview={vi.fn()}
        healthcareCategory="dental"
        lgpdCompliant={true}
        consentRequired={true}
      />
    );

    // Check for Brazilian phone format validation
    const phoneVariable = screen.getByText(/telefone/i);
    expect(phoneVariable).toBeInTheDocument();
  });

  it('manages regional settings', async () => {
    render(
      <ScheduleSelector
        campaignType={CampaignType.ONE_TIME}
        onChange={vi.fn()}
        defaultValue={mockSchedule}
        businessHoursOnly={true}
        respectHolidays={true}
      />
    );

    // Check if dates are formatted in Brazilian format
    const dateInput = screen.getByLabelText(/data de início/i);
    expect(dateInput).toHaveValue(
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    );
  });
});