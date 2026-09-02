import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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

// ─── Schema de validação (cliente) ────────────────────────────────────────
// Espelha o workPackageSchema do backend: nome obrigatório, datas válidas e
// garantia de que a data de fim não seja anterior à data de início.
const workPackageSchema = z
  .object({
    nome: z
      .string()
      .trim()
      .min(1, 'O nome do pacote de trabalho é obrigatório.')
      .max(255, 'O nome deve ter no máximo 255 caracteres.'),
    descricao: z
      .string()
      .max(2000, 'A descrição deve ter no máximo 2000 caracteres.'),
    dataInicio: z
      .string()
      .min(1, 'Informe a data de início.')
      .refine((value) => !isNaN(Date.parse(value)), {
        message: 'Informe uma data de início válida.',
      }),
    dataFim: z
      .string()
      .min(1, 'Informe a data de fim.')
      .refine((value) => !isNaN(Date.parse(value)), {
        message: 'Informe uma data de fim válida.',
      }),
    status: z.enum(
      ['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ATRASADO', 'CANCELADO'],
      { message: 'Selecione um status válido.' }
    ),
  })
  .refine((data) => !data.dataInicio || !data.dataFim || data.dataFim >= data.dataInicio, {
    message: 'A data de fim não pode ser anterior à data de início.',
    path: ['dataFim'],
  });

type WorkPackageFormValues = z.infer<typeof workPackageSchema>;

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

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkPackageFormValues>({
    resolver: zodResolver(workPackageSchema),
    defaultValues: {
      nome: workPackage?.nome ?? '',
      descricao: workPackage?.descricao ?? '',
      dataInicio: workPackage ? toDateInputValue(workPackage.dataInicio) : '',
      dataFim: workPackage ? toDateInputValue(workPackage.dataFim) : '',
      status: workPackage?.status ?? 'PENDENTE',
    },
    mode: 'onTouched',
  });

  const handleFormSubmit = async (values: WorkPackageFormValues) => {
    const data: WorkPackageFormInput = {
      nome: values.nome,
      descricao: values.descricao,
      dataInicio: values.dataInicio,
      dataFim: values.dataFim,
      status: values.status,
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
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <div>
        <label className="block text-sm font-medium text-gray-700">Nome</label>
        <input
          type="text"
          {...register('nome')}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.nome ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.nome && (
          <span className="text-xs text-red-500 mt-1 block">{errors.nome.message}</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Data de Início</label>
          <input
            type="date"
            {...register('dataInicio')}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.dataInicio ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.dataInicio && (
            <span className="text-xs text-red-500 mt-1 block">{errors.dataInicio.message}</span>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Data de Fim</label>
          <input
            type="date"
            {...register('dataFim')}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.dataFim ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.dataFim && (
            <span className="text-xs text-red-500 mt-1 block">{errors.dataFim.message}</span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Status</label>
        <select
          {...register('status')}
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
          {...register('descricao')}
          rows={3}
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.descricao ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.descricao && (
          <span className="text-xs text-red-500 mt-1 block">{errors.descricao.message}</span>
        )}
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
