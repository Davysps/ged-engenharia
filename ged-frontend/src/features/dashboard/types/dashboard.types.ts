/**
 * Tipos rigorosos para o Dashboard Geral de Indicadores Operacionais.
 *
 * Todos os imports são `import type` para compatibilidade com
 * verbatimModuleSyntax (exigido pelo tsconfig.app.json do frontend).
 *
 * Fonte de verdade: prisma/schema.prisma + resposta da API backend
 * (src/modules/dashboard/dashboard.service.ts)
 */

import type { TransmittalStatus, ContractRole } from '../../../types/prisma-types';

// ─────────────────────────────────────────────────────────────────────────────
// KPIs Consolidados
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentByDiscipline {
  disciplina: string;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status das Revisões
// ─────────────────────────────────────────────────────────────────────────────

export type RevisionStatusCounts = Record<string, number>;

// ─────────────────────────────────────────────────────────────────────────────
// Fila de Trabalho — Pendências de Aprovação
// ─────────────────────────────────────────────────────────────────────────────

export interface PendingApproval {
  id: number;
  codigoDocumento: string;
  titulo: string;
  disciplina: string;
  versionLabel: string;
  solicitante: string;
  dataSolicitacao: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Histórico Recente — Transmittals
// ─────────────────────────────────────────────────────────────────────────────

export interface RecentTransmittal {
  id: number;
  codigo: string;
  assunto: string;
  status: TransmittalStatus;
  createdAt: string;
  createdByNome: string;
  itemCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard Response (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardData {
  contractId: number;
  userRole: ContractRole;
  documentsByDiscipline: DocumentByDiscipline[];
  revisionStatusCounts: RevisionStatusCounts;
  pendingApprovals: PendingApproval[];
  recentTransmittals: RecentTransmittal[];
}
