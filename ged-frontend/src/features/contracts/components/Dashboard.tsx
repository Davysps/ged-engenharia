import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/axios';
import { Building2, FolderKanban, FolderOpen, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';

// ── Estrutura da Árvore Hierárquica (ÉPICO 9): Cliente > Projeto > Contrato ──

interface ContractNode {
  id: number;
  codigo: string;
  nome: string;
  descricao: string | null;
  role: string | null;
}

interface ProjectNode {
  id: number | null;
  nome: string;
  contracts: ContractNode[];
}

interface ClientNode {
  id: number;
  nome: string;
  cnpj: string | null;
  projects: ProjectNode[];
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const [clientes, setClientes] = useState<ClientNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchHierarquia() {
      try {
        // GET /projects agora devolve a árvore completa do usuário logado:
        // Clientes > Projetos > Contratos (isolamento multi-tenant no backend)
        const response = await api.get<ClientNode[]>('/projects');
        setClientes(response.data);
      } catch (error) {
        console.error('Erro ao buscar a hierarquia de contratos:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchHierarquia();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Cabeçalho */}
      <header className="max-w-7xl mx-auto flex justify-between items-center mb-10 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-blue-600 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Meus Contratos</h1>
            <p className="text-gray-500 text-sm">Bem-vindo(a), {user?.nome}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg transition"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </header>

      {/* Árvore Hierárquica: Cliente > Projeto > Contrato */}
      <main className="max-w-7xl mx-auto">
        {isLoading ? (
          <p className="text-gray-500 animate-pulse">Carregando sua estrutura de contratos...</p>
        ) : clientes.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum contrato encontrado</h3>
            <p className="text-gray-500">Você não possui permissão de acesso a nenhuma obra no momento.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {clientes.map((cliente) => (
              <div
                key={cliente.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                {/* Cabeçalho do Cliente */}
                <div className="p-6 bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 shrink-0" />
                    <h2 className="text-xl font-bold">{cliente.nome}</h2>
                  </div>
                  {cliente.cnpj && (
                    <p className="text-blue-100 text-sm mt-1 ml-9">CNPJ: {cliente.cnpj}</p>
                  )}
                </div>

                {/* Projetos do Cliente */}
                <div className="p-6 space-y-7">
                  {cliente.projects.map((project) => (
                    <div key={project.id ?? 'sem-projeto'}>
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        <FolderOpen className="w-4 h-4 text-indigo-600" />
                        {project.nome}
                        <span className="text-gray-400 normal-case tracking-normal">
                          ({project.contracts.length} contrato{project.contracts.length !== 1 ? 's' : ''})
                        </span>
                      </h3>

                      {/* Contratos do Projeto */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {project.contracts.map((contrato) => (
                          <div
                            key={contrato.id}
                            className="bg-slate-50 rounded-xl p-5 shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer flex flex-col"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md">
                                {contrato.codigo}
                              </span>
                              <span className="text-xs font-mono px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Role: {contrato.role}
                              </span>
                            </div>

                            <h4 className="text-lg font-bold text-gray-800 mb-1">{contrato.nome}</h4>
                            {contrato.descricao && (
                              <p className="text-gray-500 text-sm mb-5 flex-1 line-clamp-2">
                                {contrato.descricao}
                              </p>
                            )}

                            <Link
                              to={`/contracts/${contrato.id}`}
                              className="block text-center w-full py-2 bg-white hover:bg-blue-50 text-blue-600 font-medium rounded-lg border border-gray-200 hover:border-blue-200 transition"
                            >
                              Acessar Documentos
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}