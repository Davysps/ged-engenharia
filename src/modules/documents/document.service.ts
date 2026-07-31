import { prisma } from '../../prisma';
import type { ContractRole } from '@prisma/client';

/**
 * Service responsável pela lógica de consulta de detalhamento de documentos.
 *
 * Segue o princípio do DDD: isola a query complexa e a verificação de RBAC
 * do controller, mantendo-o fino e testável.
 *
 * A query usa um filtro aninhado em `contract.memberships` para garantir
 * o isolamento multi-tenant: se o usuário não for membro do contrato ao qual
 * o documento pertence, a query retorna null (sem vazar existência do documento).
 */

export class DocumentService {
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
        revisions: {
          orderBy: { createdAt: 'asc' },
          include: {
            approvalWorkflow: {
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
