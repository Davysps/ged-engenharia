import { Router } from 'express';
import {
  uploadDocument,
  uploadRevision,
  createPresignedUrl,
  internalUpdateRevision,
  updateMetadataWebhook,
  getDocumentById,
  exportMDR,
} from './document.controller';
import { upload } from '../../middlewares/upload';
import { requireInternalWebhookSecret } from '../../middlewares/internalWebhook.middleware';
import {
  requireContractMembership,
  requireContractOrDocumentMembership,
  requireDocumentMembership,
  requireDocumentWriteRole,
  verifyToken,
} from '../../middlewares/auth.middleware';

const router = Router();

// ÉPICO 5/13: Webhook Recebedor Interno (OCR Local / PyMuPDF)
// DEVE vir antes das rotas JWT para manter o isolamento de rede Microserviço-Microserviço
// O worker Python envia via POST; mantém-se o PATCH para retrocompatibilidade (Épico 5).
router.post('/:id/metadata', requireInternalWebhookSecret, updateMetadataWebhook);
router.patch('/:id/metadata', requireInternalWebhookSecret, updateMetadataWebhook);

// ÉPICO 11: Exportação de MDR (Master Document Register)
// DEVE vir ANTES de /:id para não conflitar com o parâmetro de rota
router.get('/export/mdr', verifyToken, requireContractMembership, exportMDR);

// ÉPICO 8: Detalhamento de Documento (Single Source of Truth)
// Retorna metadados, histórico de revisões, status OCR e relação de Transmittals
router.get('/:id', verifyToken, requireDocumentMembership, getDocumentById);

// Endpoint que recebe os metadados do form (JSON) e a fileKey do arquivo
// já enviado ao S3 (Documento Novo R0) — FASE 2: sem multipart/multer.
router.post('/upload', verifyToken, requireContractMembership, uploadDocument);

// FASE 2 (Nível Enterprise): S3 Pre-signed URL.
// O Frontend solicita a URL de upload informando nome e tipo do arquivo;
// o Backend devolve { uploadUrl, fileKey, filePath, fileHash }.
// Registrada antes das rotas paramétricas para não conflitar com /:id.
router.post(
  '/presigned-url',
  verifyToken,
  requireContractOrDocumentMembership,
  requireDocumentWriteRole,
  createPresignedUrl
);

// Endpoint para submeter uma nova revisão de um documento existente (R1, R2...)
// CORREÇÃO ÉPICO 2: Adicionado o verifyToken para proteger a rota!
router.post('/:id/revisions', verifyToken, requireDocumentMembership, requireDocumentWriteRole, uploadRevision);

// PATCH 10.3: Retrabalho Interno — substitui o PDF da MESMA revisão (sem criar R+1)
// e reinicia o ciclo interno de aprovações (novo carimbo VERIFICACAO PENDENTE).
router.post(
  '/:id/revisions/:revId/internal-update',
  verifyToken,
  requireDocumentMembership,
  upload.single('file'),
  internalUpdateRevision
);

export default router;
