import { useEffect, useState } from 'react';
import { api } from '../../../lib/axios'; 
import { useContract } from '../../../contexts/ContractContext';
import { FileText, UploadCloud, Eye, History, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadForm } from './UploadForm';
import { DocumentViewer } from './DocumentViewer'; 
import { RevisionUploadForm } from './RevisionUploadForm';

interface Revision {
  id: number;
  versionLabel: string; 
  filePath: string;
  createdAt: string;
}

// Atualizado para receber os dados do Épico 5 (OCR/RPA)
interface Document {
  id: number;
  codigoDocumento: string; 
  disciplina: string;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  projectNumber: string | null;
  extractedRevision: string | null;
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
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [revDocId, setRevDocId] = useState<number | null>(null);
  const [revDocCodigo, setRevDocCodigo] = useState('');

  const canUpload = role === 'GESTOR' || role === 'ENGENHEIRO';

  const handleViewDocument = (doc: Document, url: string, nome: string) => {
    setSelectedDocument(doc);
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

  const renderOcrStatus = (status: string) => {
    switch (status) {
      case 'PENDING':
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-md font-medium">
            <Clock className="w-3.5 h-3.5" /> A Extrair RPA...
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs rounded-md font-medium">
            <CheckCircle className="w-3.5 h-3.5" /> Metadados Lidos
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-800 text-xs rounded-md font-medium">
            <AlertCircle className="w-3.5 h-3.5" /> Falha no OCR
          </span>
        );
      default:
        return null;
    }
  };

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
                <th className="p-4 font-semibold">Status RPA/OCR</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">Nenhum documento encontrado neste contrato.</td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const currentRev = doc.revisions[doc.revisions.length - 1];
                  
                  if (!currentRev) return null;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-900">{doc.codigoDocumento}</td>
                      <td className="p-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium">{doc.disciplina}</span>
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 text-xs rounded-md font-bold">
                          {currentRev.versionLabel}
                        </span>
                      </td>
                      <td className="p-4">
                        {renderOcrStatus(doc.ocrStatus)}
                      </td>
                      <td className="p-4 flex justify-end gap-2">
                        
                        <button 
                          onClick={() => handleViewDocument(doc, currentRev.filePath, `${doc.codigoDocumento} - ${currentRev.versionLabel}`)}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Visualizar Documento e Metadados"
                        >
                          <Eye className="w-5 h-5" />
                        </button>
                        
                        <button className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Histórico"><History className="w-5 h-5" /></button>
                        
                        {canUpload && (
                          <button 
                            onClick={() => {
                              setRevDocId(doc.id);
                              setRevDocCodigo(doc.codigoDocumento); 
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
        documentData={selectedDocument}
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