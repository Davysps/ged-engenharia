import { Prisma } from '@prisma/client';
import { prisma } from '../../prisma';
import type { ContractRole } from '@prisma/client';
import type { DocumentListQueryInput } from './document.schemas';

/**
 * Service responsável pela lógica de consulta de documentos.
 *
 * Segue o princípio do DDD: isola as queries complexas e a verificação de RBAC
 * do controller, mantendo-o fino e testável.
 *
 * ISOLAMENTO MULTI-TENANT (CRÍTICO):
 * Toda consulta é filtrada obrigatoriamente pelo `contractId` (tenant), que é
 * previamente validado contra a `ContractMembership` do usuário autenticado.
 * Clientes diferentes nunca enxergam dados uns dos outros.
 */

export class DocumentService {
  /**
   * Lista os documentos de um contrato (tenant) com Busca Avançada.
   *
   * @param contractId - ID do contrato (tenant) proveniente da rota
   * @param userId     - ID do usuário autenticado (extraído do JWT)
   * @param filters    - Filtros de busca avançada: busca, disciplinaId, pacoteId
   * @returns Documentos com revisões, disciplina do contrato e pacote de trabalho
   * @throws Error com código 'ACCESS_DENIED' se o usuário não for membro do contrato
   */
  static async listDocuments(
    contractId: number,
    userId: number,
    filters: DocumentListQueryInput
  ) {
    // ── 1. VERIFICAÇÃO DE RBAC / ISOLAMENTO MULTI-TENANT ──────────────
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

    // ── 2. MONTA O `where` DO PRISMA COM OS FILTROS DE BUSCA AVANÇADA ─
    const where: Record<string, unknown> = { contractId };

    if (filters.disciplinaId) {
      where.contractDisciplineId = filters.disciplinaId;
    }

    if (filters.pacoteId) {
      where.workPackageId = filters.pacoteId;
    }

    if (filters.busca) {
      where.OR = [
        { codigoDocumento: { contains: filters.busca, mode: 'insensitive' } },
        { titulo: { contains: filters.busca, mode: 'insensitive' } },
      ];
    }

    const documents = await prisma.document.findMany({
      where: where as Prisma.DocumentWhereInput,
      orderBy: { createdAt: 'desc' },
      include: {
        revisions: {
          orderBy: { createdAt: 'asc' }, // Garante que a R0, R1 venham na ordem certa
        },
        contractDiscipline: true,
        workPackage: true,
      },
    });

    return documents;
  }

  /**
   * Busca um documento pelo ID com todos os dados aninhados necessários para a
   * tela de detalhamento (Épico 8).
   *
   * @param documentId - ID do documento no banco
   * @param userId     - ID do usuário autenticado (extraído do JWT)
   * @returns Documento completo com revisões, workflows de aprovação, transmittals
   *          e a role do usuário no contrato, ou null se não existir ou o usuário
   *          não tiver acesso.
   */
  static async findDocumentById(documentId: number, userId: number) {
    const document = await prisma.document.findUnique({
      where: {
        id: documentId,
        // Filtragem multi-tenant: apenas membros do contrato veem o documento
        contract: {
          memberships: {
            some: { userId: userId },
          },
        },
      },
      include: {
        contract: {
          include: {
            client: true,
          },
        },
        createdBy: {
          select: { nome: true, email: true },
        },
        contractDiscipline: true,
        workPackage: true,
        revisions: {
          orderBy: { createdAt: 'asc' },
          include: {
            // PATCH 10.2: Histórico completo de carimbos (Verificação → Aprovação → Cliente)
            approvalWorkflows: {
              orderBy: { requestedAt: 'asc' },
              include: {
                requester: { select: { nome: true } },
                reviewer: { select: { nome: true } },
              },
            },
            transmittalItems: {
              include: {
                transmittal: {
                  include: {
                    createdBy: { select: { nome: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!document) {
      return null;
    }

    // Busca a role específica do usuário neste contrato para RBAC no frontend
    const membership = await prisma.contractMembership.findUnique({
      where: {
        userId_contractId: {
          userId: userId,
          contractId: document.contractId,
        },
      },
      select: { role: true },
    });

    return {
      ...document,
      userRole: (membership?.role ?? null) as ContractRole | null,
    };
  }
}
