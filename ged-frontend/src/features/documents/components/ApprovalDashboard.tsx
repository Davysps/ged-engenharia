import { useEffect, useState } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { CheckCircle, XCircle, Clock, FileSignature } from 'lucide-react';

interface PendingApproval {
  id: number;
  codigoDocumento: string;
  revisao: string;
  disciplina: string;
  solicitante: string;
  dataSolicitacao: string;
}

export function ApprovalDashboard() {
  const { contract, role } = useContract();
  const [pendingDocs, setPendingDocs] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // RBAC de Segurança: Só Gestores e Aprovadores podem ver as ações
  const canApprove = role === 'GESTOR' || role === 'APROVADOR';

  useEffect(() => {
    // Mock temporário simulando a busca na API por documentos aguardando aprovação
    setTimeout(() => {
      setPendingDocs([
        {
          id: 1,
          codigoDocumento: 'VALE-MEC-DIA-010',
          revisao: 'R1',
          disciplina: 'MECÂNICA',
          solicitante: 'Carlos Engenheiro',
          dataSolicitacao: '2026-07-10T14:30:00Z'
        },
        {
          id: 2,
          codigoDocumento: 'VALE-CIV-PLA-001',
          revisao: 'R2',
          disciplina: 'CIVIL',
          solicitante: 'Ana Projetista',
          dataSolicitacao: '2026-07-11T09:15:00Z'
        }
      ]);
      setIsLoading(false);
    }, 600);
  }, [contract?.id]);

  const handleApprove = (id: number) => {
    // Aqui entrará a chamada POST para /approvals/:id/approve
    setPendingDocs(docs => docs.filter(doc => doc.id !== id));
  };

  const handleReject = (id: number) => {
    // Aqui entrará a chamada POST para /approvals/:id/reject
    setPendingDocs(docs => docs.filter(doc => doc.id !== id));
  };

  if (!canApprove) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-red-100">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">Seu perfil ({role}) não tem permissão para aprovar documentos nesta obra.</p>
      </div>
    );
  }

  if (isLoading) return <div className="p-6 text-gray-500 animate-pulse">Buscando pendências...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-indigo-600" />
            Painel de Aprovações
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Gestão de Workflow para a obra: <span className="font-medium text-gray-700">{contract?.name}</span>
          </p>
        </div>
        <div className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          {pendingDocs.length} Pendências
        </div>
      </div>

      <div className="p-6">
        {pendingDocs.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Tudo em dia!</h3>
            <p className="text-gray-500">Não há documentos aguardando a sua aprovação no momento.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingDocs.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors bg-white">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-gray-900 text-lg">{doc.codigoDocumento}</span>
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded uppercase">
                      {doc.revisao}
                    </span>
                    <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded">
                      {doc.disciplina}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    Enviado por <span className="font-medium text-gray-700">{doc.solicitante}</span> em {new Date(doc.dataSolicitacao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => handleReject(doc.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg font-medium transition-colors"
                  >
                    <XCircle className="w-4 h-4" />
                    Rejeitar
                  </button>
                  <button 
                    onClick={() => handleApprove(doc.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium transition-colors shadow-sm"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Aprovar Revisão
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}