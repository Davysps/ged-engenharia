import React from 'react';
import { useParams, Outlet, Link, useLocation } from 'react-router-dom';
import { ContractProvider, useContract } from '../../../contexts/ContractContext';
import {
  LayoutDashboard,
  FolderOpen,
  Send,
  CalendarRange,
  Settings2,
  ClipboardCheck,
  ArrowLeft,
  HardHat,
  Cloud,
} from 'lucide-react';

// 1. Componente interno que consome o contexto e constrói a UI (Top Navigation Bar)
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

  // ÉPICO 8: Navegação horizontal do Menu Superior (Topbar)
  const basePath = `/contracts/${contract.id}`;

  const navItems = [
    {
      to: basePath,
      label: 'Dashboard',
      icon: LayoutDashboard,
      active: location.pathname === basePath,
    },
    {
      to: `${basePath}/documents`,
      label: 'Documentos',
      icon: FolderOpen,
      active: location.pathname.includes('/documents'),
    },
    {
      to: `${basePath}/approvals`,
      label: 'Aprovações',
      icon: ClipboardCheck,
      active: location.pathname.includes('/approvals'),
      visible: ['GESTOR', 'APROVADOR'].includes(role || ''),
    },
    {
      to: `${basePath}/transmittals`,
      label: 'Transmittals',
      icon: Send,
      active: location.pathname.includes('/transmittals'),
    },
    {
      to: `${basePath}/planning`,
      label: 'Planejamento',
      icon: CalendarRange,
      active: location.pathname.includes('/planning'),
    },
    {
      to: `${basePath}/management`,
      label: 'Gestão',
      icon: Settings2,
      active: location.pathname.includes('/management'),
      visible: role === 'GESTOR',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* ── Top Navigation Bar (ÉPICO 8) ─────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4 h-16">
            {/* Identidade da Marca (ÉPICO 8: Refinamento Visual) */}
            <div className="flex items-center gap-3 shrink-0 pr-4 border-r border-gray-200 mr-4">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white shadow-md shadow-blue-200 shrink-0">
                <Cloud className="w-5.5 h-5.5" />
              </span>
              <div className="leading-tight">
                <span className="block text-base font-extrabold tracking-tight text-gray-900">
                  GED <span className="text-blue-600">Engenharia</span>
                </span>
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  Plataforma SaaS B2B
                </span>
              </div>
            </div>

            {/* Identidade do Contrato */}
            <div className="flex items-center gap-3 min-w-0">
              <Link
                to="/dashboard"
                className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
                title="Voltar ao Dashboard"
              >
                <ArrowLeft className="w-4.5 h-4.5" />
              </Link>

              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm shrink-0">
                  <HardHat className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <h1 className="text-base font-bold text-gray-900 truncate leading-tight" title={contract.name}>
                    {contract.name}
                  </h1>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-bold tracking-wide bg-blue-100 text-blue-800 rounded uppercase">
                      {role}
                    </span>
                    <span className="hidden sm:inline text-xs text-gray-400">{contract.status}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Links de Navegação Horizontais */}
            <nav className="flex items-center gap-1 overflow-x-auto">
              {navItems
                .filter((item) => item.visible !== false)
                .map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                        item.active
                          ? 'bg-blue-50 text-blue-700 shadow-sm border border-blue-100'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.label}
                    </Link>
                  );
                })}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Área de Conteúdo (onde as páginas filhas são injetadas) ──── */}
      <main className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
