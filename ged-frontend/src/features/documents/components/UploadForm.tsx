import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useContract } from '../../../contexts/ContractContext';
import { usePlanning } from '../../planning/hooks/usePlanning';
import { useDisciplines } from '../../management/hooks/useDisciplines';
import { documentService } from '../services/document.service';
import type { UploadPhase } from '../types/document.types';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface UploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  // Prop futura para atualizar a lista automaticamente após o sucesso
  onSuccess?: () => void;
}

const PHASE_LABELS: Record<UploadPhase, string> = {
  presign: 'Solicitando URL de upload à AWS...',
  upload: 'Enviando arquivo para a AWS S3...',
  register: 'Registrando documento na base de dados...',
};

// ─── Schema de validação (cliente) ────────────────────────────────────────
// Espelha as regras do backend (document.schemas.ts) para prevenir erros
// antes de qualquer requisição: código, título e arquivo físico.
//
// DOCUMENTO "CASCA" (Shell): o arquivo é OPCIONAL. O Planejador pode cadastrar
// o esqueleto do documento no MDR antes do PDF existir — o físico será anexado
// depois, numa subida de revisão (R0).
const uploadSchema = z.object({
  codigoDocumento: z
    .string()
    .trim()
    .min(1, 'O código do documento é obrigatório.')
    .max(255, 'O código do documento deve ter no máximo 255 caracteres.'),
  titulo: z
    .string()
    .trim()
    .min(1, 'O título do documento é obrigatório.')
    .max(500, 'O título do documento deve ter no máximo 500 caracteres.'),
  // Vínculos opcionais (string vazia = sem vínculo), convertidos no submit.
  workPackageId: z.string(),
  contractDisciplineId: z.string(),
  file: z
    .instanceof(File, { message: 'Selecione um arquivo técnico para upload.' })
    .nullable()
    .optional(),
});

type UploadFormValues = z.infer<typeof uploadSchema>;

