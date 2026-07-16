import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './features/auth/components/LoginForm';
import { Dashboard } from './features/contracts/components/Dashboard';
import { ContractLayout } from './features/contracts/components/ContractLayout';
import { DocumentList } from './features/documents/components/DocumentList';
import { ApprovalDashboard } from './features/documents/components/ApprovalDashboard';
import { TransmittalDashboard } from './features/transmittals/components/TransmittalDashboard';

// 1. Nosso "Guarda de Trânsito": Protege rotas que exigem login
function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  // CORREÇÃO: Utilização rigorosa do 'replace' para evitar loops de redirecionamento no histórico
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// 2. Configuração das Rotas
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          // CORREÇÃO: O componente Navigate agora usa 'replace' para prevenir a falha de "Maximum update depth"
          isAuthenticated ? <Navigate to="/dashboard" replace /> : (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
              <LoginForm />
            </div>
          )
        } 
      />
      
      <Route 
        path="/dashboard" 
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } 
      />
      
      {/* ROTA PAE (ÉPICO 2): Área Exclusiva do Contrato */}
      <Route 
        path="/contracts/:contractId" 
        element={
          <PrivateRoute>
            <ContractLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<div className="p-6 bg-white rounded-md shadow-sm text-gray-700">Visão Geral do Contrato (Em desenvolvimento)</div>} />
        
        {/* Rota renderizando a nossa nova tabela de documentos */}
        <Route path="documents" element={<DocumentList />} />
        
        <Route path="approvals" element={<ApprovalDashboard />} />
        
        {/* INJEÇÃO CIRÚRGICA - ÉPICO 4: Guias de Remessa */}
        <Route path="transmittals" element={<TransmittalDashboard />} />
      </Route>

      {/* Rota de fallback: Qualquer URL não mapeada cai aqui. CORREÇÃO: replace adicionado. */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// 3. O Componente App que exportamos
export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}