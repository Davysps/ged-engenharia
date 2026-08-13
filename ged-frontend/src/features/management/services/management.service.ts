import { api } from '../../../lib/axios';
import type {
  ContractDiscipline,
  ContractUser,
  DisciplineFormInput,
  UserInviteInput,
} from '../types/management.types';

/**
 * Service de integração com a API para o Épico 6: Gestão de Usuários e Disciplinas.
 *
 * Segue o mesmo padrão do dashboard.service.ts: métodos que envolvem a
 * instância `api` do Axios e retornam tipos rigorosos.
 *
 * A autenticação (Bearer Token) é injetada automaticamente pelo
 * interceptor configurado em src/lib/axios.ts.
 */
export const managementService = {
  /**
   * Lista todas as disciplinas de um contrato (tenant).
   * GET /management/disciplines?contractId=X
   */
  async listDisciplines(contractId: number): Promise<ContractDiscipline[]> {
    const response = await api.get<ContractDiscipline[]>('/management/disciplines', {
      params: { contractId },
    });
    return response.data;
  },

  /**
   * Cria uma nova disciplina para um contrato.
   * POST /management/disciplines?contractId=X
   */
  async createDiscipline(
    contractId: number, data: DisciplineFormInput
  ): Promise<ContractDiscipline> {
    const response = await api.post<ContractDiscipline>('/management/disciplines', data, {
      params: { contractId },
    });
    return response.data;
  },

  /**
   * Atualiza uma disciplina existente.
   * PATCH /management/disciplines/:disciplineId?contractId=X
   */
  async updateDiscipline(
    contractId: number, disciplineId: number, data: DisciplineFormInput
  ): Promise<ContractDiscipline> {
    const response = await api.patch<ContractDiscipline>(
      `/management/disciplines/${disciplineId}`, data,
      { params: { contractId } }
    );
    return response.data;
  },

  /**
   * Remove uma disciplina.
   * DELETE /management/disciplines/:disciplineId?contractId=X
   */
  async deleteDiscipline(
    contractId: number, disciplineId: number
  ): Promise<ContractDiscipline> {
    const response = await api.delete<ContractDiscipline>(
      `/management/disciplines/${disciplineId}`,
      { params: { contractId } }
    );
    return response.data;
  },

  /**
   * Lista todos os membros (usuários) de um contrato.
   * GET /management/users?contractId=X
   */
  async listUsers(contractId: number): Promise<ContractUser[]> {
    const response = await api.get<ContractUser[]>('/management/users', {
      params: { contractId },
    });
    return response.data;
  },

  /**
   * Convida um novo usuário para o contrato.
   * POST /management/users/invite?contractId=X
   */
  async inviteUser(
    contractId: number, data: UserInviteInput
  ): Promise<ContractUser> {
    const response = await api.post<ContractUser>('/management/users/invite', data, {
      params: { contractId },
    });
    return response.data;
  },
};
