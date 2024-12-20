'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Table from '../../../components/common/Table';
import Button from '../../../components/common/Button';
import { useCampaign } from '../../../hooks/useCampaign';
import useWebSocket from '../../../hooks/useWebSocket';
import {
  Campaign,
  CampaignStatus,
  CampaignType,
  HealthcareCompliance
} from '../../../types/campaigns';

/**
 * Healthcare-compliant campaign management page component
 * Implements requirements from Technical Specifications/1.3 Scope/In-Scope Elements
 */
const CampaignsPage: React.FC = () => {
  const router = useRouter();
  const [complianceStatus, setComplianceStatus] = useState<HealthcareCompliance | null>(null);

  // Campaign management hooks
  const {
    campaigns,
    loading,
    error,
    fetchCampaigns,
    deleteCampaign,
    validateCompliance
  } = useCampaign();

  // WebSocket for real-time updates
  const { connected, subscribeToChat } = useWebSocket();

  // Subscribe to real-time campaign updates
  useEffect(() => {
    if (connected) {
      subscribeToChat('campaigns');
    }
  }, [connected, subscribeToChat]);

  // Fetch campaigns on mount
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  /**
   * Handles campaign creation with healthcare compliance validation
   */
  const handleCreateCampaign = useCallback(async () => {
    try {
      // Validate healthcare compliance before navigation
      const compliance = await validateCompliance({
        type: CampaignType.ONE_TIME,
        status: CampaignStatus.DRAFT
      } as Campaign);

      if (!compliance.isCompliant) {
        throw new Error(
          `Violações de conformidade: ${compliance.violations.join(', ')}`
        );
      }

      router.push('/campaigns/new');
    } catch (error) {
      console.error('Erro ao criar campanha:', error);
      // Error handling would be implemented here
    }
  }, [router, validateCompliance]);

  /**
   * Handles campaign editing with compliance checks
   */
  const handleEditCampaign = useCallback(async (id: string) => {
    try {
      const campaign = campaigns.find(c => c.id === id);
      if (!campaign) return;

      // Validate healthcare compliance before navigation
      const compliance = await validateCompliance(campaign);
      setComplianceStatus(compliance);

      if (!compliance.isCompliant) {
        throw new Error(
          `Violações de conformidade: ${compliance.violations.join(', ')}`
        );
      }

      router.push(`/campaigns/${id}/edit`);
    } catch (error) {
      console.error('Erro ao editar campanha:', error);
      // Error handling would be implemented here
    }
  }, [campaigns, router, validateCompliance]);

  /**
   * Handles campaign deletion with LGPD considerations
   */
  const handleDeleteCampaign = useCallback(async (id: string) => {
    try {
      // Confirm deletion with compliance warnings
      const confirmed = window.confirm(
        'Esta ação excluirá permanentemente a campanha e todos os dados associados. Confirmar?'
      );

      if (confirmed) {
        await deleteCampaign(id);
        await fetchCampaigns();
      }
    } catch (error) {
      console.error('Erro ao excluir campanha:', error);
      // Error handling would be implemented here
    }
  }, [deleteCampaign, fetchCampaigns]);

  // Table column definitions with accessibility support
  const columns = [
    {
      key: 'name',
      header: 'Nome',
      render: (campaign: Campaign) => campaign.name,
      sortable: true,
      accessibilityLabel: 'Nome da campanha'
    },
    {
      key: 'type',
      header: 'Tipo',
      render: (campaign: Campaign) => {
        const types = {
          [CampaignType.ONE_TIME]: 'Única',
          [CampaignType.RECURRING]: 'Recorrente',
          [CampaignType.TRIGGERED]: 'Automatizada',
          [CampaignType.APPOINTMENT_REMINDER]: 'Lembrete',
          [CampaignType.TREATMENT_FOLLOWUP]: 'Acompanhamento'
        };
        return types[campaign.type] || campaign.type;
      },
      sortable: true,
      accessibilityLabel: 'Tipo de campanha'
    },
    {
      key: 'status',
      header: 'Status',
      render: (campaign: Campaign) => {
        const statuses = {
          [CampaignStatus.DRAFT]: 'Rascunho',
          [CampaignStatus.SCHEDULED]: 'Agendada',
          [CampaignStatus.ACTIVE]: 'Ativa',
          [CampaignStatus.PAUSED]: 'Pausada',
          [CampaignStatus.COMPLETED]: 'Concluída',
          [CampaignStatus.FAILED]: 'Falha'
        };
        return statuses[campaign.status] || campaign.status;
      },
      sortable: true,
      accessibilityLabel: 'Status da campanha'
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (campaign: Campaign) => (
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => handleEditCampaign(campaign.id)}
            ariaLabel={`Editar campanha ${campaign.name}`}
          >
            Editar
          </Button>
          <Button
            variant="ghost"
            onClick={() => handleDeleteCampaign(campaign.id)}
            ariaLabel={`Excluir campanha ${campaign.name}`}
          >
            Excluir
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Campanhas
        </h1>
        <Button
          variant="primary"
          onClick={handleCreateCampaign}
          ariaLabel="Criar nova campanha"
        >
          Nova Campanha
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <Table
          data={campaigns}
          columns={columns}
          isLoading={loading}
          emptyMessage="Nenhuma campanha encontrada"
          sortable
          className="w-full"
          ariaLabel="Lista de campanhas"
        />
      </div>

      {error && (
        <div className="text-red-600 dark:text-red-400 mt-4">
          Erro: {error}
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;