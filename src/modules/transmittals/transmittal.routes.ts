import { Router } from 'express';
import { TransmittalController } from './transmittal.controller';
import { verifyToken } from '../../middlewares/auth.middleware';

const router = Router();
const transmittalController = new TransmittalController();

router.post('/contracts/:contractId/transmittals', verifyToken, transmittalController.create);
router.get('/contracts/:contractId/transmittals', verifyToken, transmittalController.list);

// Rota dedicada a alimentar a tabela de GRDs no Frontend
router.get('/contracts/:contractId/transmittals/approved-revisions', verifyToken, transmittalController.getApprovedRevisions);

router.patch('/webhooks/transmittals/:transmittalId/complete', transmittalController.webhookComplete);

export { router as transmittalRoutes };