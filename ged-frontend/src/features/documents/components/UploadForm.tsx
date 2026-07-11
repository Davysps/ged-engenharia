import { useState } from 'react';
import { api } from '../../../lib/axios';
import { useContract } from '../../../contexts/ContractContext';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2, X } from 'lucide-react';

interface UploadFormProps {
  isOpen: boolean;
  onClose: () => void;
  // Prop futura para atualizar a lista automaticamente após o sucesso
  onSuccess?: () => void; 
}

export function UploadForm({ isOpen, onClose, onSuccess }: UploadFormProps) {
  // Pegamos o contrato atual direto do contexto! O usuário não precisa mais digitar.
  const { contract } = useContract();
  
  const [file, setFile] = useState<File | null>(null);
  const [codigoDocumento, setCodigoDocumento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [disciplina, setDisciplina] = useState('CIVIL');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isOpen || !contract) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Por favor, selecione um arquivo técnico.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    
    const formData = new FormData();
    // Usamos o ID que veio da URL de forma segura
    formData.append('contractId', contract.id.toString());
    formData.append('codigoDocumento', codigoDocumento);
    formData.append('titulo', titulo);
    formData.append('disciplina', disciplina);
    formData.append('file', file);

    try {
      const response = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setMessage(`Sucesso! Arquivo salvo na AWS S3: ${response.data.revisions[0].filePath}`);
      setStatus('success');
      
      // Espera 2 segundos, limpa e fecha o modal
      setTimeout(() => {
        setFile(null);
        setCodigoDocumento('');
        setTitulo('');
        setStatus('idle');
        if (onSuccess) onSuccess();
        onClose();
      }, 2000);
      
    } catch (error: any) {
      console.error(error);
      setMessage(error.response?.data?.error || 'Erro ao comunicar com o servidor AWS.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white p-8 rounded-xl shadow-xl w-full max-w-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors">
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cód. Documento</label>
              <input 
                type="text" required value={codigoDocumento} onChange={(e) => setCodigoDocumento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                placeholder="VALE-CIV-002"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título do Arquivo</label>
              <input 
                type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
                placeholder="Planta Baixa - Setor B"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Disciplina</label>
            <select 
              value={disciplina} onChange={(e) => setDisciplina(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white"
            >
              <option value="CIVIL">Civil</option>
              <option value="MECANICA">Mecânica</option>
              <option value="ELETRICA">Elétrica</option>
              <option value="ESTRUTURAL">Estrutural</option>
              <option value="ARQUITETURA">Arquitetura</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Arquivo Técnico Físico</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {file ? (
                  <>
                    <FileType className="w-8 h-8 text-blue-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-800">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500"><span className="font-semibold">Clique para fazer upload</span> ou arraste</p>
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

          <div className="flex justify-end gap-3 pt-4 mt-4 border-t border-gray-100">
            <button
              type="button" onClick={onClose} disabled={status === 'loading'}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={status === 'loading'}
              className="flex justify-center items-center py-2 px-6 rounded-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-70 transition-all"
            >
              {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Arquivar no S3'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}