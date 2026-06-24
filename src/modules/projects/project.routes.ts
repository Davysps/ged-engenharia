import { Router } from 'express';
import { getProjects } from './project.controller';

const router = Router();

// GET /projects
router.get('/', getProjects);

export default router;