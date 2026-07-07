import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../lib/axios';

// Tipagens baseadas no retorno do seu auth.controller.ts
interface User {
  id: number;
  nome: string;
  email: string;
  role: string;
}

interface AuthContextData {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Ao iniciar a aplicação, verifica se já existe um usuário salvo
    const storedUser = localStorage.getItem('@GED:user');
    const storedToken = localStorage.getItem('@GED:token');

    if (storedUser && storedToken) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const login = async (email: string, senha: string) => {
    // Bate na rota que você construiu no auth.routes.ts
    const response = await api.post('/auth/login', { email, senha });
    
    const { token, user } = response.data;

    // Salva no navegador para persistência
    localStorage.setItem('@GED:token', token);
    localStorage.setItem('@GED:user', JSON.stringify(user));

    setUser(user);
  };

  const logout = () => {
    localStorage.removeItem('@GED:token');
    localStorage.removeItem('@GED:user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook customizado para facilitar o uso nos componentes
export function useAuth() {
  return useContext(AuthContext);
}