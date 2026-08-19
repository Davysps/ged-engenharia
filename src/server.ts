import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; 
import authRoutes from './modules/auth/auth.routes';
import projectRoutes from './modules/projects/project.routes';
import documentRoutes from './modules/documents/document.routes'; 
import approvalRoutes from './modules/approvals/approval.routes';
import { transmittalRoutes } from './modules/transmittals/transmittal.routes';
import dashboardRoutes from './modules/dashboard/dashboard.routes';
import managementRoutes from './modules/management/management.routes';
import planningRoutes from './modules/planning/planning.routes';
import timesheetRoutes from './modules/timesheets/timesheet.routes';

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
app.use('/approvals', approvalRoutes);
app.use(transmittalRoutes);
app.use('/dashboard', dashboardRoutes);

// Épico 6: Gestão de Usuários e Disciplinas
app.use('/management', managementRoutes);

// Épico 7: Módulo de Planejamento e Coordenação (Pacotes de Trabalho)
app.use('/planning', planningRoutes);

// Épico 9: Módulo de Apontamento de Horas (Timesheet)
app.use('/timesheets', timesheetRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[GED Engenharia] Servidor a correr na porta ${PORT}`);
});
