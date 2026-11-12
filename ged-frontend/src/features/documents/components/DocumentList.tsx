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
import { usePermissions } from '../../../hooks/usePermissions';
import { usePlanning } from '../../planning/hooks/usePlanning';
import { useDisciplines } from '../../management/hooks/useDisciplines';
import { useDocumentsQuery } from '../hooks/useDocumentsQuery';
import { EmitirGrdModal } from '../../transmittals/components/EmitirGrdModal';
import {
  FileText, UploadCloud, Eye, History, Send,
  Search, FilterX, Package, Download, MoreHorizontal, FilePenLine,
  Clock, CheckCircle2, XCircle, Tag, AlertCircle,
} from 'lucide-react';
import { UploadForm } from './UploadForm';
import { DocumentViewer, type ViewerDocument, type ViewerRevision } from './DocumentViewer';
import { RevisionUploadForm } from './RevisionUploadForm';
import { RevisionHistoryModal } from './RevisionHistoryModal';
import { documentService } from '../services/document.service';
import type { DocumentListItem } from '../types/document.types';
import type { RevisionStatus } from '../../../types/prisma-types';

// Ã‰PICO 8: Removido o campo legado `disciplina` â€” depende de contractDiscipline e workPackage

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// SemÃ¢ntica de status de revisÃ£o (paleta tÃ©cnica de engenharia)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_CFG: Record<RevisionStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  EM_ELABORACAO: {
    label: 'Em ElaboraÃ§Ã£o',
    icon: <Clock className="w-3 h-3" />,
    badge: 'bg-sky-50 text-sky-700 border border-sky-200',
  },
  EM_REVISAO: {
    label: 'Em RevisÃ£o',
    icon: <AlertCircle className="w-3 h-3" />,
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
  APROVADO: {
    label: 'Aprovado',
    icon: <CheckCircle2 className="w-3 h-3" />,
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-300',
  },
  REJEITADO: {
    label: 'Reprovado',
    icon: <XCircle className="w-3 h-3" />,
    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
  OBSOLETO: {
    label: 'Obsoleto',
    icon: <Tag className="w-3 h-3" />,
    badge: 'bg-slate-100 text-slate-500 border border-slate-200',
  },
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Colunas da tabela (definidas uma Ãºnica vez; semÃ¢ntica pura, sem closures list)
const columnHelper = createColumnHelper<DocumentListItem>();

export function DocumentList() {
  const { contract } = useContract();
  const contractId = Number(contract?.id ?? 0);
  const { canCreateDocument, canUploadRevision, canEmitTransmittal } = usePermissions();

  // Ã‰PICO 8: Busca AvanÃ§ada (Busca e Filtros Refinados) â€” fonte da verdade dos filtros
  const [busca, setBusca] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [pacoteId, setPacoteId] = useState('');
  const [debouncedBusca, setDebouncedBusca] = useState('');

  // SeleÃ§Ã£o mÃºltipla de linhas (bulk actions)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  // ETAPA 2.6.5: emissÃ£o de GRD a partir do Acervo TÃ©cnico
  const [isEmitirGrdOpen, setIsEmitirGrdOpen] = useState(false);
  // SessÃ£o da GRD: incrementa a cada abertura para remontar o modal limpo
  const [grdSessionKey, setGrdSessionKey] = useState(0);

  // Hooks auxiliares do contrato (multi-tenant)
  const { workPackages, fetchWorkPackages } = usePlanning(contractId);
  const { disciplines, fetchDisciplines } = useDisciplines(contractId);

  // React Query: busca/cache/sincronizaÃ§Ã£o do acervo
  const filters = useMemo(
    () => ({ busca: debouncedBusca, disciplinaId, pacoteId }),
    [debouncedBusca, disciplinaId, pacoteId]
  );
  const { data: documents = [], isLoading, isFetching, refetch } = useDocumentsQuery(contractId, filters);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  // Dados ricos para o dock lateral do viewer (Etapa 1)
  const [viewerDocument, setViewerDocument] = useState<ViewerDocument | undefined>(undefined);
  const [viewerRevision, setViewerRevision] = useState<ViewerRevision | undefined>(undefined);
  const [viewerAllRevisions, setViewerAllRevisions] = useState<ViewerRevision[]>([]);

  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  const [revDocId, setRevDocId] = useState<number | null>(null);
  const [revDocCodigo, setRevDocCodigo] = useState('');

  // Ã‰PICO 8: Acesso RÃ¡pido ao HistÃ³rico (Modal/Popover de VersÃµes)
  const [historyDoc, setHistoryDoc] = useState<DocumentListItem | null>(null);

  // Ã‰PICO 11: ExportaÃ§Ã£o de MDR
  const [isExporting, setIsExporting] = useState(false);

  // Menu dropdown de aÃ§Ãµes por linha
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const navigate = useNavigate();
  const canUpload = canCreateDocument && canUploadRevision;

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

  // Ã‰PICO 11: ExportaÃ§Ã£o de MDR
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

  const handleViewDocument = (url: string, nome: string, doc?: DocumentListItem, rev?: DocumentListItem['revisions'][0]) => {
    setSelectedFileUrl(url);
    setSelectedFileName(nome);
    if (doc) {
      setViewerDocument({
        id: doc.id,
        codigoDocumento: doc.codigoDocumento,
        titulo: doc.titulo,
        disciplina: doc.contractDiscipline?.nome,
        workPackage: doc.workPackage?.nome,
      });
      setViewerAllRevisions(doc.revisions.map((r) => ({
        id: r.id,
        versionLabel: r.versionLabel,
        filePath: r.filePath,
        createdAt: r.createdAt,
      })));
    }
    if (rev) {
      setViewerRevision({
        id: rev.id,
        versionLabel: rev.versionLabel,
        filePath: rev.filePath,
        createdAt: rev.createdAt,
      });
    }
    setIsViewerOpen(true);
    setOpenMenuId(null);
  };

  const handleOpenRevision = (doc: DocumentListItem) => {
    setRevDocId(doc.id);
    setRevDocCodigo(doc.codigoDocumento);
    setIsRevModalOpen(true);
    setOpenMenuId(null);
  };

  // â”€â”€ DefiniÃ§Ã£o das colunas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
          title="Selecionar todas desta pÃ¡gina"
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
      header: () => <span>CÃ³digo do Documento</span>,
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
      header: () => <span>TÃ­tulo</span>,
      cell: ({ row, getValue }) => (
        <Link
          to={`/contracts/${contractId}/documents/${row.original.id}`}
          className="text-slate-600 hover:text-blue-600 hover:underline truncate transition-colors"
          title={`${getValue()} â€” Abrir detalhamento`}
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
          <span className="text-[11px] text-slate-400 italic">NÃ£o vinculado</span>
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
          <span className="text-[11px] text-slate-400 italic">â€”</span>
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
        ) : (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[11px] rounded font-medium whitespace-nowrap">
            <FileText className="w-3 h-3" />
            Sem arquivo
          </span>
        );
      },
    }),
    // ETAPA 1: Coluna de status semÃ¢ntico (paleta tÃ©cnica de engenharia)
    columnHelper.display({
      id: 'status',
      header: () => <span>Status</span>,
      cell: ({ row }) => {
        const revisions = row.original.revisions;
        const currentRev = revisions[revisions.length - 1];
        const rawStatus = (currentRev as (typeof currentRev & { status?: RevisionStatus }) | undefined)?.status;
        if (!rawStatus) {
          return currentRev ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-semibold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
              <Clock className="w-3 h-3" />
              Em ElaboraÃ§Ã£o
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 italic">â€”</span>
          );
        }
        const cfg = STATUS_CFG[rawStatus];
        if (!cfg) return null;
        return (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-semibold whitespace-nowrap ${cfg.badge}`}>
            {cfg.icon}
            {cfg.label}
          </span>
        );
      },
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="text-right block w-full">AÃ§Ãµes</span>,
      cell: ({ row }) => (
        <div
          className="relative flex justify-end"
          ref={openMenuId === row.original.id ? menuRef : undefined}
        >
          <button
            onClick={() => setOpenMenuId(openMenuId === row.original.id ? null : row.original.id)}
            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Mais aÃ§Ãµes"
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
                    handleViewDocument(
                      rev.filePath,
                      `${row.original.codigoDocumento} - ${rev.versionLabel}`,
                      row.original,
                      rev,
                    );
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
                label="HistÃ³rico de VersÃµes"
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
              Acervo TÃ©cnico
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Gerencie plantas, diagramas e revisÃµes.</p>
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

        {/* Toolbar de Busca AvanÃ§ada */}
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <div className="flex flex-col lg:flex-row gap-2.5">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por cÃ³digo, tÃ­tulo ou conteÃºdo do PDF..."
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

        {/* Barra de AÃ§Ãµes em Lote (bulk actions) */}
        {selectedRows.length > 0 && (
          <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-medium text-blue-800">
              {selectedRows.length} documento{selectedRows.length !== 1 ? 's' : ''} selecionado{selectedRows.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              {canEmitTransmittal && (
                <button
                  onClick={() => {
                    setGrdSessionKey((prev) => prev + 1);
                    setIsEmitirGrdOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 bg-blue-800 hover:bg-blue-900 text-white px-3 py-1.5 text-sm font-bold rounded-lg shadow-sm transition-colors"
                  title="Gerar uma Guia de Remessa de Documentos com o lote selecionado"
                >
                  <Send className="w-4 h-4" />
                  Emitir GRD
                </button>
              )}
              <button
                onClick={() => table.resetRowSelection()}
                className="text-[11px] font-medium text-blue-700 hover:text-blue-900 hover:underline"
              >
                Limpar seleÃ§Ã£o
              </button>
            </div>
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
                    Carregando acervo tÃ©cnico...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center">
                        <FileText className="w-7 h-7 text-slate-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-600">
                          {hasActiveFilters ? 'Nenhum resultado encontrado' : 'Acervo técnico vazio'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                          {hasActiveFilters
                            ? 'Nenhum documento corresponde aos filtros aplicados. Tente ajustar ou limpar os critérios de busca.'
                            : 'Este contrato ainda não possui documentos cadastrados. Clique em "Novo Documento (R0)" para iniciar o acervo.'}
                        </p>
                      </div>
                    </div>
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
        onClose={() => {
          setIsViewerOpen(false);
          setViewerDocument(undefined);
          setViewerRevision(undefined);
          setViewerAllRevisions([]);
        }}
        fileUrl={selectedFileUrl}
        fileName={selectedFileName}
        document={viewerDocument}
        currentRevision={viewerRevision}
        allRevisions={viewerAllRevisions}
        onSelectRevision={(rev) => {
          setSelectedFileUrl(rev.filePath);
          setViewerRevision(rev);
        }}
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

      <EmitirGrdModal
        isOpen={isEmitirGrdOpen}
        onClose={() => setIsEmitirGrdOpen(false)}
        contractId={contractId}
        documents={selectedRows.map((row) => row.original)}
        sessionKey={grdSessionKey}
        onSuccess={() => {
          table.resetRowSelection();
          refetch();
        }}
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

