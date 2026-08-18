import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { PlanningService } from './planning.service';
import type { WorkPackageStatus } from './planning.schemas';
import {
  listWorkPackagesQuerySchema,
  createWorkPackageSchema,
  updateWorkPackageSchema,
  workPackageIdParamSchema,
} from './planning.schemas';

/**
 * Controller do Épico 7: Módulo de Planejamento e Coordenação.
 * Mantém-se fino: valida autenticação, valida payloads com Zod e delega para o service.
 */

export const listWorkPackages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const query = listWorkPackagesQuerySchema.parse(req.query);
    const filters: { status?: WorkPackageStatus; busca?: string } = {};
    if (query.status !== undefined) filters.status = query.status;
    if (query.busca !== undefined && query.busca !== '') filters.busca = query.busca;

    const workPackages = await PlanningService.listWorkPackages(query.contractId, userId, filters);
    res.status(200).json(workPackages);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: você não tem permissão para este contrato.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Parâmetros inválidos.', issues: error.issues });
      return;
    }
    console.error('[PlanningController] Erro em listWorkPackages:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao listar pacotes de trabalho.' });
  }
};

export const createWorkPackage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = listWorkPackagesQuerySchema
      .pick({ contractId: true })
      .parse(req.query);
    const data = createWorkPackageSchema.parse(req.body);

    const workPackage = await PlanningService.createWorkPackage(contractId, userId, data);
    res.status(201).json(workPackage);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem criar pacotes de trabalho.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Dados inválidos.', issues: error.issues });
      return;
    }
    console.error('[PlanningController] Erro em createWorkPackage:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao criar pacote de trabalho.' });
  }
};

export const updateWorkPackage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = listWorkPackagesQuerySchema
      .pick({ contractId: true })
      .parse(req.query);
    const { workPackageId } = workPackageIdParamSchema.parse(req.params);
    const data = updateWorkPackageSchema.parse(req.body);

    const workPackage = await PlanningService.updateWorkPackage(contractId, userId, workPackageId, data);
    res.status(200).json(workPackage);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem atualizar pacotes de trabalho.' });
      return;
    }
    if (error?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Pacote de trabalho não encontrado neste contrato.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Dados inválidos.', issues: error.issues });
      return;
    }
    console.error('[PlanningController] Erro em updateWorkPackage:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao atualizar pacote de trabalho.' });
  }
};

export const deleteWorkPackage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = listWorkPackagesQuerySchema
      .pick({ contractId: true })
      .parse(req.query);
    const { workPackageId } = workPackageIdParamSchema.parse(req.params);

    const workPackage = await PlanningService.deleteWorkPackage(contractId, userId, workPackageId);
    res.status(200).json(workPackage);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem remover pacotes de trabalho.' });
      return;
    }
    if (error?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Pacote de trabalho não encontrado neste contrato.' });
      return;
    }
    console.error('[PlanningController] Erro em deleteWorkPackage:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao remover pacote de trabalho.' });
  }
};
