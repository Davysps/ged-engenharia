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
   * ÉPICO 10 — Motor de Aprovação Estrito.
   * Executa uma ação de aprovação exigindo um dos status exatos do fluxo.
   *
   * @param approvalId - ID do ApprovalWorkflow
   * @param status     - 'APROVADO' | 'APROVADO_COM_COMENTARIOS' | 'REPROVADO'
   * @param comments   - Comentário/justificativa (obrigatório nos dois últimos)
   */
  async approveRevision(
    approvalId: number,
    status: Exclude<ApprovalStatus, 'PENDENTE'>,
    comments?: string
  ): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>(`/approvals/${approvalId}/action`, {
      status,
      comments,
    });
    return response.data;
  },
};
