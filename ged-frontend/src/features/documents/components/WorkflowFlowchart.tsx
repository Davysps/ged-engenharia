import type { ReactElement } from 'react';
import {
  X,
  FilePen,
  FileSearch,
  Repeat,
  ShieldCheck,
  BadgeCheck,
  ArrowRight,
  Check,
  CircleDot,
  Send,
  Users,
} from 'lucide-react';
import type { RevisionDetail } from '../types/document.types';

// ─────────────────────────────────────────────────────────────────────────────
// Fluxograma Horizontal do Fluxo de Aprovação (ÉPICO 10 / PATCH 10.1 / 10.2)
//
// MÁQUINA DE ESTADOS DE ENGENHARIA (PATCH 10.2) — 7 Estágios:
// Elaboração ➔ Verificação ➔ Revisão Verificação ➔ Aprovação (Coordenação)
// ➔ Revisão Aprovação ➔ Emissão (GRD) ➔ Análise do Cliente
//
//  0 Elaboração           → R0/R1 nasce, ainda não submetida ao fluxo
//  1 Verificação          → Carimbo 1: Time Interno (Sênior/Pleno) analisa
//  2 Revisão Verificação  → Time reprovou/comentou → retorno ao autor
//  3 Aprovação (Coord.)   → Carimbo 2: Coordenação analisa
//  4 Revisão Aprovação    → Coordenação reprovou/comentou → retorno ao autor
//  5 Emissão (GRD)        → Coordenação aprovou limpo → documento trava p/ GRD
//  6 Análise do Cliente   → Pós-emissão: Cliente avalia (anexa PDF comentado)
// ─────────────────────────────────────────────────────────────────────────────

export interface FlowStage {
  key: string;
  label: string;
  icon: ReactElement;
}

export const FLOW_STAGES: FlowStage[] = [
  { key: 'elaboracao', label: 'Elaboração', icon: <FilePen className="w-5 h-5" /> },
  { key: 'verificacao', label: 'Verificação', icon: <FileSearch className="w-5 h-5" /> },
  { key: 'revisao_verificacao', label: 'Revisão Verificação', icon: <Repeat className="w-5 h-5" /> },
  { key: 'aprovacao', label: 'Aprovação (Coordenação)', icon: <ShieldCheck className="w-5 h-5" /> },
  { key: 'revisao_aprovacao', label: 'Revisão Aprovação', icon: <BadgeCheck className="w-5 h-5" /> },
  { key: 'emissao', label: 'Emissão (GRD)', icon: <Send className="w-5 h-5" /> },
  { key: 'analise_cliente', label: 'Análise do Cliente', icon: <Users className="w-5 h-5" /> },
];

/**
 * Calcula a etapa atual do fluxograma a partir do estado da revisão mais recente.
 *
 * Máquina de estados (PATCH 10.2) baseada no estágio (stage) do último carimbo:
 * - Etapa 0 (Elaboração)            → EM_ELABORACAO
 * - Etapa 1 (Verificação)           → carimbo VERIFICACAO PENDENTE
 * - Etapa 2 (Revisão Verificação)   → carimbo VERIFICACAO reprovou/comentou
 * - Etapa 3 (Aprovação Coordenação) → carimbo APROVACAO PENDENTE
 * - Etapa 4 (Revisão Aprovação)     → carimbo APROVACAO reprovou/comentou
 * - Etapa 5 (Emissão GRD)           → carimbo APROVACAO aprovado limpo
 * - Etapa 6 (Análise do Cliente)    → carimbo CLIENTE criado (pós-emissão)
 */
