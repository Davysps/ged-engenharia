import { useState, useCallback } from 'react';
import { timesheetService } from '../services/timesheet.service';
import type { TimeLog, TimeLogFormValues } from '../types/timesheet.types';

/** Extrai a mensagem de erro da API (resposta) de forma type-safe. */
const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const errorData = (err as { response?: { data?: { error?: string } } })?.response?.data;
  return errorData?.error || fallback;
};

/**
 * Hook customizado para gerenciar o ciclo de vida dos Apontamentos de
 * Horas (Timesheet) de um documento.
 *
 * Encapsula: fetch automático, create e delete, delegando as chamadas
 * HTTP ao timesheetService.
 *
 * Componentes de UI NÃO fazem fetch direto — toda a lógica de estado e
 * Axios vive exclusivamente neste hook.
 */
export function useTimesheet(documentId: number) {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTimeLogs = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await timesheetService.listByDocument(documentId);
      setTimeLogs(data);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Erro ao carregar apontamentos de horas.'));
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  const createTimeLog = useCallback(
    async (values: TimeLogFormValues) => {
      setIsSubmitting(true);
      setError(null);
      try {
        const created = await timesheetService.create(documentId, values);
        setTimeLogs((prev) => [created, ...prev]);
        return created;
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Erro ao registrar apontamento de horas.');
        setError(msg);
        throw new Error(msg, { cause: err });
      } finally {
        setIsSubmitting(false);
      }
    },
    [documentId]
  );

  const deleteTimeLog = useCallback(async (timeLogId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      await timesheetService.remove(timeLogId);
      setTimeLogs((prev) => prev.filter((log) => log.id !== timeLogId));
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'Erro ao excluir apontamento de horas.');
      setError(msg);
      throw new Error(msg, { cause: err });
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    timeLogs,
    isLoading,
    isSubmitting,
    error,
    fetchTimeLogs,
    createTimeLog,
    deleteTimeLog,
  };
}