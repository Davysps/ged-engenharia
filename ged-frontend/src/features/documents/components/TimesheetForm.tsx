import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { TimeLogFormValues } from '../types/timesheet.types';
import { Loader2, PlusCircle } from 'lucide-react';

interface TimesheetFormProps {
  onSubmit: (values: TimeLogFormValues) => Promise<unknown>;
  onSuccess?: () => void;
  isSubmitting: boolean;
  error: string | null;
}

// ─── Schema de validação (cliente) ────────────────────────────────────────
// Espelha o timeLogBaseSchema do backend: horas (0 < h <= 24), data válida
// e descrição obrigatória (máx. 2000 caracteres).
const timesheetSchema = z.object({
  data: z
    .string()
    .min(1, 'Informe a data do apontamento.')
    .refine((value) => !isNaN(Date.parse(value)), {
      message: 'Informe uma data válida.',
    }),
  horas: z
    .string()
    .min(1, 'Informe a quantidade de horas.')
    .refine((value) => {
      const n = Number(value);
      return !Number.isNaN(n) && n > 0 && n <= 24;
    }, 'A quantidade de horas deve estar entre 0.5 e 24 por lançamento.'),
  descricao: z
    .string()
    .trim()
    .min(1, 'A descrição do apontamento é obrigatória.')
    .max(2000, 'A descrição deve ter no máximo 2000 caracteres.'),
});

type TimesheetFormValues = z.infer<typeof timesheetSchema>;

/**
 * Formulário de Apontamento de Horas (Épico 9).
 *
 * Permite ao engenheiro lançar horas gastas em um documento específico:
 * Data, Quantidade de Horas e Descrição.
 *
 * O `documentId` é injetado pelo pai (DocumentDetail) via `onSubmit`;
 * o `userId` é definido exclusivamente pelo backend a partir do JWT.
 */
export const TimesheetForm: FC<TimesheetFormProps> = ({
  onSubmit,
  onSuccess,
  isSubmitting,
  error,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TimesheetFormValues>({
    resolver: zodResolver(timesheetSchema),
    defaultValues: {
      data: '',
      horas: '',
      descricao: '',
    },
    mode: 'onTouched',
  });

  const handleFormSubmit = async (values: TimesheetFormValues) => {
    try {
      await onSubmit({
        data: values.data,
        horas: Number(values.horas),
        descricao: values.descricao,
      });
      reset();
      onSuccess?.();
    } catch {
      // Erro já tratado no hook via state (`error`)
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Data
          </label>
          <input
            type="date"
            {...register('data')}
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.data ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.data && (
            <span className="text-xs text-red-500 mt-1 block">{errors.data.message}</span>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Quantidade de Horas
          </label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="24"
            {...register('horas')}
            placeholder="Ex: 4.5"
            className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              errors.horas ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors.horas && (
            <span className="text-xs text-red-500 mt-1 block">{errors.horas.message}</span>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Descrição
        </label>
        <textarea
          {...register('descricao')}
          rows={2}
          maxLength={2000}
          placeholder="Descreva a atividade realizada..."
          className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
            errors.descricao ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.descricao && (
          <span className="text-xs text-red-500 mt-1 block">{errors.descricao.message}</span>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Registrando...
          </>
        ) : (
          <>
            <PlusCircle className="w-4 h-4" />
            Lançar Horas
          </>
        )}
      </button>
    </form>
  );
};
