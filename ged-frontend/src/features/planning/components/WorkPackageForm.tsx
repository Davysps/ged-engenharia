import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { usePlanning } from '../hooks/usePlanning';
import { WORK_PACKAGE_STATUS_CONFIG } from '../types/planning.types';
import type {
  WorkPackage,
  WorkPackageFormInput,
  WorkPackageStatus,
} from '../types/planning.types';

interface WorkPackageFormProps {
  contractId: number;
  workPackage?: WorkPackage | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const STATUS_OPTIONS = Object.keys(WORK_PACKAGE_STATUS_CONFIG) as WorkPackageStatus[];

/** Converte ISO string do backend em valor aceito por <input type="date"> (YYYY-MM-DD). */
const toDateInputValue = (iso: string): string => iso.slice(0, 10);

/**
 * Formulário para criar ou editar um Pacote de Trabalho.
 * Reutilizável: modo "create" (sem `workPackage`) e modo "edit" (com `workPackage`).
 */
export const WorkPackageForm: FC<WorkPackageFormProps> = ({
  contractId,
  workPackage,
  onSuccess,
  onCancel,
}) => {
  const isEdit = Boolean(workPackage);
  const { createWorkPackage, updateWorkPackage, isLoading } = usePlanning(contractId);

  const [nome, setNome] = useState(workPackage?.nome ?? '');
  const [descricao, setDescricao] = useState(workPackage?.descricao ?? '');
  const [dataInicio, setDataInicio] = useState(
    workPackage ? toDateInputValue(workPackage.dataInicio) : ''
  );
  const [dataFim, setDataFim] = useState(
    workPackage ? toDateInputValue(workPackage.dataFim) : ''
  );
  const [status, setStatus] = useState<WorkPackageStatus>(workPackage?.status ?? 'PENDENTE');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data: WorkPackageFormInput = {
      nome,
      descricao,
      dataInicio,
      dataFim,
      status,
    };
    try {
      if (isEdit && workPackage) {
        await updateWorkPackage(workPackage.id, data);
      } else {
        await createWorkPackage(data);
      }
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Data de Início</label>
          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Data de Fim</label>
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as WorkPackageStatus)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {WORK_PACKAGE_STATUS_CONFIG[option].label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Descrição</label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
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
          {isLoading ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar'}
        </button>
      </div>
    </form>
  );
};
