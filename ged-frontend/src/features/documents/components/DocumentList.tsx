import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type RowSelectionState,
  type Row,
} from '@tanstack/react-table';
import { useContract } from '../../../contexts/ContractContext';
import { usePlanning } from '../../planning/hooks/usePlanning';
import { useDisciplines } from '../../management/hooks/useDisciplines';
import { useDocumentsQuery } from '../hooks/useDocumentsQuery';
import {
  FileText, UploadCloud, Eye, History, Clock, CheckCircle, AlertCircle,
  Search, FilterX, Package, Download, MoreHorizontal, FilePenLine,
} from 'lucide-react';
import { UploadForm } from './UploadForm';
import { DocumentViewer } from './DocumentViewer';
import { RevisionUploadForm } from './RevisionUploadForm';
import { RevisionHistoryModal } from './RevisionHistoryModal';
import { documentService } from '../services/document.service';
import type { DocumentListItem } from '../types/document.types';

// ÉPICO 8: Removido o campo legado `disciplina` — depende de contractDiscipline e workPackage

// ─────────────────────────────────────────────────────────────────────────────
// Colunas da tabela (definidas uma única vez; semântica pura, sem closures list)
const columnHelper = createColumnHelper<DocumentListItem>();

const renderOcrStatus = (status: string) => {
  switch (status) {
    case 'PENDING':
    case 'PROCESSING':
      return (
        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-[11px] rounded font-medium whitespace-nowrap">
          <Clock className="w-3 h-3 text-amber-500" /> A Extrair RPA...
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-[11px] rounded font-medium whitespace-nowrap">
          <CheckCircle className="w-3 h-3 text-emerald-500" /> Metadados Lidos
        </span>
      );
    case 'FAILED':
      return (
        <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-[11px] rounded font-medium whitespace-nowrap">
          <AlertCircle className="w-3 h-3 text-red-500" /> Falha no OCR
        </span>
      );
    default:
      return null;
  }
};

