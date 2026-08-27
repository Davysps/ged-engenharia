import { useState, useCallback } from 'react';
import { auditService } from '../services/audit.service';
import type { AuditLogEntry } from '../types/audit.types';

export function useAuditLogs(contractId: number) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(
    async (filters?: { entity?: string; action?: string }) => {
      if (!contractId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await auditService.listLogs(contractId, filters);
        setLogs(data);
      } catch (err: unknown) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erro ao carregar trilha de auditoria.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  return { logs, isLoading, error, fetchLogs };
}
