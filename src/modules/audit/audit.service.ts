import { prisma } from '../../prisma';
import type { Prisma } from '@prisma/client';

export interface AuditLogParams {
  userId: number;
  contractId: number;
  action: string;
  entity: string;
  entityId: number;
  details?: Record<string, unknown>;
  ipAddress?: string | null;
}

export class AuditService {
  /**
   * Regista um evento de auditoria de forma síncrona (fire-and-forget).
   * Chamado pelos controllers de Documentos, Aprovações e Transmittals
   * nas ações críticas que alteram o estado do sistema.
   *
   * ÉPICO 12: Trilha de Auditoria (Data Room & Audit Logs)
   */
  static async log(params: AuditLogParams): Promise<void> {
    try {
      const payload: Prisma.AuditLogCreateInput = {
        user: { connect: { id: params.userId } },
        contract: { connect: { id: params.contractId } },
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        ...(params.details != null && {
          details: JSON.parse(JSON.stringify(params.details)),
        }),
        ...(params.ipAddress != null && {
          ipAddress: params.ipAddress,
        }),
      };

      await prisma.auditLog.create({ data: payload });
    } catch (error) {
      // Log de auditoria NUNCA deve bloquear a operação principal.
      console.error('[AuditService] Falha ao registar evento de auditoria:', error);
    }
  }

  /**
   * Lista os logs de auditoria de um contrato (multi-tenant).
   * Acesso restrito a usuários com role GESTOR no ContractMembership.
   */
  static async listByContract(
    contractId: number,
    userId: number,
    filters?: {
      entity?: string;
      action?: string;
      entityId?: number;
    }
  ) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
    });

    if (!membership || membership.role !== 'GESTOR') {
      throw Object.assign(new Error('Acesso negado: apenas Gestores podem visualizar a Trilha de Auditoria.'), {
        code: 'ACCESS_DENIED',
      });
    }

    const where: Prisma.AuditLogWhereInput = { contractId };

    if (filters?.entity) {
      where.entity = filters.entity;
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.entityId) {
      where.entityId = filters.entityId;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    return logs;
  }
}
