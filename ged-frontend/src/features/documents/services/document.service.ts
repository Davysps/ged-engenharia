import { api } from '../../../lib/axios';
import type { DocumentDetail } from '../types/document.types';
import type { ApprovalStatus } from '../../../types/prisma-types';

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
