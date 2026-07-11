import React from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import { ContractProvider, useContract } from '../../../contexts/ContractContext';

// 1. Componente interno que consome o contexto e constrói a UI
const ContractLayoutInner: React.FC = () => {
  const { contract, role, isLoading, error } = useContract();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Fallback de segurança caso a API negue acesso (HTTP 403) ou contrato não exista (HTTP 404)
  if (error || !contract) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-white p-8 rounded shadow-md border-l-4 border-red-500">
          <h2 className="text-xl font-bold text-gray-800">Acesso Negado ou Indisponível</h2>
          <p className="text-gray-600 mt-2">{error || 'Contrato não encontrado'}</p>
          <Link to="/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            &larr; Voltar ao Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar de Contexto do Contrato */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800 truncate" title={contract.name}>
            {contract.name}
          </h2>
          <span className="inline-block mt-2 px-2.5 py-1 text-xs font-bold tracking-wide bg-blue-100 text-blue-800 rounded uppercase">
            {role}
          </span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <Link
            to={`/contracts/${contract.id}`}
            className={`block px-4 py-2.5 rounded-md transition-colors ${
              location.pathname === `/contracts/${contract.id}` 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Visão Geral
          </Link>
          
          <Link
            to={`/contracts/${contract.id}/documents`}
            className={`block px-4 py-2.5 rounded-md transition-colors ${
              location.pathname.includes('/documents') 
                ? 'bg-blue-50 text-blue-700 font-medium' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Documentos e Revisões
          </Link>

          {/* Aplicação prática de RBAC na renderização da UI baseada no Tailwind */}
          {['GESTOR', 'APROVADOR'].includes(role || '') && (
            <Link
              to={`/contracts/${contract.id}/approvals`}
              className={`block px-4 py-2.5 rounded-md transition-colors ${
                location.pathname.includes('/approvals') 
                  ? 'bg-blue-50 text-blue-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              Painel de Aprovações
            </Link>
          )}
        </nav>
      </aside>

      {/* Viewport de Conteúdo (onde as páginas filhas serão injetadas) */}
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
};

// 2. Componente Root exportado que captura o ID da rota via React Router DOM
export const ContractLayout: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();

  if (!contractId) {
    return <div className="p-4 text-red-500 font-bold">Erro de Roteamento: contractId indefinido.</div>;
  }

  return (
    <ContractProvider contractId={contractId}>
      <ContractLayoutInner />
    </ContractProvider>
  );
};