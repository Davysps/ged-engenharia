import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { usePlanning } from '../hooks/usePlanning';
import { WorkPackageForm } from './WorkPackageForm';
import { WORK_PACKAGE_STATUS_CONFIG } from '../types/planning.types';
import type { WorkPackage, WorkPackageStatus } from '../types/planning.types';

const STATUS_OPTIONS = Object.keys(WORK_PACKAGE_STATUS_CONFIG) as WorkPackageStatus[];

/**
 * Tela de listagem (Tabela) dos Pacotes de Trabalho de um contrato.
 * Inclui Busca Avançada (nome) e Filtros Refinados (status).
 * Integração com RBAC: ações de escrita visíveis apenas para GESTOR.
 */
export const WorkPackageList: FC = () => {
  const { contract, role } = useContract();
  const contractId = Number(contract?.id);
  const isManager = role === 'GESTOR';

  const { workPackages, isLoading, error, fetchWorkPackages, deleteWorkPackage } =
    usePlanning(contractId);

  const [showForm, setShowForm] = useState(false);
  const [editingWorkPackage, setEditingWorkPackage] = useState<WorkPackage | null>(null);
  const [statusFilter, setStatusFilter] = useState<WorkPackageStatus | ''>('');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (contractId) fetchWorkPackages();
  }, [contractId, fetchWorkPackages]);

  const handleSearch = () => {
    fetchWorkPackages({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(busca.trim() ? { busca: busca.trim() } : {}),
    });
  };

  const handleCreate = () => {
    setEditingWorkPackage(null);
    setShowForm(true);
  };

  const handleEdit = (workPackage: WorkPackage) => {
    setEditingWorkPackage(workPackage);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingWorkPackage(null);
  };

  const handleSuccess = () => {
    fetchWorkPackages();
    setShowForm(false);
    setEditingWorkPackage(null);
  };

  const handleDelete = async (workPackageId: number) => {
    if (!confirm('Tem certeza que deseja remover este pacote de trabalho?')) return;
    try {
      await deleteWorkPackage(workPackageId);
      fetchWorkPackages();
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
            {editingWorkPackage ? 'Editar Pacote de Trabalho' : 'Novo Pacote de Trabalho'}
          </h2>
          <WorkPackageForm
            contractId={contractId}
            workPackage={editingWorkPackage}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">Pacotes de Trabalho</h2>
            {isManager && (
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                + Novo Pacote
              </button>
            )}
          </div>

          {/* Busca Avançada e Filtros Refinados */}
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-lg shadow">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
              placeholder="Buscar por nome..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WorkPackageStatus | '')}
              className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Todos os status</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {WORK_PACKAGE_STATUS_CONFIG[option].label}
                </option>
              ))}
            </select>
            <button
              onClick={handleSearch}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-md hover:bg-gray-800"
            >
              Filtrar
            </button>
          </div>

          {error && <div className="p-3 bg-red-100 text-red-800 rounded">{error}</div>}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Carregando pacotes de trabalho...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descrição</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Início</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fim</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    {isManager && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ações</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {workPackages.map((wp) => (
                    <tr key={wp.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{wp.nome}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{wp.descricao || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(wp.dataInicio).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(wp.dataFim).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-1 text-xs font-bold tracking-wide rounded uppercase ${WORK_PACKAGE_STATUS_CONFIG[wp.status].badgeClass}`}
                        >
                          {WORK_PACKAGE_STATUS_CONFIG[wp.status].label}
                        </span>
                      </td>
                      {isManager && (
                        <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                          <button
                            onClick={() => handleEdit(wp)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(wp.id)}
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
              {workPackages.length === 0 && !isLoading && (
                <p className="text-center py-8 text-gray-500">
                  Nenhum pacote de trabalho encontrado.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
