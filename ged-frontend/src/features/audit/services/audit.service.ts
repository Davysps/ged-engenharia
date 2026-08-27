import { api } from '../../../lib/axios';
import type { AuditLogEntry } from '../types/audit.types';

export const auditService = {
  async listLogs(
    contractId: number,
    filters?: { entity?: string; action?: string }
  ): Promise<AuditLogEntry[]> {
    const params: Record<string, unknown> = { contractId };
    if (filters?.entity) params.entity = filters.entity;
    if (filters?.action) params.action = filters.action;

    const response = await api.get<AuditLogEntry[]>('/audit-logs', { params });
    return response.data;
  },
};
