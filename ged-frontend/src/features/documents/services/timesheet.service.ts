import { api } from '../../../lib/axios';
import type { TimeLog, TimeLogFormValues } from '../types/timesheet.types';

/**
 * Service de integração com a API para o Épico 9: Apontamento de Horas.
 *
 * Segue o padrão do planning.service.ts: métodos que envolvem a instância
 * `api` do Axios e retornam tipos rigorosos.
 *
 * A autenticação (Bearer Token) é injetada automaticamente pelo
 * interceptor configurado em src/lib/axios.ts. O `userId` do apontamento
 * é definido pelo backend a partir do token JWT (nunca enviado no body).
 */
export const timesheetService = {
  /**
   * Lista os apontamentos de horas de um documento.
   * GET /timesheets?documentId=X
   */
  async listByDocument(documentId: number): Promise<TimeLog[]> {
    const response = await api.get<TimeLog[]>('/timesheets', {
      params: { documentId },
    });
    return response.data;
  },

  /**
   * Cria um apontamento de horas para um documento.
   * POST /timesheets
   */
  async create(documentId: number, data: TimeLogFormValues): Promise<TimeLog> {
    const response = await api.post<TimeLog>('/timesheets', {
      documentId,
      ...data,
    });
    return response.data;
  },

  /**
   * Remove um apontamento de horas (apenas o próprio autor).
   * DELETE /timesheets/:timeLogId
   */
  async remove(timeLogId: number): Promise<TimeLog> {
    const response = await api.delete<TimeLog>(`/timesheets/${timeLogId}`);
    return response.data;
  },
};