export function getWorkflowStageIndex(revision: RevisionDetail | undefined): number {
  if (!revision) return 0;

  const approvals = revision.approvalWorkflows ?? [];

  // Etapa 0 — Elaboração: revisão criada, ainda não submetida ao fluxo
  if (revision.status === 'EM_ELABORACAO') return 0;

  // Etapa 6 — Análise do Cliente: carimbo CLIENTE existe (pós-emissão via GRD)
  const hasClientAnalysis = approvals.some((a) => a.stage === 'CLIENTE');
  if (hasClientAnalysis) return 6;

  const latest = approvals.length > 0 ? approvals[approvals.length - 1] : undefined;

  if (latest) {
    // Etapas 1/2 — Verificação / Revisão Verificação
    if (latest.stage === 'VERIFICACAO') {
      if (latest.status === 'PENDENTE') return 1;
      if (latest.status === 'APROVADO_COM_COMENTARIOS' || latest.status === 'REPROVADO') return 2;
      // Verificação limpa → o próximo carimbo (APROVACAO) deve existir
    }

    // Etapas 3/4/5 — Aprovação Coordenação / Revisão Aprovação / Emissão
    if (latest.stage === 'APROVACAO') {
      if (latest.status === 'PENDENTE') return 3;
      if (latest.status === 'APROVADO_COM_COMENTARIOS' || latest.status === 'REPROVADO') return 4;
      if (latest.status === 'APROVADO') return 5; // documento travado p/ Emissão
    }
  }

  // Fallbacks para estados residuais do modelo de dados
  if (revision.status === 'APROVADO') return 5; // Emissão (aguardando GRD)
  if (revision.status === 'REJEITADO') return 2; // Retorno ao autor
  if (revision.status === 'EM_REVISAO') return 1; // Verificação
  if (revision.status === 'OBSOLETO') return 0;

  return 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente do Modal do Fluxograma
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowFlowchartProps {
  isOpen: boolean;
  onClose: () => void;
  currentStage: number;
  codigoDocumento?: string;
  versionLabel?: string;
  // ÉPICO 10.1: true quando o documento foi emitido via GRD — destrava a etapa
  // "Emissão" como concluída (e marca a "Análise do Cliente" como etapa atual).
  isEmitted?: boolean;
}

export function WorkflowFlowchart({
  isOpen,
  onClose,
  currentStage,
  codigoDocumento,
  versionLabel,
  isEmitted = false,
}: WorkflowFlowchartProps) {
  if (!isOpen) return null;

  const clampedStage = Math.max(0, Math.min(FLOW_STAGES.length - 1, currentStage));
  const isFullyEmitted = isEmitted && clampedStage === FLOW_STAGES.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-indigo-600" />
              Máquina de Estados — Fluxo de Aprovação
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {codigoDocumento && <span className="font-mono font-medium text-gray-700">{codigoDocumento}</span>}
              {versionLabel && <span className="ml-2 bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded uppercase">{versionLabel}</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Fechar Fluxograma"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body: Fluxograma Horizontal */}
        <div className="p-6">
          <div className="overflow-x-auto pb-2">
            <div className="flex items-center min-w-[880px]">
              {FLOW_STAGES.map((stage, index) => {
                const isCompleted =
                  index < clampedStage || (isFullyEmitted && index === clampedStage);
                const isCurrent = index === clampedStage && !isFullyEmitted;

                return (
                  <div key={stage.key} className="flex items-center flex-1 last:flex-none">
                    {/* Etapa */}
                    <div
                      className={`
                        flex-1 min-w-[120px] rounded-xl border-2 p-3 text-center transition-all
                        ${
                          isCurrent
                            ? 'bg-indigo-600 border-indigo-700 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-100 scale-105'
                            : isCompleted
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-white border-gray-200 text-gray-400'
                        }
                      `}
                    >
                      <div
                        className={`
                          mx-auto mb-2 w-10 h-10 rounded-full flex items-center justify-center
                          ${
                            isCurrent
                              ? 'bg-white/20'
                              : isCompleted
                                ? 'bg-emerald-100 text-emerald-600'
                                : 'bg-gray-100 text-gray-400'
                          }
                        `}
                      >
                        {isCompleted ? <Check className="w-5 h-5" /> : stage.icon}
                      </div>
                      <p className={`text-xs font-semibold leading-tight ${isCurrent ? 'text-white' : ''}`}>
                        {stage.label}
                      </p>
                      {isCurrent && (
                        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white text-indigo-700 px-2 py-0.5 rounded-full">
                          <CircleDot className="w-3 h-3 animate-pulse" />
                          Etapa Atual
                        </span>
                      )}
                    </div>

                    {/* Conector */}
                    {index < FLOW_STAGES.length - 1 && (
                      <div
                        className={`flex-none w-8 flex items-center justify-center ${
                          isCompleted ? 'text-emerald-400' : 'text-gray-300'
                        }`}
                      >
                        <ArrowRight className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex flex-wrap items-center gap-6 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              Concluída
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-indigo-600"></span>
              Etapa atual
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-gray-200"></span>
              Pendente
            </span>
            <span className="ml-auto text-gray-400">
              Dois carimbos internos (Verificação + Coordenação) antes da Emissão via GRD.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}