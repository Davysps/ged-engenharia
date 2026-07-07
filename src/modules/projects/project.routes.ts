import { Router } from 'express';
import { getProjects } from './project.controller';
import { verifyToken } from '../../middlewares/auth.middleware'; // <-- NOVO

const router = Router();

// A rota agora exige o token para listar os contratos do usuário
router.get('/', verifyToken, getProjects);

export default router;