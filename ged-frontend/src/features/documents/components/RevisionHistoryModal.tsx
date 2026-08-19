import { History, X, Clock, FileText, CheckCircle2, Archive } from 'lucide-react';

interface Revision {
  id: number;
  versionLabel: string;
  filePath: string;
  createdAt: string;
}

interface RevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  codigoDocumento: string;
  titulo: string;
  revisions: Revision[];
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' às ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function RevisionHistoryModal({ isOpen, onClose, codigoDocumento, titulo, revisions }: RevisionHistoryModalProps) {
  if (!isOpen) return null;

  // ÉPICO 8: Timeline mockada a partir da revisão atual retornada na listagem.
  // O backend ainda não persiste múltiplas revisões em profundidade; a última é a "ATUAL".
  const sorted = [...revisions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <History className="text-indigo-600" />
            Histórico de Versões
          </h2>
          <p className="text-sm text-gray-500 mt-1 truncate">
            <span className="font-semibold text-gray-700">{codigoDocumento}</span> — {titulo}
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mb-3" />
            <p className="text-sm">Nenhuma revisão registrada.</p>
          </div>
        ) : (
          <ol className="relative space-y-4 pl-1">
            {sorted.map((rev, index) => {
              const isLatest = index === sorted.length - 1;
              return (
                <li key={rev.id} className="relative flex gap-4">
                  {/* Linha vertical da timeline */}
                  {index < sorted.length - 1 && (
                    <span className="absolute left-[19px] top-11 bottom-[-16px] w-px bg-gray-200" aria-hidden="true" />
                  )}

                  {/* Marcador da bolha */}
                  <span
                    className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 z-10 ${
                      isLatest
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                        : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}
                  >
                    {isLatest ? <CheckCircle2 className="w-5 h-5" /> : <Archive className="w-5 h-5" />}
                  </span>

                  {/* Conteúdo da revisão */}
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-800">{rev.versionLabel}</span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full ${
                          isLatest ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {isLatest ? 'Atual' : 'Obsoleta'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatDate(rev.createdAt)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}