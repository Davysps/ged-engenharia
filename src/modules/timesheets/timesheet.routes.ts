import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import {
  listTimeLogs,
  createTimeLog,
  deleteTimeLog,
} from './timesheet.controller';

const router = Router();

// Todas as rotas do Timesheet são protegidas por JWT
router.use(verifyToken);

// ── Épico 9: Apontamento de Horas (Timesheet) ──
// O userId é sempre extraído do token JWT autenticado (nunca do body).

// GET    /timesheets?documentId=X        — Lista horas de um documento (qualquer membro)
// POST   /timesheets                     — Cria apontamento (userId do JWT)
// DELETE /timesheets/:timeLogId          — Remove apontamento (apenas o autor)
router.get('/', listTimeLogs);
router.post('/', createTimeLog);
router.delete('/:timeLogId', deleteTimeLog);

export default router;