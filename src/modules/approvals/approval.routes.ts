import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { upload } from '../../middlewares/upload';
import { getPendingApprovals, handleApprovalAction } from './approval.controller';

const router = Router();

// Blindamos todas as rotas do Workflow de Aprovação com JWT
router.use(verifyToken);

// GET /approvals?contractId=X
router.get('/', getPendingApprovals);

// ÉPICO 10 / PATCH 10.2: Motor de Aprovação Estrito — ação única que exige um dos
// status exatos do fluxo. Agora aceita multipart/form-data para anexo do PDF comentado.
// POST /approvals/:id/action  { status: 'APROVADO' | 'APROVADO_COM_COMENTARIOS' | 'REPROVADO', comments?, commentedFile? }
router.post('/:id/action', upload.single('commentedFile'), handleApprovalAction);

export default router;