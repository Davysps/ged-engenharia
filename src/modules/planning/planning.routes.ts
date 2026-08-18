import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import {
  listWorkPackages,
  createWorkPackage,
  updateWorkPackage,
  deleteWorkPackage,
} from './planning.controller';

const router = Router();

// Todas as rotas do Planning são protegidas por JWT
router.use(verifyToken);

// ── Épico 7: Módulo de Planejamento e Coordenação (Pacotes de Trabalho) ──
// Todas as rotas recebem o contractId como query param para isolamento multi-tenant.

// GET   /planning?contractId=X                — Lista pacotes (qualquer membro)
// POST  /planning?contractId=X                — Cria pacote (GESTOR)
// PATCH /planning/:workPackageId?contractId=X — Atualiza pacote (GESTOR)
// DELETE /planning/:workPackageId?contractId=X — Remove pacote (GESTOR)
router.get('/', listWorkPackages);
router.post('/', createWorkPackage);
router.patch('/:workPackageId', updateWorkPackage);
router.delete('/:workPackageId', deleteWorkPackage);

export default router;
