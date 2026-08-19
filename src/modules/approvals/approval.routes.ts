import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { getPendingApprovals, handleApprovalAction } from './approval.controller';

const router = Router();

// Blindamos todas as rotas do Workflow de Aprovação com JWT
router.use(verifyToken);

// GET /approvals?contractId=X
router.get('/', getPendingApprovals);

// ÉPICO 10: Motor de Aprovação Estrito — ação única que exige um dos status exatos
// POST /approvals/:id/action  { status: 'APROVADO' | 'APROVADO_COM_COMENTARIOS' | 'REPROVADO', comments? }
router.post('/:id/action', handleApprovalAction);

export default router;