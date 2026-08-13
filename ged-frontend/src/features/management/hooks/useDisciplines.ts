import { useState, useCallback } from 'react';
import { managementService } from '../services/management.service';
import type { ContractDiscipline, DisciplineFormInput } from '../types/management.types';

/**
 * Hook customizado para gerenciar o ciclo de vida das disciplinas
 * de um contrato (tenant).
 *
 * Encapsula: fetch, create, update, delete e loading states,
 * delegando as chamadas HTTP ao managementService.
 */
export function useDisciplines(contractId: number) {
  const [disciplines, setDisciplines] = useState<ContractDiscipline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDisciplines = useCallback(async () => {
    if (!contractId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await managementService.listDisciplines(contractId);
      setDisciplines(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao carregar disciplinas.');
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  const createDiscipline = useCallback(
    async (disciplineData: DisciplineFormInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const created = await managementService.createDiscipline(contractId, disciplineData);
        setDisciplines((prev) => [created, ...prev]);
        return created;
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Erro ao criar disciplina.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  const updateDiscipline = useCallback(
    async (disciplineId: number, disciplineData: DisciplineFormInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const updated = await managementService.updateDiscipline(contractId, disciplineId, disciplineData);
        setDisciplines((prev) =>
          prev.map((d) => (d.id === disciplineId ? updated : d))
        );
        return updated;
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Erro ao atualizar disciplina.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  const deleteDiscipline = useCallback(
    async (disciplineId: number) => {
      setIsLoading(true);
      setError(null);
      try {
        await managementService.deleteDiscipline(contractId, disciplineId);
        setDisciplines((prev) => prev.filter((d) => d.id !== disciplineId));
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Erro ao remover disciplina.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  return {
    disciplines,
    isLoading,
    error,
    fetchDisciplines,
    createDiscipline,
    updateDiscipline,
    deleteDiscipline,
  };
}
