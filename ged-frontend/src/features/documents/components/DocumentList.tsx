import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../lib/axios';
import { useContract } from '../../../contexts/ContractContext';
import { usePlanning } from '../../planning/hooks/usePlanning';
import { useDisciplines } from '../../management/hooks/useDisciplines';
import { FileText, UploadCloud, Eye, History, Clock, CheckCircle, AlertCircle, Search, FilterX, Package } from 'lucide-react';
import { UploadForm } from './UploadForm';
import { DocumentViewer } from './DocumentViewer';
import { RevisionUploadForm } from './RevisionUploadForm';

interface Revision {
  id: number;
  versionLabel: string;
  filePath: string;
  createdAt: string;
}

// ÉPICO 8: Removido o campo legado `disciplina` — depende de contractDiscipline e workPackage
interface Document {
  id: number;
  codigoDocumento: string;
  titulo: string;
  ocrStatus: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  projectNumber: string | null;
  extractedRevision: string | null;
  contractDiscipline: { id: number; nome: string; codigo: string } | null;
  workPackage: { id: number; nome: string } | null;
  revisions: Revision[];
}

export function DocumentList() {
  const { contract, role } = useContract();
  const contractId = Number(contract?.id ?? 0);

  // ÉPICO 8: Busca Avançada (Busca Avançada e Filtros Refinados)
  const [busca, setBusca] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [pacoteId, setPacoteId] = useState('');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Hooks de Planejamento e Disciplinas do Contrato (multi-tenant)
  const { workPackages, fetchWorkPackages } = usePlanning(contractId);
  const { disciplines, fetchDisciplines } = useDisciplines(contractId);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [revDocId, setRevDocId] = useState<number | null>(null);
  const [revDocCodigo, setRevDocCodigo] = useState('');

  const navigate = useNavigate();
  const canUpload = role === 'GESTOR' || role === 'ENGENHEIRO';

  useEffect(() => {
    if (contractId) {
      fetchWorkPackages();
      fetchDisciplines();
    }
  }, [contractId, fetchWorkPackages, fetchDisciplines]);

  const fetchDocuments = useCallback(async () => {
    if (!contract?.id) return;
    try {
      setIsLoading(true);
      const response = await api.get(`/projects/${contract.id}/documents`, {
        params: {
          ...(busca.trim() ? { busca: busca.trim() } : {}),
          ...(disciplinaId ? { disciplinaId } : {}),
          ...(pacoteId ? { pacoteId } : {}),
        },
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [contract?.id, busca, disciplinaId, pacoteId]);

  // Debounce da busca textual (400ms) + refetch imediato ao trocar selects
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDocuments();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchDocuments]);

  const handleClearFilters = () => {
    setBusca('');
    setDisciplinaId('');
    setPacoteId('');
  };

  const hasActiveFilters = busca.trim() !== '' || disciplinaId !== '' || pacoteId !== '';

  const handleViewDocument = (doc: Document, url: string, nome: string) => {
    setSelectedDocument(doc);
    setSelectedFileUrl(url);
    setSelectedFileName(nome);
    setIsViewerOpen(true);
  };

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

        {/* ÉPICO 8: Toolbar de Busca Avançada */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex flex-col lg:flex-row gap-3">
            {/* Pesquisa por código ou título */}
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Pesquisar por código ou título..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm"
              />
            </div>

            {/* Filtro por Disciplina */}
            <div className="lg:w-64">
              <select
                value={disciplinaId}
                onChange={(e) => setDisciplinaId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white text-sm"
              >
                <option value="">Todas as disciplinas</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id.toString()}>
                    {discipline.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro por Pacote de Trabalho */}
            <div className="lg:w-64">
              <select
                value={pacoteId}
                onChange={(e) => setPacoteId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white text-sm"
              >
                <option value="">Todos os pacotes</option>
                {workPackages.map((workPackage) => (
                  <option key={workPackage.id} value={workPackage.id.toString()}>
                    {workPackage.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Limpar filtros */}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <FilterX className="w-4 h-4" />
                Limpar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="p-4 font-semibold">Código do Documento</th>
                <th className="p-4 font-semibold">Título</th>
                <th className="p-4 font-semibold">Disciplina</th>
                <th className="p-4 font-semibold">Pacote</th>
                <th className="p-4 font-semibold">Revisão Atual</th>
                <th className="p-4 font-semibold">Status RPA/OCR</th>
                <th className="p-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500 animate-pulse">
                    Carregando acervo técnico...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    {hasActiveFilters
                      ? 'Nenhum documento encontrado para os filtros aplicados.'
                      : 'Nenhum documento encontrado neste contrato.'}
                  </td>
                </tr>
              ) : (
                documents.map((doc) => {
                  const currentRev = doc.revisions[doc.revisions.length - 1];

                  if (!currentRev) return null;

                  return (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 font-medium text-gray-900">{doc.codigoDocumento}</td>
                      <td className="p-4 text-gray-700 max-w-xs truncate" title={doc.titulo}>
                        {doc.titulo}
                      </td>
                      <td className="p-4">
                        {doc.contractDiscipline ? (
                          <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-md font-medium">
                            {doc.contractDiscipline.nome}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Não vinculado</span>
                        )}
                      </td>
                      <td className="p-4">
                        {doc.workPackage ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-md font-medium">
                            <Package className="w-3 h-3" />
                            {doc.workPackage.nome}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
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

                        <button
                          onClick={() => navigate(`/documentos/${doc.id}`)}
                          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                          title="Ver Detalhes do Documento (Single Source of Truth)"
                        >
                          <FileText className="w-5 h-5" />
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
        documentData={selectedDocument ? {
          ocrStatus: selectedDocument.ocrStatus,
          projectNumber: selectedDocument.projectNumber,
          extractedRevision: selectedDocument.extractedRevision,
          disciplina: selectedDocument.contractDiscipline?.nome ?? null,
        } : null}
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
