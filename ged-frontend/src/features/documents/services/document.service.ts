import axios from 'axios';
import { api } from '../../../lib/axios';
import type {
  CreateDocumentInput,
  CreateDocumentResponse,
  CreateRevisionResponse,
  DocumentDetail,
  PresignedUrlResult,
  UploadPhase,
} from '../types/document.types';
import type { ApprovalStatus } from '../../../types/prisma-types';

const getFileType = (file: File): string => file.type || 'application/octet-stream';

/**
 * Service de integração com a API para o domínio de documentos.
 *
 * Segue o mesmo padrão do transmittal.service.ts: métodos estáticos
 * que envolvem a instância `api` do Axios e retornam tipos rigorosos.
 */
export const documentService = {
  /**
   * Busca o detalhamento completo de um documento (Épico 8).
   *
   * @param id - ID do documento na base Prisma
   * @returns DocumentDetail com metadados, revisões, workflows e transmittals
   */
  async getById(id: number): Promise<DocumentDetail> {
    const response = await api.get<DocumentDetail>(`/documents/${id}`);
    return response.data;
  },

  // ── FASE 2 (Nível Enterprise): S3 Pre-signed URLs ────────────────────────
  // Fluxo de upload em 3 etapas:
  //   1) getPresignedUrl  → Backend devolve { uploadUrl, fileKey }.
  //   2) uploadToS3       → PUT binário DIRETO na AWS (axios cru, sem
  //                         baseURL/interceptors da nossa API).
  //   3) createDocument / createRevision → JSON com a fileKey na rota oficial.

  /**
   * Passo 1 — Solicita uma pre-signed URL de upload (PUT autenticado no S3).
   */
  async getPresignedUrl(fileName: string, fileType: string): Promise<PresignedUrlResult> {
    const response = await api.post<PresignedUrlResult>('/documents/presigned-url', {
      fileName,
      fileType,
    });
    return response.data;
  },

  /**
   * Passo 2 — Envia o arquivo BINÁRIO direto para a AWS S3.
   * NÃO usa a instância `api`: a pre-signed URL já carrega a autenticação e o
   * destino (bucket), então o axios cru evita o baseURL local e o header
   * Authorization que causariam erro de CORS no PUT cross-origin.
   */
  async uploadToS3(file: File, uploadUrl: string): Promise<void> {
    await axios.put(uploadUrl, file, {
      headers: { 'Content-Type': getFileType(file) },
    });
  },

  /**
   * Passo 3 — Registra o novo documento (R0) na base enviando a fileKey.
   * O arquivo já está no bucket; aqui só os metadados trafegam (JSON).
   */
  async createDocument(payload: CreateDocumentInput & { fileKey: string }): Promise<CreateDocumentResponse> {
    const response = await api.post<CreateDocumentResponse>('/documents/upload', payload);
    return response.data;
  },

  /**
   * Passo 3 — Registra uma nova revisão oficial (R+1) enviando a fileKey.
   */
  async createRevision(documentId: number, fileKey: string): Promise<CreateRevisionResponse> {
    const response = await api.post<CreateRevisionResponse>(`/documents/${documentId}/revisions`, { fileKey });
    return response.data;
  },

  /**
   * Orquestra o fluxo completo de envio de um novo documento (R0):
   * pre-signed URL → PUT no S3 → registro no backend.
   *
   * @param onPhase - Callback opcional para informar a etapa corrente na UI.
   */
  async submitDocument(
    file: File,
    payload: CreateDocumentInput,
    onPhase?: (phase: UploadPhase) => void
  ): Promise<CreateDocumentResponse> {
    onPhase?.('presign');
    const { uploadUrl, fileKey } = await this.getPresignedUrl(file.name, getFileType(file));

    onPhase?.('upload');
    await this.uploadToS3(file, uploadUrl);

    onPhase?.('register');
    return this.createDocument({ ...payload, fileKey });
  },

  /**
   * Orquestra o fluxo completo de envio de uma nova revisão (R+1):
   * pre-signed URL → PUT no S3 → registro no backend.
   */
  async submitRevision(
    documentId: number,
    file: File,
    onPhase?: (phase: UploadPhase) => void
  ): Promise<CreateRevisionResponse> {
    onPhase?.('presign');
    const { uploadUrl, fileKey } = await this.getPresignedUrl(file.name, getFileType(file));

    onPhase?.('upload');
    await this.uploadToS3(file, uploadUrl);

    onPhase?.('register');
    return this.createRevision(documentId, fileKey);
  },

  /**
   * ÉPICO 10 / PATCH 10.2 — Motor de Aprovação Estrito.
   * Executa uma ação de aprovação exigindo um dos status exatos do fluxo.
   * O payload é enviado como multipart/form-data para suportar o anexo do
   * PDF comentado (campo `commentedFile`) em APROVADO_COM_COMENTARIOS/REPROVADO.
   *
   * @param approvalId    - ID do ApprovalWorkflow
   * @param status        - 'APROVADO' | 'APROVADO_COM_COMENTARIOS' | 'REPROVADO'
   * @param comments      - Comentário/justificativa (obrigatório nos dois últimos)
   * @param commentedFile - Arquivo PDF comentado opcional (File | Blob)
   */
  async approveRevision(
    approvalId: number,
    status: Exclude<ApprovalStatus, 'PENDENTE'>,
    comments?: string,
    commentedFile?: File | Blob | null
  ): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('status', status);
    if (comments) {
      formData.append('comments', comments);
    }
    if (commentedFile) {
      formData.append('commentedFile', commentedFile);
    }

    const response = await api.post<{ message: string }>(`/approvals/${approvalId}/action`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  /**
   * PATCH 10.3 — Retrabalho Interno (Correção sem gerar Revisão Oficial).
   * Substitui o PDF da MESMA revisão (R0 permanece R0) e reinicia o ciclo
   * interno de aprovações no backend (novo carimbo VERIFICACAO PENDENTE).
   *
   * @param documentId - ID do documento pai
   * @param revisionId - ID da revisão que será corrigida internamente
   * @param file       - Novo arquivo técnico corrigido (PDF/DWG)
   */
  async submitInternalCorrection(
    documentId: number,
    revisionId: number,
    file: File | Blob
  ): Promise<{ message: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<{ message: string }>(
      `/documents/${documentId}/revisions/${revisionId}/internal-update`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data;
  },

  /**
   * ÉPICO 11 — Exportação de MDR (Master Document Register).
   * Faz o download de uma planilha .xlsx com todos os metadados consolidados
   * do contrato (Código, Título, Disciplina, Pacote, Revisão, Status, Data).
   *
   * @param contractId - ID do contrato ativo
   * @returns Blob do arquivo .xlsx
   */
  async exportMDR(contractId: number): Promise<Blob> {
    const response = await api.get('/documents/export/mdr', {
      params: { contractId },
      responseType: 'blob',
    });
    return response.data;
  },
};
