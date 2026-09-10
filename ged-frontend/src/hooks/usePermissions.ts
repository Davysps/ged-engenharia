import { useAuth } from '../contexts/AuthContext';
import { useContract } from '../contexts/ContractContext';
import type { ApprovalStage } from '../types/prisma-types';

/**
 * Hook de Permissões (RBAC) — Etapa 2.6
 *
 * Consome o usuário autenticado + o papel dele no contrato ativo e expõe
 * funções auxiliares para restringir a interface de forma condicional.
 *
 * Papeis reais de engenharia:
 *   GESTOR        → acesso total (cria, aprova e gerencia)
 *   COORDENADOR   → acesso total (cria, aprova e gerencia)
 *   ENGENHEIRO    → não cria documentos; vizualiza, aponta horas e decide
 *                   tecnicamente (Verificação) nos documentos atribuídos
 *   PLANEJADOR    → foco em Planejamento e Pacotes de Trabalho; não aprova
 *                   documento técnico
 *   LEITOR        → somente visualiza / baixa
 */
export function usePermissions() {
  const { user } = useAuth();
  const { role, contract } = useContract();

  const isClient = user?.isClient ?? false;

  // ── Documentos ───────────────────────────────────────────────────────────
  const canCreateDocument = role === 'GESTOR' || role === 'COORDENADOR';
  const canUploadRevision = canCreateDocument;

  // ENGENHEIRO decide tecnicamente (Verificação); GESTOR/COORDENADOR decidem tudo.
  const canApproveDocument =
    role === 'GESTOR' || role === 'COORDENADOR' || role === 'ENGENHEIRO';

  // ── GRD / Transmittals ──────────────────────────────────────────────────
  const canEmitTransmittal = role === 'GESTOR' || role === 'COORDENADOR';

  // ── Planejamento e Gestão ────────────────────────────────────────────────
  const canManagePlanning =
    role === 'GESTOR' || role === 'COORDENADOR' || role === 'PLANEJADOR';
  const canManageUsers = role === 'GESTOR';
  const canManageWorkPackages = role === 'GESTOR' || role === 'COORDENADOR';

  // ── Aprovações ───────────────────────────────────────────────────────────
  const canViewApprovals = canApproveDocument;

  /**
   * Decisão por estágio da Máquina de Estados de Engenharia:
   *   VERIFICACAO → Time interno (ENGENHEIRO/GESTOR/COORDENADOR)
   *   APROVACAO   → Coordenação (GESTOR/COORDENADOR apenas)
   *   CLIENTE     → Atores externos (isClient) apenas
   */
  const canDecideAtStage = (stage?: ApprovalStage | null): boolean => {
    if (isClient) return stage === 'CLIENTE';
    if (stage === 'CLIENTE') return false;
    if (stage === 'APROVACAO') return role === 'GESTOR' || role === 'COORDENADOR';
    return canApproveDocument; // VERIFICACAO
  };

  return {
    role,
    contract,
    isClient,
    canCreateDocument,
    canUploadRevision,
    canApproveDocument,
    canEmitTransmittal,
    canManagePlanning,
    canManageUsers,
    canManageWorkPackages,
    canViewApprovals,
    canDecideAtStage,
  };
}