export function DocumentList() {
  const { contract, role } = useContract();
  const contractId = Number(contract?.id ?? 0);

  // ÉPICO 8: Busca Avançada (Busca e Filtros Refinados) — fonte da verdade dos filtros
  const [busca, setBusca] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [pacoteId, setPacoteId] = useState('');
  const [debouncedBusca, setDebouncedBusca] = useState('');

  // Seleção múltipla de linhas (bulk actions)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // Hooks auxiliares do contrato (multi-tenant)
  const { workPackages, fetchWorkPackages } = usePlanning(contractId);
  const { disciplines, fetchDisciplines } = useDisciplines(contractId);

  // React Query: busca/cache/sincronização do acervo
  const filters = useMemo(
    () => ({ busca: debouncedBusca, disciplinaId, pacoteId }),
    [debouncedBusca, disciplinaId, pacoteId]
  );
  const { data: documents = [], isLoading, isFetching, refetch } = useDocumentsQuery(contractId, filters);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<DocumentListItem | null>(null);

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [revDocId, setRevDocId] = useState<number | null>(null);
  const [revDocCodigo, setRevDocCodigo] = useState('');

  // ÉPICO 8: Acesso Rápido ao Histórico (Modal/Popover de Versões)
  const [historyDoc, setHistoryDoc] = useState<DocumentListItem | null>(null);

  // ÉPICO 11: Exportação de MDR
  const [isExporting, setIsExporting] = useState(false);

  // Menu dropdown de ações por linha
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const canUpload = role === 'GESTOR' || role === 'ENGENHEIRO';

  // Carrega pacotes e disciplinas do contrato
  useEffect(() => {
    if (contractId) {
      fetchWorkPackages();
      fetchDisciplines();
    }
  }, [contractId, fetchWorkPackages, fetchDisciplines]);

  // Debounce da busca textual (400ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedBusca(busca.trim()), 400);
    return () => clearTimeout(timer);
  }, [busca]);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClearFilters = () => {
    setBusca('');
    setDisciplinaId('');
    setPacoteId('');
  };

  const hasActiveFilters = busca.trim() !== '' || disciplinaId !== '' || pacoteId !== '';

  // ÉPICO 11: Exportação de MDR
  const handleExportMDR = async () => {
    if (!contractId) return;
    try {
      setIsExporting(true);
      const blob = await documentService.exportMDR(contractId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `MDR_Contrato_${dateStr}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar MDR:', error);
      alert('Erro ao exportar o MDR. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleViewDocument = (doc: DocumentListItem, url: string, nome: string) => {
    setSelectedDocument(doc);
    setSelectedFileUrl(url);
    setSelectedFileName(nome);
    setIsViewerOpen(true);
    setOpenMenuId(null);
  };

  const handleOpenRevision = (doc: DocumentListItem) => {
    setRevDocId(doc.id);
    setRevDocCodigo(doc.codigoDocumento);
    setIsRevModalOpen(true);
    setOpenMenuId(null);
  };

  // ── Definição das colunas ────────────────────────────────────────────────
  const columns = useMemo(() => [
    columnHelper.display({
      id: 'select',
      header: ({ table }) => (
        <input
          type="checkbox"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected();
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          title="Selecionar todas desta página"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
        />
      ),
      enableSorting: false,
    }),
    columnHelper.accessor('codigoDocumento', {
      header: () => <span>Código do Documento</span>,
      cell: ({ row, getValue }) => (
        <Link
          to={`/contracts/${contractId}/documents/${row.original.id}`}
          className="text-slate-900 hover:text-blue-600 hover:underline font-semibold transition-colors"
          title="Abrir detalhamento do documento"
        >
          {getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('titulo', {
      header: () => <span>Título</span>,
      cell: ({ row, getValue }) => (
        <Link
          to={`/contracts/${contractId}/documents/${row.original.id}`}
          className="text-slate-600 hover:text-blue-600 hover:underline truncate transition-colors"
          title={`${getValue()} — Abrir detalhamento`}
        >
          {getValue()}
        </Link>
      ),
    }),
    columnHelper.accessor('contractDiscipline.nome', {
      id: 'disciplina',
      header: () => <span>Disciplina</span>,
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded font-medium whitespace-nowrap">
            {getValue() as string}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">Não vinculado</span>
        ),
    }),
    columnHelper.accessor('workPackage.nome', {
      id: 'pacote',
      header: () => <span>Pacote</span>,
      cell: ({ getValue }) =>
        getValue() ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] rounded font-medium whitespace-nowrap">
            <Package className="w-3 h-3" />
            {getValue() as string}
          </span>
        ) : (
          <span className="text-[11px] text-slate-400 italic">—</span>
        ),
    }),
    columnHelper.accessor('revisions', {
      id: 'revisao',
      header: () => <span>Rev Atual</span>,
      cell: ({ row }) => {
        const revisions = row.original.revisions;
        const currentRev = revisions[revisions.length - 1];
        return currentRev ? (
          <span className="inline-block px-1.5 py-0.5 bg-blue-50 text-blue-800 text-[11px] rounded font-bold whitespace-nowrap">
            {currentRev.versionLabel}
          </span>
        ) : null;
      },
    }),
    columnHelper.accessor('ocrStatus', {
      id: 'ocrStatus',
      header: () => <span>Status RPA/OCR</span>,
      cell: ({ getValue }) => renderOcrStatus(getValue() as string),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="text-right block w-full">Ações</span>,
      cell: ({ row }) => (
        <div
          className="relative flex justify-end"
          ref={openMenuId === row.original.id ? menuRef : undefined}
        >
          <button
            onClick={() => setOpenMenuId(openMenuId === row.original.id ? null : row.original.id)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Mais ações"
          >
            <MoreHorizontal className="w-4.5 h-4.5" />
          </button>

          {openMenuId === row.original.id && (
            <div className="absolute z-40 right-0 top-0 mt-7 w-52 bg-white rounded-lg border border-slate-200 shadow-lg py-1">
              <RowAction
                icon={Eye}
                label="Visualizar Documento"
                onClick={() => {
                  const rev = row.original.revisions[row.original.revisions.length - 1];
                  if (rev) {
                    handleViewDocument(row.original, rev.filePath, `${row.original.codigoDocumento} - ${rev.versionLabel}`);
                  }
                }}
              />
              <RowAction
                icon={FileText}
                label="Detalhes (Single Source of Truth)"
                onClick={() => {
                  navigate(`/documentos/${row.original.id}`);
                  setOpenMenuId(null);
                }}
              />
              <RowAction
                icon={History}
                label="Histórico de Versões"
                onClick={() => {
                  setHistoryDoc(row.original);
                  setOpenMenuId(null);
                }}
              />
              {canUpload && (
                <div className="border-t border-slate-100 mt-1 pt-1">
                  <RowAction
                    icon={FilePenLine}
                    label="Subir Nova Rev"
                    accent
                    onClick={() => handleOpenRevision(row.original)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ),
    }),
  ], [contractId, canUpload, openMenuId, navigate]);

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    state: {
      rowSelection,
    },
    onRowSelectionChange: setRowSelection,
  });

  const selectedRows = table.getSelectedRowModel().rows as Row<DocumentListItem>[];

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              Acervo Técnico
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Gerencie plantas, diagramas e revisões.</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              {documents.length} documento{documents.length !== 1 ? 's' : ''}
            </span>
            {canUpload && (
              <button
                onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 text-sm rounded-lg font-medium transition-colors"
              >
                <UploadCloud className="w-4 h-4" />
                Novo Documento (R0)
              </button>
            )}
          </div>
        </div>

        {/* Toolbar de Busca Avançada */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex flex-col lg:flex-row gap-2.5">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por código, título ou conteúdo do PDF..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none text-sm"
              />
              {isFetching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-blue-600 animate-pulse">
                  Sincronizando...
                </span>
              )}
            </div>

            <div className="lg:w-56">
              <select
                value={disciplinaId}
                onChange={(e) => setDisciplinaId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white text-sm"
              >
                <option value="">Todas as disciplinas</option>
                {disciplines.map((discipline) => (
                  <option key={discipline.id} value={discipline.id.toString()}>
                    {discipline.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:w-56">
              <select
                value={pacoteId}
                onChange={(e) => setPacoteId(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none bg-white text-sm"
              >
                <option value="">Todos os pacotes</option>
                {workPackages.map((workPackage) => (
                  <option key={workPackage.id} value={workPackage.id.toString()}>
                    {workPackage.nome}
                  </option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <FilterX className="w-4 h-4" />
                Limpar
              </button>
            )}

            <button
              onClick={handleExportMDR}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 border border-emerald-300 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'Exportando...' : 'Exportar MDR'}
            </button>
          </div>
        </div>

        {/* Barra de Ações em Lote (bulk actions) */}
        {selectedRows.length > 0 && (
          <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-blue-800">
              {selectedRows.length} documento{selectedRows.length !== 1 ? 's' : ''} selecionado{selectedRows.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={() => table.resetRowSelection()}
              className="text-[11px] font-medium text-blue-700 hover:text-blue-900 hover:underline"
            >
              Limpar seleção
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-200">
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-3 py-2 font-semibold whitespace-nowrap">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading && documents.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500 animate-pulse">
                    Carregando acervo técnico...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500 text-sm">
                    {hasActiveFilters
                      ? 'Nenhum documento encontrado para os filtros aplicados.'
                      : 'Nenhum documento encontrado neste contrato.'}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-slate-50 transition-colors ${row.getIsSelected() ? 'bg-blue-50/60' : ''}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-1.5 text-[13px] leading-relaxed">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UploadForm
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={() => refetch()}
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
        onSuccess={() => refetch()}
      />

      <RevisionHistoryModal
        isOpen={historyDoc !== null}
        onClose={() => setHistoryDoc(null)}
        codigoDocumento={historyDoc?.codigoDocumento ?? ''}
        titulo={historyDoc?.titulo ?? ''}
        revisions={historyDoc?.revisions ?? []}
      />
    </>
  );
}

interface RowActionProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  accent?: boolean;
}

function RowAction({ icon: Icon, label, onClick, accent }: RowActionProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors ${
        accent ? 'text-blue-700 hover:bg-blue-50 font-medium' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </button>
  );
}
