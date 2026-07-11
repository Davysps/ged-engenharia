import { Router } from 'express';
import { getProjects, getProjectById, getProjectDocuments } from './project.controller';
import { verifyToken } from '../../middlewares/auth.middleware';

const router = Router();

router.get('/', verifyToken, getProjects);
router.get('/:id', verifyToken, getProjectById);

// NOVA ROTA: Lista os documentos reais de um contrato
router.get('/:id/documents', verifyToken, getProjectDocuments);

export default router;