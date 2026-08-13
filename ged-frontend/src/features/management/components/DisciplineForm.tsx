import { useState } from 'react';
import type { FC } from 'react';
import { useDisciplines } from '../hooks/useDisciplines';
import type { ContractDiscipline, DisciplineFormInput } from '../types/management.types';

interface DisciplineFormProps {
  contractId: number;
  discipline?: ContractDiscipline | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * Formulário para criar ou editar uma Disciplina de Contrato.
 * Reutilizável: modo "create" (sem `discipline`) e modo "edit" (com `discipline`).
 */
export const DisciplineForm: FC<DisciplineFormProps> = ({
  contractId,
  discipline,
  onSuccess,
  onCancel,
}) => {
  const isEdit = Boolean(discipline);
  const { createDiscipline, updateDiscipline, isLoading } = useDisciplines(contractId);

  const [nome, setNome] = useState(discipline?.nome ?? '');
  const [codigo, setCodigo] = useState(discipline?.codigo ?? '');
  const [descricao, setDescricao] = useState(discipline?.descricao ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: DisciplineFormInput = { nome, codigo, descricao };
    try {
      if (isEdit && discipline) {
        await updateDiscipline(discipline.id, data);
      } else {
        await createDiscipline(data);
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
      <div>
        <label className="block text-sm font-medium text-gray-700">Código</label>
        <input
          type="text"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          required
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
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