export function UploadForm({ isOpen, onClose, onSuccess }: UploadFormProps) {
  // Pegamos o contrato atual direto do contexto! O usuário não precisa mais digitar.
  const { contract } = useContract();
  const contractId = Number(contract?.id ?? 0);

  // ÉPICO 7.5: Hooks de Planejamento e Disciplinas do Contrato (multi-tenant)
  const { workPackages, fetchWorkPackages } = usePlanning(contractId);
  const { disciplines, fetchDisciplines } = useDisciplines(contractId);

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [phase, setPhase] = useState<UploadPhase>('presign');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (contractId) {
      fetchWorkPackages();
      fetchDisciplines();
    }
  }, [contractId, fetchWorkPackages, fetchDisciplines]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      codigoDocumento: '',
      titulo: '',
      workPackageId: '',
      contractDisciplineId: '',
      file: null,
    },
    mode: 'onTouched',
  });

  const file = watch('file');
  // FIX (NaN MB): `react-hook-form` entrega o valor do input `type="file"` como
  // FileList. Verificamos se o valor é um `File` real antes de ler `.name/.size`.
  const selectedFile = file instanceof File ? file : null;

  if (!isOpen || !contract) return null;

  const closeAndReset = () => {
    setStatus('idle');
    setMessage('');
    reset();
    onClose();
  };

  const onSubmit = async (data: UploadFormValues) => {
    const selectedFile = data.file instanceof File ? data.file : null;

    setStatus('loading');
    // Sem arquivo físico = documento "casca" (só metadados): não há etapas
    // de pre-signed URL nem PUT no S3 — o backend apenas regista o documento.
    setPhase(selectedFile ? 'presign' : 'register');

    try {
      // FASE 2: pre-signed URL → PUT direto no S3 → registro via fileKey (JSON).
      // Se o PUT na AWS falhar, o erro propaga e o backend NUNCA é chamado.
      const response = await documentService.submitDocument(
        selectedFile,
        {
          contractId: Number(contract.id),
          codigoDocumento: data.codigoDocumento,
          titulo: data.titulo,
          workPackageId: data.workPackageId ? Number(data.workPackageId) : null,
          contractDisciplineId: data.contractDisciplineId ? Number(data.contractDisciplineId) : null,
        },
        setPhase
      );

      const firstRevision = response.revisions[0];
      if (firstRevision) {
        setMessage(`Sucesso! Arquivo salvo na AWS S3: ${firstRevision.filePath}`);
      } else {
        setMessage('Sucesso! Esqueleto do documento registrado. O arquivo físico será anexado em uma nova revisão.');
      }
      setStatus('success');

      // Espera 2 segundos, limpa e fecha o modal
      setTimeout(() => {
        closeAndReset();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error: unknown) {
      console.error(error);
      const errorData = (error as { response?: { data?: { error?: string } } })?.response?.data;
      setMessage(errorData?.error || 'Erro ao comunicar com o servidor AWS.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl relative animate-in fade-in zoom-in-95 duration-200">

        <button onClick={closeAndReset} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-6 h-6" />
        </button>

        <div className="mb-6 border-b border-gray-100 pb-4 pr-6">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <UploadCloud className="text-blue-600" />
            Submeter Novo Documento (R0)
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Enviando para a obra: <span className="font-semibold text-gray-700">{contract.name}</span>
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cód. Documento</label>
              <input
                type="text"
                {...register('codigoDocumento')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 outline-none ${
                  errors.codigoDocumento ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="VALE-CIV-002"
              />
              {errors.codigoDocumento && (
                <span className="text-xs text-red-500 mt-1 block">{errors.codigoDocumento.message}</span>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título do Arquivo</label>
              <input
                type="text"
                {...register('titulo')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 outline-none ${
                  errors.titulo ? 'border-red-400' : 'border-gray-300'
                }`}
                placeholder="Planta Baixa - Setor B"
              />
              {errors.titulo && (
                <span className="text-xs text-red-500 mt-1 block">{errors.titulo.message}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disciplina do Contrato</label>
              <select
                {...register('contractDisciplineId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
              >
                <option value="">Sem disciplina</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id.toString()}>
                    {discipline.nome}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pacote de Trabalho</label>
              <select
                {...register('workPackageId')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
              >
                <option value="">Sem pacote de trabalho</option>
                {workPackages.map((workPackage) => (
                  <option key={workPackage.id} value={workPackage.id.toString()}>
                    {workPackage.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arquivo Técnico Físico <span className="text-xs font-normal text-gray-400">(opcional — para criar o esqueleto do documento)</span>
            </label>
            <label className={`relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition ${
              selectedFile ? 'bg-blue-50 hover:bg-blue-100 border-blue-300' : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
            } ${errors.file ? 'border-red-400' : ''}`}>
              {selectedFile && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setValue('file', null, { shouldValidate: true });
                  }}
                  className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  title="Remover arquivo"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4">
                {selectedFile ? (
                  <>
                    <FileType className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-800 break-all text-center line-clamp-1">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-semibold">Clique para anexar o PDF/DWG</span></p>
                    <p className="text-xs text-gray-400 mt-1">Ou deixe em branco para cadastrar apenas os metadados (documento esqueleto).</p>
                  </>
                )}
              </div>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  // FIX (NaN MB): extrai o arquivo REAL do FileList em vez de
                  // repassar o valor bruto do input (`FileList`) para o estado
                  // do react-hook-form.
                  const file = e.target.files?.[0] ?? null;
                  setValue('file', file, { shouldValidate: true });
                  // Permite re-selecionar o mesmo arquivo depois de remover.
                  e.target.value = '';
                }}
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
            <div className="flex items-center gap-2 p-3 text-blue-700 bg-blue-50 rounded-lg text-sm border border-blue-200">
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

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
            <button
              type="button" onClick={closeAndReset} disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={isSubmitting}
              className="flex justify-center items-center py-2 px-6 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-70 transition-all"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : selectedFile ? 'Arquivar no S3' : 'Criar Esqueleto (Sem Arquivo)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
