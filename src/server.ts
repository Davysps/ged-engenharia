import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; 
import authRoutes from './modules/auth/auth.routes';
import projectRoutes from './modules/projects/project.routes';
import documentRoutes from './modules/documents/document.routes'; 
import approvalRoutes from './modules/approvals/approval.routes'; // <-- IMPORTAÇÃO DO NOVO MÓDULO

dotenv.config();

const app = express();

app.use(cors()); 
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/projects', projectRoutes);
app.use('/documents', documentRoutes); 
app.use('/approvals', approvalRoutes); // <-- REGISTRO DA ROTA (O Fim do Erro 404)

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[GED Engenharia] Servidor a correr na porta ${PORT}`);
});