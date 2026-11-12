/**
 * DocumentViewer — Bancada de Análise Técnica Enterprise
 *
 * ETAPA 1 (Modernização UI): Substituição do modal simples por uma workstation
 * tela-cheia com split-view: visualizador de PDF à esquerda + dock lateral
 * retrátil à direita com metadados, histórico de revisões e ações rápidas.
 */
import { useState } from 'react';
import {
  X,
  Download,
  Maximize2,
  ChevronRight,
  FileText,
  Clock,
  Hash,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Tag,
  History,
  Info,
  PanelRightClose,
  PanelRightOpen,
  ExternalLink,
} from 'lucide-react';
import type { RevisionStatus } from '../../../types/prisma-types';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export interface ViewerRevision {
  id: number;
  versionLabel: string;
  filePath: string;
  fileHash?: string;
  fileSize?: number;
  status?: RevisionStatus;
  createdAt?: string;
}

export interface ViewerDocument {
  id: number;
  codigoDocumento: string;
  titulo: string;
  disciplina?: string;
  workPackage?: string;
}

interface DocumentViewerProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string | null;
  fileName: string;
  /** Metadados opcionais do documento para o dock lateral */
  document?: ViewerDocument;
  /** Revisão sendo visualizada */
  currentRevision?: ViewerRevision;
  /** Todas as revisões do documento para o histórico */
  allRevisions?: ViewerRevision[];
  /** Callback para abrir uma revisão diferente */
  onSelectRevision?: (rev: ViewerRevision) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' — ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Semântica de status de engenharia (cores técnicas por norma)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RevisionStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  EM_ELABORACAO: {
    label: 'Em Elaboração',
    icon: <Clock className="w-3.5 h-3.5" />,
    badge: 'bg-sky-50 text-sky-700 border border-sky-200',
  },
  EM_REVISAO: {
    label: 'Em Revisão',
    icon: <AlertCircle className="w-3.5 h-3.5" />,
    badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  },
  APROVADO: {
    label: 'Aprovado',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-300',
  },
  REJEITADO: {
    label: 'Reprovado',
    icon: <XCircle className="w-3.5 h-3.5" />,
    badge: 'bg-rose-50 text-rose-700 border border-rose-200',
  },
  OBSOLETO: {
    label: 'Obsoleto',
    icon: <Tag className="w-3.5 h-3.5" />,
    badge: 'bg-slate-100 text-slate-500 border border-slate-200 line-through opacity-70',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Aba de Metadados
// ─────────────────────────────────────────────────────────────────────────────

function MetadataTab({
  document: doc,
  currentRevision,
}: {
  document?: ViewerDocument;
  currentRevision?: ViewerRevision;
}) {
  const statusCfg = currentRevision?.status ? STATUS_CONFIG[currentRevision.status] : null;

  return (
    <div className="space-y-5 p-4">
      {/* Código e Título */}
      {doc && (
        <section>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Identificação
          </h4>
          <div className="space-y-2">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Código</span>
              <span className="text-sm font-mono font-bold text-slate-800">{doc.codigoDocumento}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Título</span>
              <span className="text-sm font-medium text-slate-700 leading-snug">{doc.titulo}</span>
            </div>
            {doc.disciplina && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Disciplina</span>
                <span className="inline-block w-fit px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] rounded font-medium">
                  {doc.disciplina}
                </span>
              </div>
            )}
            {doc.workPackage && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Pacote de Trabalho</span>
                <span className="inline-block w-fit px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] rounded font-medium">
                  {doc.workPackage}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Revisão Atual */}
      {currentRevision && (
        <section className="border-t border-slate-100 pt-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Revisão Visualizada
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Rótulo</span>
              <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-800 text-[11px] rounded font-bold">
                {currentRevision.versionLabel}
              </span>
            </div>
            {statusCfg && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Status</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded font-semibold ${statusCfg.badge}`}>
                  {statusCfg.icon}
                  {statusCfg.label}
                </span>
              </div>
            )}
            {currentRevision.createdAt && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Emitida em</span>
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {formatDate(currentRevision.createdAt)}
                </span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Integridade do Arquivo */}
      {currentRevision && (
        <section className="border-t border-slate-100 pt-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
            Integridade do Arquivo
          </h4>
          <div className="space-y-2">
            {currentRevision.fileHash && (
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" /> SHA-256
                </span>
                <span
                  className="text-[10px] font-mono text-slate-500 break-all bg-slate-50 rounded p-1.5 border border-slate-200"
                  title={currentRevision.fileHash}
                >
                  {currentRevision.fileHash}
                </span>
              </div>
            )}
            {currentRevision.fileSize && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider">Tamanho</span>
                <span className="text-xs font-mono text-slate-600">{formatFileSize(currentRevision.fileSize)}</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: Aba de Histórico de Revisões
// ─────────────────────────────────────────────────────────────────────────────

function HistoryTab({
  revisions,
  currentRevision,
  onSelectRevision,
}: {
  revisions: ViewerRevision[];
  currentRevision?: ViewerRevision;
  onSelectRevision?: (rev: ViewerRevision) => void;
}) {
  const sorted = [...revisions].sort(
    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-slate-400">
        <FileText className="w-8 h-8 mb-2 opacity-40" />
        <p className="text-xs text-center">Nenhuma revisão anterior registrada.</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-2">
      {sorted.map((rev, idx) => {
        const isActive = currentRevision?.id === rev.id;
        const isLatest = idx === 0;
        const statusCfg = rev.status ? STATUS_CONFIG[rev.status] : null;

        return (
          <button
            key={rev.id}
            onClick={() => onSelectRevision?.(rev)}
            className={`w-full text-left rounded-lg border p-3 transition-all ${
              isActive
                ? 'border-blue-400 bg-blue-50 shadow-sm'
                : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className={`text-sm font-bold ${isActive ? 'text-blue-700' : 'text-slate-800'}`}>
                {rev.versionLabel}
              </span>
              <div className="flex items-center gap-1.5">
                {isLatest && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Atual
                  </span>
                )}
                {statusCfg && (
                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded font-semibold ${statusCfg.badge}`}>
                    {statusCfg.icon}
                  </span>
                )}
              </div>
            </div>
            {rev.createdAt && (
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(rev.createdAt)}
              </div>
            )}
            {isActive && (
              <div className="mt-1.5 text-[10px] font-semibold text-blue-600">▶ Visualizando agora</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente Principal: DocumentViewer (Workstation Enterprise)
// ─────────────────────────────────────────────────────────────────────────────

type SideTab = 'info' | 'history';

export function DocumentViewer({
  isOpen,
  onClose,
  fileUrl,
  fileName,
  document: doc,
  currentRevision,
  allRevisions = [],
  onSelectRevision,
}: DocumentViewerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SideTab>('info');

  if (!isOpen || !fileUrl) return null;

  const hasRichData = !!(doc || currentRevision || allRevisions.length > 0);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-slate-900">
      {/* ── Barra de Ferramentas Superior ───────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 shrink-0">
        {/* Identificação do documento */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded bg-blue-600 shrink-0">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-white truncate leading-tight">
              {doc?.codigoDocumento ?? fileName}
            </h3>
            {doc?.titulo && (
              <p className="text-[11px] text-slate-400 truncate leading-tight">{doc.titulo}</p>
            )}
          </div>
          {currentRevision && (
            <span className="shrink-0 inline-block px-2 py-0.5 bg-blue-700 text-blue-100 text-[11px] font-bold rounded">
              {currentRevision.versionLabel}
            </span>
          )}
        </div>

        {/* Ações da toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Abrir em nova aba"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Abrir</span>
          </a>
          <a
            href={fileUrl}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
            title="Baixar arquivo original"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar</span>
          </a>
          {hasRichData && (
            <button
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title={sidebarOpen ? 'Recolher painel lateral' : 'Expandir painel lateral'}
            >
              {sidebarOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{sidebarOpen ? 'Recolher' : 'Expandir'}</span>
            </button>
          )}
          <div className="w-px h-5 bg-slate-700 mx-1" />
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-300 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
            title="Fechar visualizador"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fechar</span>
          </button>
        </div>
      </div>

      {/* ── Área Principal: PDF + Dock Lateral ──────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Visualizador PDF */}
        <div className="flex-1 relative bg-slate-800 overflow-hidden">
          <iframe
            src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1`}
            className="w-full h-full border-none"
            title={`Visualizando ${fileName}`}
          />
          {/* Overlay fullscreen hint */}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 bg-slate-900/80 text-white text-xs rounded-lg hover:bg-slate-900 transition-colors backdrop-blur-sm"
            title="Abrir em tela cheia"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Tela cheia
          </a>
        </div>

        {/* Dock Lateral Retrátil */}
        {hasRichData && sidebarOpen && (
          <aside className="w-72 shrink-0 bg-white border-l border-slate-200 flex flex-col overflow-hidden shadow-xl">
            {/* Abas do dock */}
            <div className="flex border-b border-slate-200 shrink-0">
              <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                  activeTab === 'info'
                    ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Info className="w-3.5 h-3.5" />
                Metadados
              </button>
              {allRevisions.length > 0 && (
                <button
                  onClick={() => setActiveTab('history')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
                    activeTab === 'history'
                      ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/50'
                      : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  Revisões
                  <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 bg-slate-200 text-slate-600 text-[10px] font-bold rounded-full">
                    {allRevisions.length}
                  </span>
                </button>
              )}
            </div>

            {/* Conteúdo da aba */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === 'info' ? (
                <MetadataTab document={doc} currentRevision={currentRevision} />
              ) : (
                <HistoryTab
                  revisions={allRevisions}
                  currentRevision={currentRevision}
                  onSelectRevision={onSelectRevision}
                />
              )}
            </div>

            {/* Rodapé com ação de Detalhamento */}
            {doc && (
              <div className="shrink-0 border-t border-slate-200 p-3">
                <a
                  href={`/contracts/${doc.id}/documents/${doc.id}`}
                  className="flex items-center justify-between w-full px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
                >
                  <span>Ver ficha completa do documento</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
