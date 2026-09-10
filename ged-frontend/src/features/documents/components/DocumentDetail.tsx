import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { documentService } from '../services/document.service';
import type { DocumentDetail, RevisionDetail, TransmittalItemDetail, ApprovalWorkflowDetail } from '../types/document.types';
import { DocumentViewer } from './DocumentViewer';
import { RevisionUploadForm } from './RevisionUploadForm';
import { TimesheetForm } from './TimesheetForm';
import { TimesheetList } from './TimesheetList';
import { useTimesheet } from '../hooks/useTimesheet';
import { WorkflowFlowchart, getWorkflowStageIndex } from './WorkflowFlowchart';
import { InternalCorrectionForm } from './InternalCorrectionForm';
import { usePermissions } from '../../../hooks/usePermissions';
import type { ApprovalStatus, ApprovalStage } from '../../../types/prisma-types';
import {
  ChevronLeft,
  FileText,
  Calendar,
  User,
  Hash,
  Tag,
  Clock,
  CheckCircle,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Download,
  Eye,
  Send,
  XCircle,
  Loader2,
  UploadCloud,
  Copy,
  Repeat,
  Building2,
  History,
  Hourglass,
  PlusCircle,
  Workflow,
  MessageSquare,
  Paperclip,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 10.2: Estágios da Máquina de Estados (rótulos dos carimbos)
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  VERIFICACAO: { label: 'Verificação (Time Interno)', bg: 'bg-sky-100', text: 'text-sky-800' },
  APROVACAO: { label: 'Aprovação (Coordenação)', bg: 'bg-violet-100', text: 'text-violet-800' },
  CLIENTE: { label: 'Análise do Cliente', bg: 'bg-orange-100', text: 'text-orange-800' },
};

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] ?? { label: stage, bg: 'bg-gray-100', text: 'text-gray-700' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${cfg.bg} ${cfg.text} text-[10px] font-bold rounded-full uppercase tracking-wide`}>
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 10.3: GATEKEEPER DE NOVA REVISÃO OFICIAL (espelho do backend)
// PREMISSA MÁXIMA: Retrabalho Interno ≠ Revisão Oficial. A R+1 só nasce após
// o ciclo de Análise do Cliente ser concluído. Reprovações internas NÃO
// desbloqueiam nova revisão — o retrabalho usa a Correção Interna.
// ─────────────────────────────────────────────────────────────────────────────

export function canCreateNewRevision(revision: RevisionDetail): boolean {
  const approvals = revision.approvalWorkflows ?? [];
  const hasOpenPending = approvals.some((a) => a.status === 'PENDENTE');

  const clientApprovals = approvals.filter((a) => a.stage === 'CLIENTE');
  const clientCycleDone =
    clientApprovals.length > 0 && clientApprovals.every((a) => a.status !== 'PENDENTE');

  const legacyWithoutApprovals = approvals.length === 0 && revision.status === 'APROVADO';

  return !hasOpenPending && (clientCycleDone || legacyWithoutApprovals);
}

// ─────────────────────────────────────────────────────────────────────────────
// PATCH 10.3: Modo de ação do rodapé do card (botão dinâmico por estágio)
// CENÁRIO A — Retrabalho Interno: estágio "Revisão Verificação" ou
//   "Revisão Aprovação" → Enviar Correção Interna (mantém R atual).
// CENÁRIO B — Retorno do Cliente: ciclo da Análise do Cliente concluído
//   (REPROVADO / APROVADO_COM_COMENTARIOS) → Nova Revisão Oficial (R+1).
// ─────────────────────────────────────────────────────────────────────────────

export type RevisionFooterMode = 'INTERNAL_REWORK' | 'NEW_OFFICIAL_REVISION' | 'LOCKED';

export function getRevisionFooterMode(revision: RevisionDetail): RevisionFooterMode {
  const stageIndex = getWorkflowStageIndex(revision);

  // Etapas 2 e 4 do fluxograma: retorno interno ao autor (retrabalho)
  if (stageIndex === 2 || stageIndex === 4) {
    return 'INTERNAL_REWORK';
  }

  if (canCreateNewRevision(revision)) {
    return 'NEW_OFFICIAL_REVISION';
  }

  return 'LOCKED';
}

// PATCH 10.3: Rótulo da próxima revisão oficial (espelho do backend: R(n) → R(n+1))
function getNextVersionLabel(currentLabel: string): string {
  const match = currentLabel.match(/R(\d+)/i);
  return match && match[1] ? `R${parseInt(match[1], 10) + 1}` : `${currentLabel}+`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Revision Status Badge
// ─────────────────────────────────────────────────────────────────────────────

interface RevisionStatusBadgeProps {
  status: string;
}

function RevisionStatusBadge({ status }: RevisionStatusBadgeProps) {
  const config: Record<string, { bg: string; text: string; label: string; icon: ReactElement }> = {
    EM_ELABORACAO: {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: 'Em Elaboração',
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    EM_REVISAO: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'Em Revisão',
      icon: <Clock className="w-3 h-3" />,
    },
    APROVADO: {
      bg: 'bg-emerald-100',
      text: 'text-emerald-800',
      label: 'Aprovado',
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    REJEITADO: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Rejeitado',
      icon: <XCircle className="w-3 h-3" />,
    },
    OBSOLETO: {
      bg: 'bg-slate-200',
      text: 'text-slate-500',
      label: 'Obsoleto',
      icon: <Tag className="w-3 h-3" />,
    },
  };

  const cfg = config[status] ?? {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    label: status,
    icon: <AlertCircle className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 ${cfg.bg} ${cfg.text} text-xs rounded-md font-medium`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Actor Badge (ÉPICO 10) — diferencia Time interno do Cliente
// ─────────────────────────────────────────────────────────────────────────────

interface ActorBadgeProps {
  isClient: boolean;
}

function ActorBadge({ isClient }: ActorBadgeProps) {
  if (isClient) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-bold rounded-full border border-orange-300 uppercase tracking-wide">
        Cliente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full border border-blue-300 uppercase tracking-wide">
      Time
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Transmittal Reference List
// ─────────────────────────────────────────────────────────────────────────────

interface TransmittalReferenceListProps {
  transmittalItems: RevisionDetail['transmittalItems'];
}

function TransmittalReferenceList({ transmittalItems }: TransmittalReferenceListProps) {
  if (transmittalItems.length === 0) {
    return (
      <p className="text-xs text-gray-400 italic">Nenhuma GRD associada a esta revisão.</p>
    );
  }

  return (
    <div className="space-y-2">
      {transmittalItems.map((item: TransmittalItemDetail) => {
        const t = item.transmittal;
        const statusConfig: Record<string, { bg: string; text: string; icon: ReactElement }> = {
          EM_PROCESSAMENTO: {
            bg: 'bg-yellow-100',
            text: 'text-yellow-800',
            icon: <Clock className="w-3 h-3" />,
          },
          CONCLUIDO: {
            bg: 'bg-emerald-100',
            text: 'text-emerald-800',
            icon: <CheckCircle className="w-3 h-3" />,
          },
          ERRO: {
            bg: 'bg-red-100',
            text: 'text-red-800',
            icon: <AlertTriangle className="w-3 h-3" />,
          },
        };
        const cfg = (statusConfig[t.status] ?? statusConfig['ERRO'])!;

        return (
          <div key={t.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4 text-indigo-600" />
              <div>
                <span className="font-bold text-xs text-gray-800">{t.codigo}</span>
                <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{t.assunto}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Enviada por {t.createdBy.nome} em {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 ${cfg.bg} ${cfg.text} text-xs rounded font-medium`}>
              {cfg.icon}
              {t.status.replace('_', ' ')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Approval History Entry (PATCH 10.2)
// Um carimbo (Verificação → Aprovação → Análise do Cliente) renderizado como
// entrada cronológica da Linha do Tempo. O histórico NUNCA é sobrescrito.
// ─────────────────────────────────────────────────────────────────────────────

interface ApprovalHistoryEntryProps {
  approval: ApprovalWorkflowDetail;
  canAct: boolean;
  showDecisionForm: boolean;
  actionError: string | null;
  actionStatus: Exclude<ApprovalStatus, 'PENDENTE'> | null;
  actionComments: string;
  actionFile: File | null;
  isSubmitting: boolean;
  onSelectStatus: (status: Exclude<ApprovalStatus, 'PENDENTE'>) => void;
  onCancel: () => void;
  onCommentsChange: (value: string) => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

function ApprovalHistoryEntry({
  approval,
  canAct,
  showDecisionForm,
  actionError,
  actionStatus,
  actionComments,
  actionFile,
  isSubmitting,
  onSelectStatus,
  onCancel,
  onCommentsChange,
  onFileChange,
  onSubmit,
}: ApprovalHistoryEntryProps) {
  const isPending = approval.status === 'PENDENTE';

  return (
    <div className="p-3 border border-gray-200 rounded-lg bg-white">
      {/* Cabeçalho do Carimbo */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <StageBadge stage={approval.stage} />
        {approval.status === 'APROVADO' && (
          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" /> Aprovado
          </span>
        )}
        {approval.status === 'APROVADO_COM_COMENTARIOS' && (
          <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
            <MessageSquare className="w-3.5 h-3.5" /> Aprovado com Comentários
          </span>
        )}
        {approval.status === 'REPROVADO' && (
          <span className="inline-flex items-center gap-1 text-red-700 text-xs font-medium">
            <XCircle className="w-3.5 h-3.5" /> Reprovado
          </span>
        )}
        {isPending && (
          <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" /> Pendente
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-gray-500 font-medium">Solicitante:</span>
          <span className="text-gray-800 ml-1">{approval.requester?.nome || 'Sistema'}</span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Aprovador:</span>
          <span className="text-gray-800 ml-1 inline-flex items-center gap-1.5">
            {approval.reviewer?.nome || 'Aguardando análise'}
            {approval.reviewer && <ActorBadge isClient={approval.isClient} />}
          </span>
        </div>
        <div>
          <span className="text-gray-500 font-medium">Data Solicitação:</span>
          <span className="text-gray-800 ml-1">
            {new Date(approval.requestedAt).toLocaleDateString('pt-BR')}
          </span>
        </div>
        {approval.reviewedAt && (
          <div>
            <span className="text-gray-500 font-medium">Data Análise:</span>
            <span className="text-gray-800 ml-1">
              {new Date(approval.reviewedAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        )}
        {approval.comments && (
          <div className="col-span-2">
            <span className="text-gray-500 font-medium flex items-center gap-1.5">
              {approval.status === 'REPROVADO' ? 'Justificativa:' : 'Comentários:'}
              <ActorBadge isClient={approval.isClient} />
            </span>
            <p
              className={`
                text-gray-800 mt-1 p-2 rounded border text-xs whitespace-pre-wrap
                ${
                  approval.isClient
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }
              `}
            >
              {approval.comments}
            </p>
          </div>
        )}

        {/* PATCH 10.2: Arquivo Comentado anexado na análise */}
        {approval.commentedFileUrl && (
          <div className="col-span-2">
            <span className="text-gray-500 font-medium flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              Arquivo Comentado
            </span>
            <a
              href={approval.commentedFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-md text-xs font-medium transition-colors"
              title="Baixar arquivo comentado"
            >
              <Paperclip className="w-3.5 h-3.5" />
              Baixar Arquivo Comentado
            </a>
          </div>
        )}
      </div>

      {/* PATCH 10.2: Painel de Decisão (só quando o carimbo está PENDENTE e o
          usuário tem permissão para agir naquele estágio) */}
      {isPending && canAct && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {actionError && (
            <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 text-xs">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {!showDecisionForm ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onSelectStatus('APROVADO')}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Aprovar
              </button>
              <button
                onClick={() => onSelectStatus('APROVADO_COM_COMENTARIOS')}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Aprovar com Comentários
              </button>
              <button
                onClick={() => onSelectStatus('REPROVADO')}
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Reprovar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  {actionStatus === 'REPROVADO'
                    ? 'Justificativa técnica (obrigatória)'
                    : 'Comentário técnico (obrigatório)'}
                </label>
                <textarea
                  value={actionComments}
                  onChange={(e) => onCommentsChange(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="Registre o retorno técnico desta análise..."
                  className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* PATCH 10.2: Anexo do PDF Comentado (apenas c/ comentários ou reprovação) */}
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">
                  Arquivo comentado (PDF) <span className="text-gray-400">— opcional</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.PDF"
                  onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
                {actionFile && (
                  <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {actionFile.name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onSubmit}
                  disabled={isSubmitting || (actionStatus !== 'APROVADO' && !actionComments.trim())}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
                >
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  Confirmar {actionStatus === 'REPROVADO' ? 'Reprovação' : 'Aprovação'}
                </button>
                <button
                  onClick={onCancel}
                  disabled={isSubmitting}
                  className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Revision Card
// ─────────────────────────────────────────────────────────────────────────────

interface RevisionCardProps {
  revision: RevisionDetail;
  isLatest: boolean;
  canUpload: boolean;
  canDecideAtStage: (stage?: ApprovalStage | null) => boolean;
  codigoDocumento: string;
  onPreview: (revision: RevisionDetail) => void;
  onUploadSuccess: () => void;
  onApproved: () => void;
}

function RevisionCard({ revision, isLatest, canUpload, canDecideAtStage, codigoDocumento, onPreview, onUploadSuccess, onApproved }: RevisionCardProps) {
  const [isRevModalOpen, setIsRevModalOpen] = useState(false);
  // PATCH 10.3: Modal da Correção Interna (retrabalho sem gerar R+1)
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [actionFor, setActionFor] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<Exclude<ApprovalStatus, 'PENDENTE'> | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [actionFile, setActionFile] = useState<File | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const workflows = revision.approvalWorkflows ?? [];
  const pendingApproval = workflows.find((w) => w.status === 'PENDENTE') ?? null;

  // Etapa 2.6 — RBAC por estágio da Máquina de Estados de Engenharia:
  //   VERIFICACAO → ENGENHEIRO/GESTOR/COORDENADOR
  //   APROVACAO   → GESTOR/COORDENADOR (Coordenação)
  //   CLIENTE     → apenas o ator externo (isClient)
  const canActOnPending = !!pendingApproval && canDecideAtStage(pendingApproval.stage);

  const resetAction = () => {
    setActionFor(null);
    setActionStatus(null);
    setActionComments('');
    setActionFile(null);
    setActionError(null);
  };

  const handleSelectStatus = (status: Exclude<ApprovalStatus, 'PENDENTE'>) => {
    if (!pendingApproval) return;

    // Aprovação limpa — ação imediata, sem formulário de comentários/anexo
    if (status === 'APROVADO') {
      void runApprovalAction(pendingApproval.id, 'APROVADO');
      return;
    }

    setActionFor(pendingApproval.id);
    setActionStatus(status);
    setActionError(null);
  };

  const runApprovalAction = async (
    approvalId: number,
    status: Exclude<ApprovalStatus, 'PENDENTE'>,
    comments?: string,
    file?: File | null
  ) => {
    try {
      setIsActionSubmitting(true);
      setActionError(null);
      await documentService.approveRevision(approvalId, status, comments, file ?? undefined);
      resetAction();
      onApproved();
    } catch (error: unknown) {
      const message =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Erro ao processar a ação de aprovação.';
      setActionError(message || 'Erro ao processar a ação de aprovação.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  const handleSubmitAction = async () => {
    if (!pendingApproval) return;
    if (actionStatus !== 'APROVADO' && !actionComments.trim()) {
      setActionError(
        actionStatus === 'REPROVADO'
          ? 'Justificativa técnica é obrigatória ao reprovar.'
          : 'O comentário é obrigatório ao aprovar com comentários.'
      );
      return;
    }
    await runApprovalAction(
      pendingApproval.id,
      actionStatus ?? 'APROVADO',
      actionComments.trim() || undefined,
      actionFile ?? undefined
    );
  };

  // PATCH 10.3: Botão dinâmico do rodapé conforme o estágio da Máquina de Estados.
  const footerMode = getRevisionFooterMode(revision);
  const isNewRevisionUnlocked = footerMode === 'NEW_OFFICIAL_REVISION';
  const nextVersionLabel = getNextVersionLabel(revision.versionLabel);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
        {/* Header da Revisão */}
        <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between rounded-t-xl">
          <div className="flex items-center gap-3">
            <Tag className="w-5 h-5 text-indigo-600" />
            <span className="text-xl font-bold text-gray-900">{revision.versionLabel}</span>
            <RevisionStatusBadge status={revision.status} />
            {isLatest && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-medium">
                Revisão Atual
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {new Date(revision.createdAt).toLocaleDateString('pt-BR')} às{' '}
            {new Date(revision.createdAt).toLocaleTimeString('pt-BR')}
          </span>
        </div>

        {/* Body da Revisão */}
        <div className="p-4 space-y-4">
          {/* File Info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Hash do Arquivo
                </p>
                <p className="text-sm text-gray-700 font-mono break-all">
                  {revision.fileHash}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onPreview(revision)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Visualizar Arquivo"
              >
                <Eye className="w-4 h-4" />
              </button>
              <a
                href={revision.filePath}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                title="Baixar Arquivo Físico"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(revision.fileHash);
                }}
                className="p-2 text-gray-500 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Copiar Hash"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* PATCH 10.2: Histórico de Aprovações — Máquina de Estados.
              Todas as idas e vindas (Verificação → Aprovação → Cliente) são
              exibidas cronologicamente, cada carimbo como um registro novo. */}
          {workflows.length > 0 && (
            <div className="p-3 border border-gray-200 rounded-lg bg-white">
              <div className="flex items-center gap-2 mb-3">
                <Workflow className="w-4 h-4 text-purple-600" />
                <h4 className="font-semibold text-gray-800 text-sm">
                  Máquina de Estados — Histórico de Carimbos
                </h4>
              </div>

              <div className="space-y-3">
                {workflows.map((approval) => {
                  const isPendingTarget = pendingApproval?.id === approval.id;
                  return (
                    <ApprovalHistoryEntry
                      key={approval.id}
                      approval={approval}
                      canAct={isPendingTarget && canActOnPending}
                      showDecisionForm={
                        isPendingTarget &&
                        canActOnPending &&
                        actionFor === approval.id &&
                        actionStatus !== null
                      }
                      actionError={actionError}
                      actionStatus={actionStatus}
                      actionComments={actionComments}
                      actionFile={actionFile}
                      isSubmitting={isActionSubmitting}
                      onSelectStatus={handleSelectStatus}
                      onCancel={resetAction}
                      onCommentsChange={setActionComments}
                      onFileChange={setActionFile}
                      onSubmit={handleSubmitAction}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Guias de Remessa (GRD) — ÉPICO 10.1 */}
          {revision.transmittalItems.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Send className="w-4 h-4 text-indigo-600" />
                <h4 className="font-semibold text-gray-800 text-sm">
                  Guias de Remessa (GRD)
                </h4>
              </div>
              <TransmittalReferenceList transmittalItems={revision.transmittalItems} />
            </div>
          )}
        </div>

        {/* Footer: Ações da Revisão — PATCH 10.3 (botão dinâmico por estágio) */}
        {isLatest && canUpload && footerMode !== 'LOCKED' && (
          <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end rounded-b-xl">
            {footerMode === 'INTERNAL_REWORK' ? (
              /* CENÁRIO A — Retrabalho Interno: corrige DENTRO da mesma revisão */
              <button
                onClick={() => setIsCorrectionModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium rounded-lg transition-colors"
                title="Substitui o PDF da revisão atual e reinicia o ciclo interno de Verificação. Nenhuma nova revisão oficial é gerada."
              >
                <Repeat className="w-4 h-4" />
                Enviar Correção Interna (Manter {revision.versionLabel} atual)
              </button>
            ) : (
              /* CENÁRIO B — Retorno do Cliente: gera a próxima revisão oficial */
              <button
                onClick={() => setIsRevModalOpen(true)}
                disabled={!isNewRevisionUnlocked}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
                title={
                  isNewRevisionUnlocked
                    ? `Cria a revisão oficial ${nextVersionLabel} do documento`
                    : 'Bloqueado: a nova revisão oficial só nasce após a conclusão da Análise do Cliente.'
                }
              >
                <UploadCloud className="w-4 h-4" />
                Subir Nova Revisão Oficial (Gerar {nextVersionLabel})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modal de Upload de Nova Revisão Oficial (CENÁRIO B — R+1 pós-Cliente) */}
      <RevisionUploadForm
        isOpen={isRevModalOpen}
        onClose={() => setIsRevModalOpen(false)}
        documentId={revision.documentId}
        codigoDocumento={codigoDocumento}
        onSuccess={onUploadSuccess}
      />

      {/* Modal de Correção Interna (CENÁRIO A — mantém a revisão atual) */}
      <InternalCorrectionForm
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        documentId={revision.documentId}
        revisionId={revision.id}
        versionLabel={revision.versionLabel}
        codigoDocumento={codigoDocumento}
        onSuccess={onUploadSuccess}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Metadata Card
// ─────────────────────────────────────────────────────────────────────────────

interface MetadataCardProps {
  document: DocumentDetail;
}

function MetadataCard({ document }: MetadataCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
        <FileText className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-800">Ficha do Documento</h2>
      </div>

      {/* Código e Título */}
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
          Código do Documento
        </span>
        <p className="text-2xl font-bold text-gray-900 font-mono">
          {document.codigoDocumento}
        </p>
      </div>

      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
          Título
        </span>
        <p className="text-lg text-gray-800">{document.titulo}</p>
      </div>

      {/* Disciplina */}
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
          Disciplina
        </span>
        <span className="inline-block px-3 py-1 bg-slate-100 text-slate-700 text-sm rounded-md font-medium">
          {document.contractDiscipline?.nome ?? 'Não definida'}
        </span>
      </div>

      {/* Pacote de Trabalho */}
      <div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
          Pacote de Trabalho
        </span>
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-sm rounded-md font-medium">
          {document.workPackage?.nome ?? 'Não vinculado'}
        </span>
      </div>

      {/* Metadados Dinâmicos */}
      {document.metadata && Object.keys(document.metadata).length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">
            Metadados Adicionais
          </span>
          <pre className="text-xs text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100 overflow-x-auto">
            {JSON.stringify(document.metadata, null, 2)}
          </pre>
        </div>
      )}

      {/* Informações de Auditoria */}
      <div className="pt-4 border-t border-gray-100 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Criado por:</span>
          <span className="text-gray-800 font-medium">{document.createdBy.nome}</span>
          {document.createdBy.email && (
            <span className="text-gray-400">({document.createdBy.email})</span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Data de Criação:</span>
          <span className="text-gray-800">
            {new Date(document.createdAt).toLocaleString('pt-BR')}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Hash className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Contrato:</span>
          <span className="text-gray-800 font-medium">{document.contract.nome}</span>
          <span className="text-gray-400">({document.contract.codigo})</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Building2 className="w-4 h-4 text-gray-400" />
          <span className="text-gray-500">Cliente:</span>
          <span className="text-gray-800">{document.contract.client.nome}</span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: DocumentDetail
// ─────────────────────────────────────────────────────────────────────────────

export function DocumentDetail() {
  const { id, documentId: routeDocumentId } = useParams<{ id?: string; documentId?: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewer modal state
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [selectedFileUrl, setSelectedFileUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

// Épico 10: Modal do Fluxograma Visual
  const [isFlowOpen, setIsFlowOpen] = useState(false);

  // Etapa 2.6: Permissões RBAC do usuário logado no contrato ativo.
  const { canUploadRevision, canDecideAtStage } = usePermissions();

  const rawId = routeDocumentId ?? id;
  const documentId = Number(rawId);
  // Etapa 2.6: apenas GESTOR/COORDENADOR sobem revisões ou corrigem internamente.
  const canUpload = canUploadRevision;

  // ÉPICO 9: Estado dos Apontamentos de Horas deste documento
  const timesheet = useTimesheet(documentId);

  const fetchDocument = async () => {
    if (!rawId || isNaN(documentId)) {
      setError('ID do documento inválido.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await documentService.getById(documentId);
      setDocument(data);
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Erro ao carregar os detalhes do documento.';
      setError(errorMessage || 'Erro ao carregar os detalhes do documento.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [rawId]);

  // ÉPICO 9: Carrega o histórico de horas assim que o documento é aberto
  useEffect(() => {
    timesheet.fetchTimeLogs();
  }, [timesheet.fetchTimeLogs]);

  const handlePreview = (revision: RevisionDetail) => {
    setSelectedFileUrl(revision.filePath);
    setSelectedFileName(`${document?.codigoDocumento} - ${revision.versionLabel}`);
    setIsViewerOpen(true);
  };

  const handleBack = () => {
    if (document?.contract) {
      navigate(`/contracts/${document.contract.id}/documents`);
    } else {
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2 h-96 bg-gray-200 rounded-xl"></div>
            <div className="lg:col-span-3 space-y-4">
              <div className="h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-32 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Erro ao Carregar Documento</h2>
          <p className="text-gray-500 mb-4">{error || 'Documento não encontrado.'}</p>
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mx-auto"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const latestRevision = document.revisions[document.revisions.length - 1];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={handleBack}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Voltar para Documentos"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <FileText className="w-6 h-6 text-blue-600" />
              Detalhamento do Documento
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {document.codigoDocumento} — {document.titulo}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsFlowOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-lg font-medium transition-colors"
            title="Visualizar a Máquina de Estados do fluxo de aprovação"
          >
            <Workflow className="w-4 h-4" />
            Visualizar Fluxo
          </button>
          {latestRevision && (
            <a
              href={latestRevision.filePath}
              target="_blank"
              rel="noopener noreferrer"
              download
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
              title="Baixar arquivo da revisão atual"
            >
              <Download className="w-4 h-4" />
              Baixar {latestRevision.versionLabel}
            </a>
          )}
        </div>
      </div>

      {/* Main Content: Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Metadata */}
        <div className="lg:col-span-2">
          <MetadataCard document={document} />
        </div>

        {/* Right Column: Revision Timeline */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-indigo-600" />
            <h2 className="text-xl font-bold text-gray-800">Linha do Tempo de Revisões</h2>
            <span className="text-sm text-gray-500">
              {document.revisions.length} revisão(ões)
            </span>
          </div>

          {document.revisions.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-700">Documento Esqueleto</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Este documento foi cadastrado apenas com os metadados. O arquivo técnico ainda não foi anexado — suba a primeira revisão (R0) quando o físico estiver disponível.
              </p>
            </div>
          ) : (
          <div className="space-y-0">
            {document.revisions.map((revision: RevisionDetail, index: number) => (
              <RevisionCard
                key={revision.id}
                revision={revision}
                isLatest={index === document.revisions.length - 1}
                canUpload={canUpload}
                canDecideAtStage={canDecideAtStage}
                codigoDocumento={document.codigoDocumento}
                onPreview={handlePreview}
                onUploadSuccess={fetchDocument}
                onApproved={fetchDocument}
              />
            ))}
          </div>
          )}
        </div>
      </div>

      {/* ÉPICO 9: Apontamento de Horas (Timesheet) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-gray-100">
          <Hourglass className="w-5 h-5 text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Apontamento de Horas</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-blue-600" />
              Lançar Horas
            </h3>
            <TimesheetForm
              onSubmit={timesheet.createTimeLog}
              onSuccess={timesheet.fetchTimeLogs}
              isSubmitting={timesheet.isSubmitting}
              error={timesheet.error}
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Histórico de Horas
            </h3>
            <TimesheetList
              timeLogs={timesheet.timeLogs}
              isLoading={timesheet.isLoading}
              onDelete={timesheet.deleteTimeLog}
            />
          </div>
        </div>
      </div>

      {/* PATCH 10.2: Fluxograma Visual Interativo (Máquina de Estados) */}
      <WorkflowFlowchart
        isOpen={isFlowOpen}
        onClose={() => setIsFlowOpen(false)}
        currentStage={getWorkflowStageIndex(latestRevision)}
        codigoDocumento={document.codigoDocumento}
        versionLabel={latestRevision?.versionLabel}
        isEmitted={!!latestRevision && latestRevision.transmittalItems.length > 0}
      />

      {/* Document Viewer Modal (reutiliza componente existente) */}
      <DocumentViewer
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        fileUrl={selectedFileUrl}
        fileName={selectedFileName}
      />
    </div>
  );
}