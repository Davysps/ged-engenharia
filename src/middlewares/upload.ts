import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Garante que a pasta 'uploads' existe na raiz do projeto
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Adiciona um timestamp para evitar sobreposição de ficheiros com o mesmo nome
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'GED-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const upload = multer({ storage });