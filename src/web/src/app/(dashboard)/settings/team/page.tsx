'use client';

import React, { useEffect, useState } from 'react';
import { Metadata } from 'next';
import TeamManagement from '@/components/settings/TeamManagement';
import { useAuth } from '@/hooks/useAuth';
import { UserRole } from '@/types/auth';

/**
 * Generates metadata for the team settings page
 * @returns Metadata configuration
 */
export const generateMetadata = (): Metadata => {
  return {
    title: 'Configurações da Equipe | Porfin',
    description: 'Gerencie os membros da sua equipe e suas permissões de forma segura e em conformidade com a LGPD',
    robots: 'noindex, nofollow',
  };
};

/**
 * Team settings page component with RBAC and LGPD compliance
 * Implements requirements from Technical Specifications/7.1 Authentication and Authorization
 */
const TeamSettingsPage: React.FC = () => {
  const { user, loading, error } = useAuth();
  const [hasPermission, setHasPermission] = useState(false);

  // Check user permissions for team management
  useEffect(() => {
    if (user) {
      const allowedRoles = [UserRole.ADMIN, UserRole.MANAGER];
      setHasPermission(allowedRoles.includes(user.role));
    }
  }, [user]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-2 text-gray-600 dark:text-gray-400">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">
        <p>Erro ao carregar configurações da equipe: {error}</p>
      </div>
    );
  }

  // Permission denied state
  if (!hasPermission) {
    return (
      <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400">
        <p>Você não tem permissão para acessar as configurações da equipe.</p>
      </div>
    );
  }

  // Audit log wrapper for team changes
  const handleTeamUpdate = (members: any[]) => {
    // Log team changes for LGPD compliance
    console.log('Team update audit:', {
      actor: user?.email,
      action: 'team_update',
      timestamp: new Date().toISOString(),
      details: {
        updated_members: members.map(m => ({
          id: m.id,
          role: m.role,
          updated_at: m.updated_at
        }))
      }
    });
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Configurações da Equipe
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Gerencie os membros da sua equipe e suas permissões de acordo com a LGPD
        </p>
      </div>

      {/* Team management component */}
      <TeamManagement
        currentUser={user!}
        onTeamUpdate={handleTeamUpdate}
        className="bg-white dark:bg-gray-800 rounded-lg shadow"
      />

      {/* LGPD compliance notice */}
      <div className="mt-8 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
        <p className="text-sm text-blue-600 dark:text-blue-400">
          Os dados da equipe são processados de acordo com a Lei Geral de Proteção de Dados (LGPD).
          Todas as alterações são registradas para fins de auditoria.
        </p>
      </div>
    </div>
  );
};

export default TeamSettingsPage;