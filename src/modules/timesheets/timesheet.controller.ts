import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { TimesheetService } from './timesheet.service';
import {
  listTimeLogsQuerySchema,
  createTimeLogSchema,
  timeLogIdParamSchema,
} from './timesheet.schemas';

/**
 * Controller do Épico 9: Módulo de Apontamento de Horas (Timesheet).
 * Mantém-se fino: valida autenticação, valida payloads com Zod e delega para o service.
 *
 * ISOLAMENTO MULTI-TENANT:
 * O `userId` é sempre lido de `req.userId` (preenchido pelo middleware verifyToken).
 */

export const listTimeLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const query = listTimeLogsQuerySchema.parse(req.query);

    const timeLogs = await TimesheetService.listByDocument(query.documentId, userId);
    res.status(200).json(timeLogs);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: você não tem permissão para este documento.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Parâmetros inválidos.', issues: error.issues });
      return;
    }
    console.error('[TimesheetController] Erro em listTimeLogs:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao listar apontamentos de horas.' });
  }
};

export const createTimeLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    // REGRA NEGOCIAL: o userId vem do token JWT, nunca do body
    const data = createTimeLogSchema.parse(req.body);

    const timeLog = await TimesheetService.create(userId, data);
    res.status(201).json(timeLog);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: você não tem permissão para este documento.' });
      return;
    }
    if (error?.code === 'WORK_PACKAGE_NOT_FOUND') {
      res.status(404).json({ error: 'Pacote de trabalho não encontrado neste contrato.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Dados inválidos.', issues: error.issues });
      return;
    }
    console.error('[TimesheetController] Erro em createTimeLog:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao registrar o apontamento de horas.' });
  }
};

export const deleteTimeLog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { timeLogId } = timeLogIdParamSchema.parse(req.params);

    const timeLog = await TimesheetService.remove(timeLogId, userId);
    res.status(200).json(timeLog);
  } catch (error: any) {
    if (error?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Apontamento não encontrado ou sem permissão para excluí-lo.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Parâmetros inválidos.', issues: error.issues });
      return;
    }
    console.error('[TimesheetController] Erro em deleteTimeLog:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao excluir o apontamento de horas.' });
  }
};