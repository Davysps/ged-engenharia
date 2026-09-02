import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { documentService } from '../services/document.service';
import type { UploadPhase } from '../types/document.types';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface RevisionUploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: number | null;
  codigoDocumento: string;
  onSuccess?: () => void;
}

const PHASE_LABELS: Record<UploadPhase, string> = {
  presign: 'Solicitando URL de upload à AWS...',
  upload: 'Enviando arquivo para a AWS S3...',
  register: 'Registrando a nova revisão na base de dados...',
};

// ─── Schema de validação (cliente) ────────────────────────────────────────
const revisionSchema = z.object({
  file: z.instanceof(File, {
    message: 'Selecione a nova versão do arquivo técnico para upload.',
  }),
});

type RevisionFormValues = z.infer<typeof revisionSchema>;

export function RevisionUploadForm({ isOpen, onClose, documentId, codigoDocumento, onSuccess }: RevisionUploadFormProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [phase, setPhase] = useState<UploadPhase>('presign');
  const [message, setMessage] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RevisionFormValues>({
    resolver: zodResolver(revisionSchema),
    mode: 'onTouched',
  });

  const file = watch('file');

  if (!isOpen || !documentId) return null;

  const closeAndReset = () => {
    setStatus('idle');
    setMessage('');
    reset();
    onClose();
  };

  const onSubmit = async ({ file }: RevisionFormValues) => {
    setStatus('loading');
    setPhase('presign');

    try {
      // FASE 2: pre-signed URL → PUT direto no S3 → registro via fileKey (JSON).
      // Se o PUT na AWS falhar, o erro propaga e o backend NUNCA é chamado.
      const response = await documentService.submitRevision(documentId, file, setPhase);

      setMessage(`Sucesso! Nova revisão gerada: ${response.versionLabel}`);
      setStatus('success');

      setTimeout(() => {
        closeAndReset();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error: unknown) {
      console.error(error);
      const errorData = (error as { response?: { data?: { error?: string } } })?.response?.data;
      setMessage(errorData?.error || 'Erro ao processar nova revisão no S3.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-md relative animate-in fade-in zoom-in-95 duration-200">
        <button onClick={closeAndReset} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UploadCloud className="text-indigo-600" />
            Nova Revisão
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Atualizando documento: <span className="font-semibold text-gray-700">{codigoDocumento}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div>
            <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition ${
              errors.file ? 'border-red-400' : 'border-gray-300'
            }`}>
              <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                {file ? (
                  <>
                    <FileType className="w-8 h-8 text-indigo-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-semibold">Clique para anexar o PDF/DWG</span></p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                {...register('file')}
              />
            </label>
            {errors.file && (
              <span className="text-xs text-red-500 mt-1 block">{errors.file.message}</span>
            )}
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 text-red-700 bg-red-50 rounded-lg text-sm border border-red-200">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{message}</p>
            </div>
          )}

          {status === 'loading' && (
            <div className="flex items-center gap-2 p-3 text-indigo-700 bg-indigo-50 rounded-lg text-sm border border-indigo-200">
              <Loader2 className="w-5 h-5 shrink-0 animate-spin" />
              <p>{PHASE_LABELS[phase]}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 text-green-700 bg-green-50 rounded-lg text-sm border border-green-200">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p>{message}</p>
            </div>
          )}

          <button
            type="submit" disabled={isSubmitting}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600 disabled:opacity-70 transition-all mt-4"
          >
            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Arquivar Nova Revisão (AWS S3)'}
          </button>
        </form>
      </div>
    </div>
  );
}
