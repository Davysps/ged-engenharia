import { prisma } from '../../prisma';
import type { CreateTimeLogInput } from './timesheet.schemas';

/**
 * Service do Épico 9: Módulo de Apontamento de Horas (Timesheet).
 *
 * ISOLAMENTO MULTI-TENANT (CRÍTICO):
 * Todo TimeLog é obrigatoriamente vinculado a um `Document`, que pertence a
 * um `Contract` (tenant). Antes de qualquer operação, valida-se que o usuário
 * autenticado é membro daquele contrato via `ContractMembership`. Usuários de
 * clientes diferentes nunca enxergam nem manipulam horas uns dos outros.
 *
 * REGRA NEGOCIAL:
 * - O `userId` do TimeLog é SEMPRE extraído do token JWT autenticado
 *   (via middleware `verifyToken`), nunca do payload do cliente.
 * - Listar: qualquer membro do contrato do documento.
 * - Criar: qualquer membro do contrato do documento (engenheiro/Gestor).
 * - Excluir: apenas o próprio autor do apontamento.
 */
export class TimesheetService {

  /**
   * Valida que o usuário tem acesso ao contrato do documento (tenant).
   * @throws Error com código 'ACCESS_DENIED' caso não seja membro.
   */
  private static async requireDocumentAccess(documentId: number, userId: number) {
    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        contract: {
          memberships: {
            some: { userId: userId },
          },
        },
      },
      select: { id: true, contractId: true },
    });

    if (!document) {
      const error = new Error('Acesso negado: usuário não é membro do contrato deste documento.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    return document;
  }

  /**
   * Lista os apontamentos de horas de um documento.
   * Acesso: qualquer membro do contrato do documento.
   */
  static async listByDocument(documentId: number, userId: number) {
    await TimesheetService.requireDocumentAccess(documentId, userId);

    return await prisma.timeLog.findMany({
      where: { documentId },
      orderBy: { data: 'desc' },
      include: {
        user: { select: { id: true, nome: true } },
      },
    });
  }

  /**
   * Cria um apontamento de horas para um documento.
   * O `userId` vem do token JWT (parâmetro `userId` da função), nunca do body.
   * Acesso: qualquer membro do contrato do documento.
   */
  static async create(userId: number, data: CreateTimeLogInput) {
    const document = await TimesheetService.requireDocumentAccess(data.documentId, userId);

    // Se um pacote de trabalho for informado, ele deve pertencer ao MESMO contrato
    if (data.workPackageId) {
      const workPackage = await prisma.workPackage.findFirst({
        where: {
          id: data.workPackageId,
          contractId: document.contractId,
        },
        select: { id: true },
      });

      if (!workPackage) {
        const error = new Error('Pacote de trabalho não encontrado neste contrato.');
        (error as any).code = 'WORK_PACKAGE_NOT_FOUND';
        throw error;
      }
    }

    return await prisma.timeLog.create({
      data: {
        userId,
        documentId: data.documentId,
        workPackageId: data.workPackageId ?? null,
        horas: data.horas,
        data: data.data,
        descricao: data.descricao,
      },
      include: {
        user: { select: { id: true, nome: true } },
      },
    });
  }

  /**
   * Remove um apontamento de horas.
   * Acesso: apenas o próprio autor do apontamento.
   */
  static async remove(timeLogId: number, userId: number) {
    const existing = await prisma.timeLog.findFirst({
      where: { id: timeLogId, userId },
      select: { id: true, userId: true },
    });

    if (!existing) {
      const error = new Error('Apontamento não encontrado ou sem permissão para excluí-lo.');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return await prisma.timeLog.delete({
      where: { id: timeLogId },
    });
  }
}