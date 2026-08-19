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
} from 'lucide-react';
import type { RevisionDetail } from '../types/document.types';

// ─────────────────────────────────────────────────────────────────────────────
// Fluxograma Horizontal do Fluxo de Aprovação (ÉPICO 10)
//
// Etapas: Elaboração ➔ Verificação ➔ Revisão Verificação ➔ Aprovação ➔ Revisão Aprovação
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
  { key: 'aprovacao', label: 'Aprovação', icon: <ShieldCheck className="w-5 h-5" /> },
  { key: 'revisao_aprovacao', label: 'Revisão Aprovação', icon: <BadgeCheck className="w-5 h-5" /> },
];

/**
 * Calcula a etapa atual do fluxograma a partir do estado da revisão mais recente.
 *
 * Mapeamento pragmático do modelo de dados atual (uma única ApprovalWorkflow por revisão):
 * - EM_ELABORACAO            → Elaboração (0)
 * - EM_REVISAO + PENDENTE    → Verificação (1)
 * - EM_REVISAO + processada  → Revisão Verificação (2)
 * - REJEITADO                → Aprovação (3) — devolvido para reprocesso
 * - APROVADO                 → Revisão Aprovação (4) — finalizado
 */
export function getWorkflowStageIndex(revision: RevisionDetail | undefined): number {
  if (!revision) return 0;

  switch (revision.status) {
    case 'EM_ELABORACAO':
      return 0;
    case 'EM_REVISAO': {
      const workflow = revision.approvalWorkflow;
      if (!workflow || workflow.status === 'PENDENTE') return 1;
      if (workflow.status === 'REPROVADO') return 1;
      return 2;
    }
    case 'REJEITADO':
      return 3;
    case 'APROVADO':
      return 4;
    default:
      return 0;
  }
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
}

export function WorkflowFlowchart({
  isOpen,
  onClose,
  currentStage,
  codigoDocumento,
  versionLabel,
}: WorkflowFlowchartProps) {
  if (!isOpen) return null;

  const clampedStage = Math.max(0, Math.min(FLOW_STAGES.length - 1, currentStage));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-indigo-600" />
              Fluxograma do Fluxo de Aprovação
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
            <div className="flex items-center min-w-[760px]">
              {FLOW_STAGES.map((stage, index) => {
                const isCompleted = index < clampedStage;
                const isCurrent = index === clampedStage;

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
          </div>
        </div>
      </div>
    </div>
  );
}