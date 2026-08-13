import { Response } from 'express';
import type { AuthRequest } from '../../middlewares/auth.middleware';
import { ManagementService } from './management.service';
import {
  contractIdQuerySchema,
  createDisciplineSchema,
  updateDisciplineSchema,
  disciplineIdParamSchema,
  inviteUserSchema,
} from './management.schemas';

/**
 * Controller do Épico 6: Gestão de Usuários e Disciplinas.
 * Mantém-se fino: valida autenticação, valida payloads com Zod e delega para o service.
 */

export const listDisciplines = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = contractIdQuerySchema.parse(req.query);
    const disciplines = await ManagementService.listDisciplines(contractId, userId);
    res.status(200).json(disciplines);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: você não tem permissão para este contrato.' });
      return;
    }
    console.error('[ManagementController] Erro em listDisciplines:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao listar disciplinas.' });
  }
};

export const createDiscipline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = contractIdQuerySchema.parse(req.query);
    const data = createDisciplineSchema.parse(req.body);

    const discipline = await ManagementService.createDiscipline(contractId, userId, data);
    res.status(201).json(discipline);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem criar disciplinas.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Dados inválidos.', issues: error.issues });
      return;
    }
    console.error('[ManagementController] Erro em createDiscipline:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao criar disciplina.' });
  }
};

export const updateDiscipline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = contractIdQuerySchema.parse(req.query);
    const { disciplineId } = disciplineIdParamSchema.parse(req.params);
    const data = updateDisciplineSchema.parse(req.body);

    const discipline = await ManagementService.updateDiscipline(contractId, userId, disciplineId, data);
    res.status(200).json(discipline);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem atualizar disciplinas.' });
      return;
    }
    if (error?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Disciplina não encontrada neste contrato.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Dados inválidos.', issues: error.issues });
      return;
    }
    console.error('[ManagementController] Erro em updateDiscipline:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao atualizar disciplina.' });
  }
};

export const deleteDiscipline = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = contractIdQuerySchema.parse(req.query);
    const { disciplineId } = disciplineIdParamSchema.parse(req.params);

    const discipline = await ManagementService.deleteDiscipline(contractId, userId, disciplineId);
    res.status(200).json(discipline);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem remover disciplinas.' });
      return;
    }
    if (error?.code === 'NOT_FOUND') {
      res.status(404).json({ error: 'Disciplina não encontrada neste contrato.' });
      return;
    }
    console.error('[ManagementController] Erro em deleteDiscipline:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao remover disciplina.' });
  }
};

export const listUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = contractIdQuerySchema.parse(req.query);
    const users = await ManagementService.listUsers(contractId, userId);
    res.status(200).json(users);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: você não tem permissão para este contrato.' });
      return;
    }
    console.error('[ManagementController] Erro em listUsers:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao listar usuários.' });
  }
};

export const inviteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({ error: 'Usuário não autenticado.' });
      return;
    }

    const { contractId } = contractIdQuerySchema.parse(req.query);
    const data = inviteUserSchema.parse(req.body);

    const user = await ManagementService.inviteUser(contractId, userId, data);
    res.status(201).json(user);
  } catch (error: any) {
    if (error?.code === 'ACCESS_DENIED') {
      res.status(403).json({ error: 'Acesso negado: apenas gestores podem convidar usuários.' });
      return;
    }
    if (error?.code === 'CONFLICT') {
      res.status(409).json({ error: 'Este usuário já é membro deste contrato.' });
      return;
    }
    if (error?.issues) {
      res.status(400).json({ error: 'Dados inválidos.', issues: error.issues });
      return;
    }
    console.error('[ManagementController] Erro em inviteUser:', error?.message || error);
    res.status(500).json({ error: 'Erro interno ao convidar usuário.' });
  }
};

