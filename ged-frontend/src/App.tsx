import type { ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginForm } from './features/auth/components/LoginForm';
import { Dashboard } from './features/contracts/components/Dashboard';

// 1. Nosso "Guarda de Trânsito": Protege rotas que exigem login
function PrivateRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  // Se não estiver autenticado, chuta o usuário de volta pro login
  return isAuthenticated ? children : <Navigate to="/login" />;
}

// 2. Configuração das Rotas
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route 
        path="/login" 
        element={
          // Se já estiver logado e tentar acessar /login, manda pro dashboard
          isAuthenticated ? <Navigate to="/dashboard" /> : (
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
      
      {/* Rota de fallback: Qualquer URL não mapeada cai aqui */}
      <Route path="*" element={<Navigate to="/dashboard" />} />
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