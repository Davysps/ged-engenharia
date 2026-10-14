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
import auditRoutes from './modules/audit/audit.routes';

dotenv.config();

const app = express();

const developmentOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const configuredOrigins = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins ?? (
  process.env.NODE_ENV === 'production' ? [] : developmentOrigins
));

for (const origin of allowedOrigins) {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error(`CORS_ORIGINS contém uma origem inválida: ${origin}`);
  }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
    throw new Error(`CORS_ORIGINS deve conter origens HTTP(S) sem caminhos: ${origin}`);
  }
}

app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  optionsSuccessStatus: 204,
  maxAge: 600,
}));
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

// Épico 12: Trilha de Auditoria (Data Room & Audit Logs)
app.use('/audit-logs', auditRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`[GED Engenharia] Servidor a correr na porta ${PORT}`);
});
