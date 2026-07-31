import { api } from '../../../lib/axios';
import type { DocumentDetail } from '../types/document.types';

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
};
