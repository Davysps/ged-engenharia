import { Router } from 'express';
import { uploadDocument, uploadRevision } from './document.controller';
import { upload } from '../../middlewares/upload';
import { verifyToken } from '../../middlewares/auth.middleware';

const router = Router();

// Endpoint que recebe os metadados do form e 1 ficheiro anexado no campo 'file' (Documento Novo)
router.post('/upload', verifyToken, upload.single('file'), uploadDocument);

// Endpoint para submeter uma nova revisão de um documento existente
router.post('/:id/revisions', upload.single('file'), uploadRevision);

export default router;