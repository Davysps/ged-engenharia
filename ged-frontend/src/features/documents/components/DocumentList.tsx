import { useEffect, useState } from 'react';
import { api } from '../../../lib/axios'; 
import { useContract } from '../../../contexts/ContractContext';
import { FileText, UploadCloud, Eye, History } from 'lucide-react';
import { UploadForm } from './UploadForm';
import { DocumentViewer } from './DocumentViewer'; 
import { RevisionUploadForm } from './RevisionUploadForm';

interface Revision {
  id: number;
  versionLabel: string; 
  filePath: string;
  createdAt: string;
}

// CORREÇÃO: Atualizado para casar exatamente com o Prisma (codigoDocumento)
interface Document {
  id: number;
  codigoDocumento: string; 
  disciplina: string;
  revisions: Revision[];
}

export function DocumentList() {
  const { contract, role } = useContract();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [revDocId, setRevDocId] = useState<number | null>(null);
  const [revDocCodigo, setRevDocCodigo] = useState('');

  const canUpload = role === 'GESTOR' || role === 'ENGENHEIRO';

  const handleViewDocument = (url: string, nome: string) => {
    setSelectedFileUrl(url);
    setSelectedFileName(nome);
    setIsViewerOpen(true);
  };

  const fetchDocuments = async () => {
    if (!contract?.id) return;
    try {
      setIsLoading(true);
      const response = await api.get(`/projects/${contract.id}/documents`);
      setDocuments(response.data);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [contract?.id]);

  if (isLoading) return <div className="p-6 text-gray-500 animate-pulse">Carregando acervo técnico...</div>;

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Acervo Técnico
            </h2>
            <p className="text-sm text-gray-500 mt-1">Gerencie plantas, diagramas e revisões.</p>
          </div>
          
          {canUpload && (
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <UploadCloud className="w-5 h-5" />
              Novo Documento (R0)
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-semibold">Código do Documento</th>
                <th className="p-4 font-semibold">Disciplina</th>
                <th className="p-4 font-semibold">Revisão Atual</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">Nenhum documento encontrado neste contrato.</td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const currentRev = doc.revisions[doc.revisions.length - 1];
                  
                  if (!currentRev) return null;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      {/* CORREÇÃO: Utilizando doc.codigoDocumento */}
                      <td className="p-4 font-medium text-gray-900">{doc.codigoDocumento}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium">{doc.disciplina}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 text-green-800 text-xs rounded-md font-bold">
                          {currentRev.versionLabel}
                        </span>
                      </td>
                      <td className="p-4 flex justify-end gap-2">
                        
                        <button 
                          onClick={() => handleViewDocument(currentRev.filePath, `${doc.codigoDocumento} - ${currentRev.versionLabel}`)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Visualizar Documento"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        
                        <button className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"><History className="w-5 h-5" /></button>
                        
                        {canUpload && (
                          <button 
                            onClick={() => {
                              setRevDocId(doc.id);
                              setRevDocCodigo(doc.codigoDocumento); // CORREÇÃO AQUI TAMBÉM
                              setIsRevModalOpen(true);
                            }}
                            className="text-sm font-medium text-blue-600 hover:text-blue-800 px-3 py-1.5 border border-blue-200 hover:bg-blue-50 rounded transition-colors ml-2"
                          >
                            Subir Nova Rev
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UploadForm 
        isOpen={isUploadModalOpen} 
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => fetchDocuments()}
      />

      <DocumentViewer 
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        fileUrl={selectedFileUrl}
        fileName={selectedFileName}
      />

      <RevisionUploadForm 
        isOpen={isRevModalOpen}
        onClose={() => setIsRevModalOpen(false)}
        documentId={revDocId}
        codigoDocumento={revDocCodigo}
        onSuccess={() => fetchDocuments()} 
      />
    </>
  );
}