import { useState } from 'react';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';
import { documentService } from '../services/document.service';

interface InternalCorrectionFormProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number | null;
  revisionId: number | null;
  versionLabel: string;
  codigoDocumento: string;
  onSuccess?: () => void;
}

/**
 * PATCH 10.3 — Modal de Correção Interna (Retrabalho).
 *
 * CENÁRIO A do fluxo: o Time interno devolveu a revisão (Verificação ou
 * Coordenação reprovou/aprovou com comentários). O autor reenvia o PDF
 * corrigido DENTRO da mesma revisão — nenhuma R+1 é gerada. O backend
 * reinicia o ciclo interno com um novo carimbo VERIFICACAO PENDENTE.
 */
export function InternalCorrectionForm({
  isOpen,
  onClose,
  documentId,
  revisionId,
  versionLabel,
  codigoDocumento,
  onSuccess,
}: InternalCorrectionFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isOpen || !documentId || !revisionId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Por favor, selecione o arquivo técnico corrigido.');
      setStatus('error');
      return;
    }

    setStatus('loading');

    try {
      const response = await documentService.submitInternalCorrection(
        documentId,
        revisionId,
        file
      );

      setMessage(response.message || `Sucesso! Correção interna enviada mantendo ${versionLabel}.`);
      setStatus('success');

      setTimeout(() => {
        setFile(null);
        setStatus('idle');
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
    } catch (error: unknown) {
      console.error(error);
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : undefined;
      setMessage(errorMessage || 'Erro ao enviar a correção interna.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UploadCloud className="text-sky-600" />
            Correção Interna
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Documento <span className="font-semibold text-gray-700">{codigoDocumento}</span> — mantendo a
            revisão <span className="font-semibold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">{versionLabel}</span>
          </p>
          <p className="text-xs text-gray-400 mt-2">
            O PDF corrigido substitui o atual e o ciclo de Verificação Interna é reiniciado.
            Nenhuma nova revisão oficial é gerada.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                {file ? (
                  <>
                    <FileType className="w-8 h-8 text-sky-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-gray-500">
                      <span className="font-semibold">Clique para anexar o PDF corrigido</span>
                    </p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
            </label>
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 text-red-700 bg-red-50 rounded-lg text-sm border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{message}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 text-green-700 bg-green-50 rounded-lg text-sm border border-green-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p>{message}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-600 disabled:opacity-70 transition-all mt-4"
          >
            {status === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              `Enviar Correção Interna (Manter ${versionLabel})`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
