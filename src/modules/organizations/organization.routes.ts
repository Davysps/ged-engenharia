import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import {
  listUserOrganizations,
  createOrganization,
} from './organization.controller';

const router = Router();

router.use(verifyToken);

router.get('/', listUserOrganizations);
router.post('/', createOrganization);

export default router;
