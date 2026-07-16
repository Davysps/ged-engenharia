import axios from 'axios';

export const api = axios.create({
  // RESTAURADO: Voltámos à sua porta nativa. O prefixo '/api' foi erradicado.
  baseURL: 'http://localhost:3000', 
});

// INTERCEPTOR DE REQUISIÇÃO: Injeta o Token limpo (sem aspas fantasmas)
api.interceptors.request.use(
  (config) => {
    let token = localStorage.getItem('@GED:token');
    
    if (token) {
      // Saneamento de segurança: remove aspas que o localStorage possa adicionar acidentalmente
      token = token.replace(/['"]+/g, '');
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// INTERCEPTOR DE RESPOSTA: Gestão de Sessão Inteligente
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Identifica se a requisição que falhou era a tentativa de login
    const isAuthRoute = error.config?.url?.includes('/login') || error.config?.url?.includes('/auth');

    // Apenas força o logout e o redirecionamento se o 401 ocorrer FORA do ecrã de Login
    if (error.response?.status === 401 && !isAuthRoute) {
      console.warn('[Axios] Sessão inválida ou expirada em rota protegida. Forçando logout...');
      localStorage.removeItem('@GED:token');
      localStorage.removeItem('@GED:user');
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);