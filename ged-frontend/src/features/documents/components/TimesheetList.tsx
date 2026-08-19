import type { FC } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import type { TimeLog } from '../types/timesheet.types';
import { Clock, Loader2, Trash2, Hourglass } from 'lucide-react';

interface TimesheetListProps {
  timeLogs: TimeLog[];
  isLoading: boolean;
  onDelete: (timeLogId: number) => Promise<unknown>;
}

/**
 * Listagem do histórico de Apontamentos de Horas de um documento (Épico 9).
 *
 * Exibe a soma total de horas e cada lançamento (Data, Horas, Descrição e
 * autor). O botão de exclusão só aparece para lançamentos do próprio usuário
 * logado (o backend também valida a autoria).
 */
export const TimesheetList: FC<TimesheetListProps> = ({ timeLogs, isLoading, onDelete }) => {
  const { user } = useAuth();
  const totalHoras = timeLogs.reduce((sum, log) => sum + log.horas, 0);

  const formatData = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString('pt-BR');
  };

  const formatHoras = (horas: number): string => {
    return `${horas.toLocaleString('pt-BR')}h`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-6 justify-center">
        <Loader2 className="w-4 h-4 animate-spin" />
        Carregando apontamentos...
      </div>
    );
  }

  if (timeLogs.length === 0) {
    return (
      <div className="text-center py-8 border border-dashed border-gray-200 rounded-lg">
        <Hourglass className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">
          Nenhuma hora lançada neste documento ainda.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md">
          <Clock className="w-3.5 h-3.5" />
          Total: {formatHoras(totalHoras)}
        </span>
        <span className="text-xs text-gray-400">{timeLogs.length} lançamento(s)</span>
      </div>

      <ul className="space-y-2">
        {timeLogs.map((log) => {
          const isOwner = user?.id === log.userId;
          return (
            <li
              key={log.id}
              className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-800">
                      {formatHoras(log.horas)}
                    </span>
                    <span className="text-xs text-gray-400">{formatData(log.data)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5 break-words">{log.descricao}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Lançado por {log.user?.nome ?? 'Usuário'} em{' '}
                    {new Date(log.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              </div>

              {isOwner && (
                <button
                  onClick={() => onDelete(log.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Excluir apontamento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};