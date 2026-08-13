import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { useDisciplines } from '../hooks/useDisciplines';
import { DisciplineForm } from './DisciplineForm';
import type { ContractDiscipline } from '../types/management.types';

/**
 * Tela de listagem de disciplinas de um contrato.
 * Integração com RBAC: botões de ação visíveis apenas para GESTOR.
 */
export const DisciplineList: FC = () => {
  const { contract, role } = useContract();
  const contractId = Number(contract?.id);
  const isManager = role === 'GESTOR';

  const { disciplines, isLoading, error, fetchDisciplines, deleteDiscipline } = useDisciplines(contractId);

  const [showForm, setShowForm] = useState(false);
  const [editingDiscipline, setEditingDiscipline] = useState<ContractDiscipline | null>(null);

  useEffect(() => {
    if (contractId) fetchDisciplines();
  }, [contractId, fetchDisciplines]);

  const handleCreate = () => {
    setEditingDiscipline(null);
    setShowForm(true);
  };

  const handleEdit = (discipline: ContractDiscipline) => {
    setEditingDiscipline(discipline);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingDiscipline(null);
  };

  const handleSuccess = () => {
    fetchDisciplines();
    setShowForm(false);
    setEditingDiscipline(null);
  };

  const handleDelete = async (disciplineId: number) => {
    if (!confirm('Tem certeza que deseja remover esta disciplina?')) return;
    try {
      await deleteDiscipline(disciplineId);
      fetchDisciplines();
    } catch {
      // Erro tratado via state no hook
    }
  };

  if (!contract) {
    return <div className="p-4 text-gray-500">Carregando contrato...</div>;
  }

  return (
    <div className="space-y-6">
      {showForm ? (
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {editingDiscipline ? 'Editar Disciplina' : 'Nova Disciplina'}
          </h2>
          <DisciplineForm
            contractId={contractId}
            discipline={editingDiscipline}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Disciplinas do Contrato</h2>
            {isManager && (
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Nova Disciplina
              </button>
            )}
          </div>

          {error && <div className="p-3 bg-red-100 text-red-800 rounded">{error}</div>}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando disciplinas...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Criado em</th>
                    {isManager && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {disciplines.map((d) => (
                    <tr key={d.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{d.nome}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{d.codigo}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{d.descricao || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Date(d.createdAt).toLocaleDateString('pt-BR')}</td>
                      {isManager && (
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button
                            onClick={() => handleEdit(d)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(d.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Remover
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              {disciplines.length === 0 && !isLoading && (
                <p className="text-center py-8 text-gray-500">Nenhuma disciplina encontrada.</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
