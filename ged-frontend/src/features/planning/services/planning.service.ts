import { api } from '../../../lib/axios';
import type {
  WorkPackage,
  WorkPackageFilters,
  WorkPackageFormInput,
} from '../types/planning.types';

/**
 * Service de integração com a API para o Épico 7: Módulo de Planejamento
 * e Coordenação (Pacotes de Trabalho).
 *
 * Segue o mesmo padrão do management.service.ts: métodos que envolvem a
 * instância `api` do Axios e retornam tipos rigorosos.
 *
 * A autenticação (Bearer Token) é injetada automaticamente pelo
 * interceptor configurado em src/lib/axios.ts.
 */
export const planningService = {
  /**
   * Lista os pacotes de trabalho de um contrato (tenant), com filtros
   * opcionais de status e busca por nome.
   * GET /planning?contractId=X
   */
  async listWorkPackages(
    contractId: number,
    filters?: WorkPackageFilters
  ): Promise<WorkPackage[]> {
    const response = await api.get<WorkPackage[]>('/planning', {
      params: {
        contractId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.busca ? { busca: filters.busca } : {}),
      },
    });
    return response.data;
  },

  /**
   * Cria um novo pacote de trabalho para um contrato.
   * POST /planning?contractId=X
   */
  async createWorkPackage(
    contractId: number,
    data: WorkPackageFormInput
  ): Promise<WorkPackage> {
    const response = await api.post<WorkPackage>('/planning', data, {
      params: { contractId },
    });
    return response.data;
  },

  /**
   * Atualiza um pacote de trabalho existente.
   * PATCH /planning/:workPackageId?contractId=X
   */
  async updateWorkPackage(
    contractId: number,
    workPackageId: number,
    data: Partial<WorkPackageFormInput>
  ): Promise<WorkPackage> {
    const response = await api.patch<WorkPackage>(
      `/planning/${workPackageId}`,
      data,
      { params: { contractId } }
    );
    return response.data;
  },

  /**
   * Remove um pacote de trabalho.
   * DELETE /planning/:workPackageId?contractId=X
   */
  async deleteWorkPackage(
    contractId: number,
    workPackageId: number
  ): Promise<WorkPackage> {
    const response = await api.delete<WorkPackage>(
      `/planning/${workPackageId}`,
      { params: { contractId } }
    );
    return response.data;
  },
};
