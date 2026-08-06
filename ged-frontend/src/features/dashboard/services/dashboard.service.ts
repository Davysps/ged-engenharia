import { api } from '../../../lib/axios';
import type { DashboardData } from '../types/dashboard.types';

/**
 * Service de integração com a API para o Dashboard Geral de Indicadores
 * Operacionais.
 *
 * Segue o mesmo padrão do transmittal.service.ts: métodos estáticos
 * que envolvem a instância `api` do Axios e retornam tipos rigorosos.
 *
 * A autenticação (Bearer Token) é injetada automaticamente pelo
 * interceptor configurado em src/lib/axios.ts.
 */
export const dashboardService = {
  /**
   * Busca todos os indicadores operacionais de um contrato (tenant).
   *
   * @param contractId - ID do contrato (tenant) extraído da URL da rota
   * @returns DashboardData com KPIs, status, fila de trabalho e histórico
   */
  async getDashboardData(contractId: number): Promise<DashboardData> {
    const response = await api.get<DashboardData>('/dashboard', {
      params: { contractId },
    });
    return response.data;
  },
};
