import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { getDashboard } from './dashboard.controller';

const router = Router();

// Todas as rotas do Dashboard são protegidas por JWT
router.use(verifyToken);

// GET /dashboard?contractId=X
// Retorna KPIs consolidados, status de revisões, fila de trabalho e histórico recente
router.get('/', getDashboard);

export default router;
