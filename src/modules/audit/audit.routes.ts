import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { listAuditLogs } from './audit.controller';

const router = Router();

router.use(verifyToken);
router.get('/', listAuditLogs);

export default router;
