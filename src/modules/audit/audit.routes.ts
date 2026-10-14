import { Router } from 'express';
import { requireContractMembership, verifyToken } from '../../middlewares/auth.middleware';
import { listAuditLogs } from './audit.controller';

const router = Router();

router.use(verifyToken);
router.use(requireContractMembership);
router.get('/', listAuditLogs);

export default router;
