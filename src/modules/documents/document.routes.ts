import { Router } from 'express';
import { uploadDocument, uploadRevision, updateMetadataWebhook, getDocumentById } from './document.controller';
import { upload } from '../../middlewares/upload';
import { verifyToken } from '../../middlewares/auth.middleware';

const router = Router();

// ÉPICO 5: Webhook Recebedor Interno
// DEVE vir antes das rotas JWT para manter o isolamento de rede Microserviço-Microserviço
router.patch('/:id/metadata', updateMetadataWebhook);

// ÉPICO 8: Detalhamento de Documento (Single Source of Truth)
// Retorna metadados, histórico de revisões, status OCR e relação de Transmittals
router.get('/:id', verifyToken, getDocumentById);

// Endpoint que recebe os metadados do form e 1 ficheiro anexado no campo 'file' (Documento Novo R0)
router.post('/upload', verifyToken, upload.single('file'), uploadDocument);

// Endpoint para submeter uma nova revisão de um documento existente (R1, R2...)
// CORREÇÃO ÉPICO 2: Adicionado o verifyToken para proteger a rota!
router.post('/:id/revisions', verifyToken, upload.single('file'), uploadRevision);

export default router;