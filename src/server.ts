import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // <-- 1. Importe a biblioteca
import authRoutes from './modules/auth/auth.routes';
import projectRoutes from './modules/projects/project.routes';
import documentRoutes from './modules/documents/document.routes'; 

dotenv.config();

const app = express();

// <-- 2. Ative o CORS ANTES de qualquer rota ou middleware
app.use(cors()); 

app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/documents', documentRoutes); 

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[GED Engenharia] Servidor a correr na porta ${PORT}`);
});