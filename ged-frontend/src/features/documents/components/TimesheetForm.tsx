import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import type { TimeLogFormValues } from '../types/timesheet.types';
import { Loader2, PlusCircle } from 'lucide-react';

interface TimesheetFormProps {
  onSubmit: (values: TimeLogFormValues) => Promise<unknown>;
  onSuccess?: () => void;
  isSubmitting: boolean;
  error: string | null;
}

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
  const [data, setData] = useState('');
  const [horas, setHoras] = useState('');
  const [descricao, setDescricao] = useState('');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await onSubmit({
        data,
        horas: Number(horas),
        descricao,
      });
      setData('');
      setHoras('');
      setDescricao('');
      onSuccess?.();
    } catch {
      // Erro já tratado no hook via state (`error`)
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            Data
          </label>
          <input
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            required
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
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
            value={horas}
            onChange={(e) => setHoras(e.target.value)}
            required
            placeholder="Ex: 4.5"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
          Descrição
        </label>
        <textarea
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={2}
          required
          maxLength={2000}
          placeholder="Descreva a atividade realizada..."
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
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