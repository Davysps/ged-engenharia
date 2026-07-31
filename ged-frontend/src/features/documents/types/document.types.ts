-0/**
 * Tipos rigorosos para a tela de Detalhamento de Documentos (Épico 8).
 * 
 * Todos os imports são `import type` para compatibilidade com
 * verbatimModuleSyntax (exigido pelo tsconfig.app.json do frontend).
 */

import type { Discipline, RevisionStatus, ApprovalStatus, DocumentOcrStatus, TransmittalStatus, ContractRole } from '../../../types/prisma-types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos Auxiliares
// ─────────────────────────────────────────────────────────────────────────────

export interface UserInfo {
  nome: string;
  email?: string;
}

export interface ClientInfo {
  id: number;
  nome: string;
  cnpj?: string | null;
}

export interface ContractInfo {
  id: number;
  codigo: string;
  nome: string;
  client: ClientInfo;
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────────────────────

export interface ApprovalWorkflowDetail {
  id: number;
  status: ApprovalStatus;
  requester: UserInfo;
  reviewer: UserInfo | null;
  comments: string | null;
  requestedAt: string;
  reviewedAt: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transmittal Reference
// ─────────────────────────────────────────────────────────────────────────────

export interface TransmittalReference {
  id: number;
  codigo: string;
  assunto: string;
  status: TransmittalStatus;
  createdAt: string;
  createdBy: UserInfo;
}

export interface TransmittalItemDetail {
  id: number;
  transmittal: TransmittalReference;
}

// ─────────────────────────────────────────────────────────────────────────────
// Revision
// ─────────────────────────────────────────────────────────────────────────────

export interface RevisionDetail {
  id: number;
  documentId: number;
  versionLabel: string;
  filePath: string;
  fileHash: string;
  status: RevisionStatus;
  createdAt: string;
  approvalWorkflow: ApprovalWorkflowDetail | null;
  transmittalItems: TransmittalItemDetail[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Detail (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentDetail {
  id: number;
  codigoDocumento: string;
  titulo: string;
  disciplina: Discipline;
  metadata: Record<string, unknown> | null;
  ocrStatus: DocumentOcrStatus;
  projectNumber: string | null;
  extractedRevision: string | null;
  extractedMetadata: Record<string, unknown> | null;
  createdAt: string;
  contract: ContractInfo;
  createdBy: UserInfo;
  revisions: RevisionDetail[];
  userRole: ContractRole | null;
}
