import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { useUsers } from '../hooks/useUsers';
import { UserInviteForm } from './UserInviteForm';

/**
 * Tela de listagem de membros (usuários) de um contrato.
 * Integração com RBAC: botão de convite visível apenas para GESTOR.
 */
export const UserList: FC = () => {
  const { contract, role } = useContract();
  const contractId = Number(contract?.id);
  const isManager = role === 'GESTOR';

  const [showInvite, setShowInvite] = useState(false);

  const { users, isLoading, error, fetchUsers} = useUsers(contractId);

  useEffect(() => {
    if (contractId) fetchUsers();
  }, [contractId, fetchUsers]);

  if (!contract) {
    return <div className="p-4 text-gray-500">Carregando contrato...</div>;
  }

  return (
    <div className="space-y-6">
      {showInvite ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Convidar Usuário</h2>
          <UserInviteForm
            contractId={contractId}
            onSuccess={() => {
              fetchUsers();
              setShowInvite(false);
            }}
            onCancel={() => setShowInvite(false)}
          />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Membros do Contrato</h2>
            {isManager && (
              <button
                onClick={() => setShowInvite(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Convidar Usuário
              </button>
            )}
          </div>

          {error && <div className="p-3 bg-red-100 text-red-800 rounded">{error}</div>}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando membros...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{u.nome}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold rounded uppercase
                            ${u.role === 'GESTOR' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'APROVADOR' ? 'bg-green-100 text-green-800' :
                              u.role === 'ENGENHEIRO' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-600'}`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(u.createdAt).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && !isLoading && (
                <p className="text-center py-8 text-gray-500">Nenhum membro encontrado.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
