import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import {
  listDisciplines,
  createDiscipline,
  updateDiscipline,
  deleteDiscipline,
  listUsers,
  inviteUser,
} from './management.controller';

const router = Router();

// Todas as rotas do Management são protegidas por JWT
router.use(verifyToken);

// ── Épico 6: Gestão de Disciplinas (CRUD) ─────────────────────────────
// Todas as rotas recebem o contractId como query param para isolamento multi-tenant.

// GET  /management/disciplines?contractId=X  — Lista todas as disciplinas
// POST /management/disciplines?contractId=X  — Cria uma nova disciplina (GESTOR)
router.get('/disciplines', listDisciplines);
router.post('/disciplines', createDiscipline);

// PATCH  /management/disciplines/:disciplineId?contractId=X — Atualiza (GESTOR)
// DELETE /management/disciplines/:disciplineId?contractId=X — Remove (GESTOR)
router.patch('/disciplines/:disciplineId', updateDiscipline);
router.delete('/disciplines/:disciplineId', deleteDiscipline);

// ── Épico 6: Gestão de Usuários (Listagem + Convite) ─────────────────

// GET  /management/users?contractId=X         — Lista todos os membros do contrato
// POST /management/users/invite?contractId=X   — Convida um novo usuário (GESTOR)
router.get('/users', listUsers);
router.post('/users/invite', inviteUser);

export default router;
