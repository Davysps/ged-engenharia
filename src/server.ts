import express from 'express';
import dotenv from 'dotenv';
import projectRoutes from './modules/projects/project.routes';
import documentRoutes from './modules/documents/document.routes'; // <-- NOVO

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/projects', projectRoutes);
app.use('/documents', documentRoutes); // <-- NOVO

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[GED Engenharia] Servidor a correr na porta ${PORT}`);
});