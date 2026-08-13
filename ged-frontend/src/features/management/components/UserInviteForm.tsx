import { useState } from 'react';
import type { FC } from 'react';
import { useUsers } from '../hooks/useUsers';
import type { UserInviteInput } from '../types/management.types';

interface UserInviteFormProps {
  contractId: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const ROLES = ['GESTOR', 'ENGENHEIRO', 'APROVADOR', 'LEITOR'] as const;

/**
 * Formulário para convidar (invite) um novo usuário para o contrato.
 */
export const UserInviteForm: FC<UserInviteFormProps> = ({
  contractId,
  onSuccess,
  onCancel,
}) => {
  const { inviteUser, isLoading } = useUsers(contractId);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<typeof ROLES[number]>('ENGENHEIRO');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: UserInviteInput = { nome, email, role };
    try {
      await inviteUser(data);
      onSuccess?.();
    } catch {
      // Erro já tratado no hook via state
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome</label>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof ROLES[number])}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="flex justify-end space-x-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Convidando...' : 'Convidar'}
        </button>
      </div>
    </form>
  );
};
