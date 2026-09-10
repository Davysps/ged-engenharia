/**
 * Tipos rigorosos para a tela de Detalhamento de Documentos (Épico 8).
 *
 * Todos os imports são `import type` para compatibilidade com
 * verbatimModuleSyntax (exigido pelo tsconfig.app.json do frontend).
 */

import type { RevisionStatus, ApprovalStatus, ApprovalStage, TransmittalStatus, ContractRole } from '../../../types/prisma-types';

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

// ÉPICO 8: Referências das relações do documento (Disciplina e Pacote de Trabalho)
export interface ContractDisciplineRef {
  id: number;
  nome: string;
  codigo: string;
}

export interface WorkPackageRef {
  id: number;
  nome: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────────────────────

export interface ApprovalWorkflowDetail {
  id: number;
  status: ApprovalStatus;
  // PATCH 10.2: Estágio do carimbo na Máquina de Estados (Verificação/Aprovação/Cliente)
  stage: ApprovalStage;
  requester: UserInfo;
  reviewer: UserInfo | null;
  comments: string | null;
  // PATCH 10.2: Link do PDF comentado anexado na análise
  commentedFileUrl: string | null;
  // ÉPICO 10: Atores — true = Cliente (externo), false = Time (interno)
  isClient: boolean;
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
  // PATCH 10.2: Histórico completo de carimbos (Verificação → Aprovação → Cliente)
  approvalWorkflows: ApprovalWorkflowDetail[];
  transmittalItems: TransmittalItemDetail[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Document Detail (Single Source of Truth)
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentDetail {
  id: number;
  codigoDocumento: string;
  titulo: string;
  contractDiscipline: ContractDisciplineRef | null;
  workPackage: WorkPackageRef | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  contract: ContractInfo;
  createdBy: UserInfo;
  revisions: RevisionDetail[];
  userRole: ContractRole | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 (Nível Enterprise): S3 Pre-signed URLs
// ─────────────────────────────────────────────────────────────────────────────

export interface PresignedUrlResult {
  uploadUrl: string;
  fileKey: string;
  filePath: string;
  fileHash: string;
}

// Etapa atual do fluxo de upload em 3 passos (usado para feedback de loading)
export type UploadPhase = 'presign' | 'upload' | 'register';

export interface CreateDocumentInput {
  contractId: number;
  codigoDocumento: string;
  titulo: string;
  workPackageId?: number | null;
  contractDisciplineId?: number | null;
}

export interface CreateDocumentResponse {
  id: number;
  codigoDocumento: string;
  titulo: string;
  revisions: {
    id: number;
    versionLabel: string;
    filePath: string;
    fileHash: string;
  }[];
}

export interface CreateRevisionResponse {
  id: number;
  versionLabel: string;
  filePath: string;
  fileHash: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document List (Acervo Técnico — listagem densa)
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentListItemRevision {
  id: number;
  versionLabel: string;
  filePath: string;
  createdAt: string;
}

export interface DocumentListItem {
  id: number;
  codigoDocumento: string;
  titulo: string;
  contractDiscipline: ContractDisciplineRef | null;
  workPackage: WorkPackageRef | null;
  revisions: DocumentListItemRevision[];
}

export interface DocumentListFilters {
  busca?: string;
  disciplinaId?: string;
  pacoteId?: string;
}
