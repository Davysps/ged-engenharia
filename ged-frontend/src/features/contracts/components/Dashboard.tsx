import { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { api } from '../../../lib/axios';
import { Building2, FolderKanban, LogOut } from 'lucide-react';
import { UploadForm } from '../../documents/components/UploadForm';

// Tipagem baseada no que o seu project.controller.ts retorna
interface Contract {
  id: number;
  codigo: string;
  nome: string;
  client: {
    nome: string;
  };
  memberships: {
    role: string;
  }[];
}

export function Dashboard() {
  const { user, logout } = useAuth();
  const [contratos, setContratos] = useState<Contract[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchContratos() {
      try {
        const response = await api.get('/projects');
        setContratos(response.data);
      } catch (error) {
        console.error('Erro ao buscar contratos:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchContratos();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      {/* Cabeçalho */}
      <header className="max-w-6xl mx-auto flex justify-between items-center mb-10 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
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

      {/* Grid de Contratos */}
      <main className="max-w-6xl mx-auto">
        {isLoading ? (
          <p className="text-gray-500 animate-pulse">Carregando seus contratos...</p>
        ) : contratos.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <FolderKanban className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Nenhum contrato encontrado</h3>
            <p className="text-gray-500">Você não possui permissão de acesso a nenhuma obra no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {contratos.map((contrato) => (
              <div key={contrato.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition cursor-pointer">
                <div className="flex justify-between items-start mb-4">
                  <span className="inline-block px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md">
                    {contrato.codigo}
                  </span>
                  <span className="text-xs font-mono px-2 py-1 bg-gray-100 text-gray-600 rounded">
                    Role: {contrato.memberships[0]?.role}
                  </span>
                </div>
                
                <h2 className="text-xl font-bold text-gray-800 mb-1">{contrato.nome}</h2>
                <p className="text-gray-500 text-sm mb-6">Cliente: <span className="font-medium text-gray-700">{contrato.client.nome}</span></p>
                
                <button className="w-full py-2 bg-gray-50 hover:bg-blue-50 text-blue-600 font-medium rounded-lg border border-gray-200 hover:border-blue-200 transition">
                  Acessar Documentos
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-12">
          <UploadForm />
        </div>
      </main>
    </div>
  );
}