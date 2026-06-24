import { Router } from 'express';
import { uploadDocument } from './document.controller';
import { upload } from '../../middlewares/upload';

const router = Router();

// Endpoint que recebe os metadados do form e 1 ficheiro anexado no campo 'file'
router.post('/upload', upload.single('file'), uploadDocument);

export default router;