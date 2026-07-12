import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { getPendingApprovals, handleApprovalAction } from './approval.controller';

const router = Router();

// Blindamos todas as rotas do Workflow de Aprovação com JWT
router.use(verifyToken);

// GET /approvals?contractId=X
router.get('/', getPendingApprovals);

// POST /approvals/:id/approve
router.post('/:id/approve', handleApprovalAction);

// POST /approvals/:id/reject
router.post('/:id/reject', handleApprovalAction);

export default router;