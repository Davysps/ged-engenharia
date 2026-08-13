import { useState, useCallback } from 'react';
import { managementService } from '../services/management.service';
import type { ContractUser, UserInviteInput } from '../types/management.types';

/**
 * Hook customizado para gerenciar o ciclo de vida dos usuários
 * (membros) de um contrato (tenant).
 *
 * Encapsula: fetch, invite e loading states,
 * delegando as chamadas HTTP ao managementService.
 */
export function useUsers(contractId: number) {
  const [users, setUsers] = useState<ContractUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!contractId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await managementService.listUsers(contractId);
      setUsers(data);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Erro ao carregar usuários.');
    } finally {
      setIsLoading(false);
    }
  }, [contractId]);

  const inviteUser = useCallback(
    async (inviteData: UserInviteInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const created = await managementService.inviteUser(contractId, inviteData);
        setUsers((prev) => [created, ...prev]);
        return created;
      } catch (err: any) {
        const msg = err?.response?.data?.error || 'Erro ao convidar usuário.';
        setError(msg);
        throw new Error(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [contractId]
  );

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    inviteUser,
  };
}
