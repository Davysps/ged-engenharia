import { prisma } from '../../prisma';
import { ApprovalStatus, RevisionStatus } from '@prisma/client';

/**
 * Service responsável pela lógica de consulta do Dashboard Geral de
 * Indicadores Operacionais.
 *
 * Segue o princípio do DDD: isola todas as queries complexas do controller,
 * mantendo-o fino e testável.
 *
 * ISOLAMENTO MULTI-TENANT (CRÍTICO):
 * Todo e qualquer acesso ao Prisma é filtrado obrigatoriamente pelo
 * `contractId` (tenantId), que é previamente validado contra a
 * `ContractMembership` do usuário autenticado. Clientes diferentes
 * nunca enxergam dados uns dos outros.
 */
export class DashboardService {
  /**
   * Busca todos os indicadores operacionais de um contrato (tenant).
   *
   * @param contractId - ID do contrato (tenant) extraído da query string
   * @param userId     - ID do usuário autenticado (extraído do JWT)
   * @returns Objeto consolidado com KPIs, status, fila de trabalho e histórico
   * @throws Error com código 'ACCESS_DENIED' se o usuário não for membro do contrato
   */
  static async getDashboardData(contractId: number, userId: number) {
    // ── 1. VERIFICAÇÃO DE RBAC / ISOLAMENTO MULTI-TENANT ──────────────
    // Garante que o usuário autenticado é membro do contrato solicitado.
    // Se não for, nenhuma query de dados é executada — o acesso é negado.
    const membership = await prisma.contractMembership.findUnique({
      where: {
        userId_contractId: { userId, contractId },
      },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    // ── 2. KPIs CONSOLIDADOS: Total de documentos agrupados por disciplina ─
    const documentsByDisciplineRaw = await prisma.document.groupBy({
      by: ['disciplina'],
      where: { contractId },
      _count: { _all: true },
    });

    const documentsByDiscipline = documentsByDisciplineRaw.map((item) => ({
      disciplina: item.disciplina,
      count: item._count._all,
    }));

    // ── 3. STATUS DAS REVISÕES: Contagem de documentos agrupados por status ─
    // Um documento é considerado "ativo" pela sua revisão mais recente.
    // Buscamos todos os documentos do contrato com sua última revisão e
    // agregamos os contadores por status em memória.
    const documentsWithLatestRevision = await prisma.document.findMany({
      where: { contractId },
      select: {
        id: true,
        revisions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true },
        },
      },
    });

    const revisionStatusCounts: Record<string, number> = {};

    for (const doc of documentsWithLatestRevision) {
      const latestRevision = doc.revisions[0];
      const status = latestRevision?.status ?? RevisionStatus.EM_ELABORACAO;
      revisionStatusCounts[status] = (revisionStatusCounts[status] ?? 0) + 1;
    }

    // ── 4. FILA DE TRABALHO: Top 5 Pendências de Aprovação mais recentes ─
    const pendingApprovalsRaw = await prisma.approvalWorkflow.findMany({
      where: {
        status: ApprovalStatus.PENDENTE,
        revision: {
          document: { contractId },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        requestedAt: true,
        requester: { select: { nome: true } },
        revision: {
          select: {
            id: true,
            versionLabel: true,
            document: {
              select: {
                id: true,
                codigoDocumento: true,
                titulo: true,
                disciplina: true,
              },
            },
          },
        },
      },
    });

    const pendingApprovals = pendingApprovalsRaw.map((p) => ({
      id: p.id,
      codigoDocumento: p.revision.document.codigoDocumento,
      titulo: p.revision.document.titulo,
      disciplina: p.revision.document.disciplina,
      versionLabel: p.revision.versionLabel,
      solicitante: p.requester?.nome ?? 'Sistema',
      dataSolicitacao: p.requestedAt.toISOString(),
    }));

    // ── 5. HISTÓRICO RECENTE: 5 últimos Transmittals emitidos ──────────
    const recentTransmittalsRaw = await prisma.transmittal.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        codigo: true,
        assunto: true,
        status: true,
        createdAt: true,
        createdBy: { select: { nome: true } },
        _count: { select: { items: true } },
      },
    });

    const recentTransmittals = recentTransmittalsRaw.map((t) => ({
      id: t.id,
      codigo: t.codigo,
      assunto: t.assunto,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      createdByNome: t.createdBy?.nome ?? 'Sistema',
      itemCount: t._count.items,
    }));

    return {
      contractId,
      userRole: membership.role,
      documentsByDiscipline,
      revisionStatusCounts,
      pendingApprovals,
      recentTransmittals,
    };
  }
}
