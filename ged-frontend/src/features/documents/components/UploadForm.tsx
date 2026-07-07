import { useState } from 'react';
import { api } from '../../../lib/axios';
import { UploadCloud, FileType, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [contractId, setContractId] = useState('');
  const [codigoDocumento, setCodigoDocumento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [disciplina, setDisciplina] = useState('CIVIL');
  
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setMessage('Por favor, selecione um arquivo técnico.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    
    // FormData é obrigatório para envio de arquivos (multipart/form-data)
    const formData = new FormData();
    formData.append('contractId', contractId);
    formData.append('codigoDocumento', codigoDocumento);
    formData.append('titulo', titulo);
    formData.append('disciplina', disciplina);
    formData.append('file', file);

    try {
      // O interceptador do Axios já vai injetar o token JWT automaticamente
      const response = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessage(`Sucesso! Arquivo salvo na AWS S3: ${response.data.revisions[0].filePath}`);
      setStatus('success');
      
      // Limpa o formulário após o sucesso
      setFile(null);
      setCodigoDocumento('');
      setTitulo('');
    } catch (error: any) {
      console.error(error);
      setMessage(error.response?.data?.error || 'Erro ao comunicar com o servidor AWS.');
      setStatus('error');
    }
  };

  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 max-w-2xl mx-auto mt-8">
      <div className="mb-6 border-b border-gray-100 pb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <UploadCloud className="text-blue-600" />
          Submeter Novo Documento (R0)
        </h2>
        <p className="text-sm text-gray-500 mt-1">Envie o arquivo PDF/DWG para nuvem atrelado a um contrato.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ID do Contrato</label>
            <input 
              type="number" required value={contractId} onChange={(e) => setContractId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="Ex: 1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Código do Documento</label>
            <input 
              type="text" required value={codigoDocumento} onChange={(e) => setCodigoDocumento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="VALE-CIV-002"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Título do Arquivo</label>
            <input 
              type="text" required value={titulo} onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none"
              placeholder="Planta Baixa - Setor B"
            />
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
              <option value="HIDRAULICA">Hidráulica</option>
              <option value="ESTRUTURAL">Estrutural</option>
              <option value="ARQUITETURA">Arquitetura</option>
            </select>
          </div>
        </div>

        {/* Falso Drag & Drop usando inputs nativos estilizados */}
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
                  <p className="text-sm text-gray-500"><span className="font-semibold">Clique para fazer upload</span> ou arraste e solte</p>
                  <p className="text-xs text-gray-500 mt-1">PDF, DWG, PNG ou JPG (Max. 50MB)</p>
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
          <div className="flex items-center gap-2 p-3 text-green-700 bg-green-50 rounded-lg text-sm border border-green-200 break-all">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <p>{message}</p>
          </div>
        )}

        <button
          type="submit" disabled={status === 'loading'}
          className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-70 transition-all mt-4"
        >
          {status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Arquivar no Sistema (AWS S3)'}
        </button>
      </form>
    </div>
  );
}