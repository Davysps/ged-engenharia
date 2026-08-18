import { useState, useCallback } from 'react';
import { planningService } from '../services/planning.service';
import type {
  WorkPackage,
  WorkPackageFilters,
  WorkPackageFormInput,
} from '../types/planning.types';

/** Extrai a mensagem de erro da API (resposta) de forma type-safe. */
const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const errorData = (err as { response?: { data?: { error?: string } } })?.response?.data;
  return errorData?.error || fallback;
};

/**
 * Hook customizado para gerenciar o ciclo de vida dos Pacotes de Trabalho
 * de um contrato (tenant).
 *
 * Encapsula: fetch (com filtros), create, update, delete e loading states,
 * delegando as chamadas HTTP ao planningService.
 *
 * Componentes de UI NÃO fazem fetch direto — toda a lógica de estado e
 * Axios vive exclusivamente neste hook.
 */
export function usePlanning(contractId: number) {
  const [workPackages, setWorkPackages] = useState<WorkPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkPackages = useCallback(
    async (filters?: WorkPackageFilters) => {
      if (!contractId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await planningService.listWorkPackages(contractId, filters);
        setWorkPackages(data);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Erro ao carregar pacotes de trabalho.'));
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  const createWorkPackage = useCallback(
    async (workPackageData: WorkPackageFormInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const created = await planningService.createWorkPackage(contractId, workPackageData);
        setWorkPackages((prev) => [created, ...prev]);
        return created;
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Erro ao criar pacote de trabalho.');
        setError(msg);
        throw new Error(msg, { cause: err });
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  const updateWorkPackage = useCallback(
    async (workPackageId: number, workPackageData: Partial<WorkPackageFormInput>) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await planningService.updateWorkPackage(
          contractId,
          workPackageId,
          workPackageData
        );
        setWorkPackages((prev) =>
          prev.map((wp) => (wp.id === workPackageId ? updated : wp))
        );
        return updated;
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Erro ao atualizar pacote de trabalho.');
        setError(msg);
        throw new Error(msg, { cause: err });
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  const deleteWorkPackage = useCallback(
    async (workPackageId: number) => {
      setIsLoading(true);
      setError(null);
      try {
        await planningService.deleteWorkPackage(contractId, workPackageId);
        setWorkPackages((prev) => prev.filter((wp) => wp.id !== workPackageId));
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Erro ao remover pacote de trabalho.');
        setError(msg);
        throw new Error(msg, { cause: err });
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  return {
    workPackages,
    isLoading,
    error,
    fetchWorkPackages,
    createWorkPackage,
    updateWorkPackage,
    deleteWorkPackage,
  };
}
