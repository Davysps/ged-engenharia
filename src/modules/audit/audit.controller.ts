import type { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { AuditService } from './audit.service';
import { z } from 'zod';

const listAuditLogsQuerySchema = z.object({
  contractId: z.string().min(1, 'contractId é obrigatório.'),
  entity: z.string().optional(),
  action: z.string().optional(),
  entityId: z.string().optional(),
});

export const listAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const parsed = listAuditLogsQuerySchema.parse(req.query);
    const contractId = Number(parsed.contractId);

    if (isNaN(contractId)) {
      res.status(400).json({ error: 'contractId inválido.' });
      return;
    }

    const filters: { entity?: string; action?: string; entityId?: number } = {};
    if (parsed.entity) filters.entity = parsed.entity;
    if (parsed.action) filters.action = parsed.action;
    if (parsed.entityId) {
      const eid = Number(parsed.entityId);
      if (!isNaN(eid)) filters.entityId = eid;
    }

    const logs = await AuditService.listByContract(contractId, userId, filters);

    res.status(200).json(logs);
  } catch (error: any) {
    if (error?.name === 'ZodError') {
      res.status(400).json({ error: error.issues?.map((i: any) => i.message).join('; ') || 'Query params inválidos.' });
      return;
    }
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: error.message });
      return;
    }
    console.error('[AuditController] Erro ao listar logs de auditoria:', error);
    res.status(500).json({ error: 'Erro interno ao listar logs de auditoria.' });
  }
};
