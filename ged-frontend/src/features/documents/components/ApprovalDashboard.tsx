import { useEffect, useState } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { api } from '../../../lib/axios'; // <-- Importação da nossa instância configurada do Axios
import { useAuth } from '../../../contexts/AuthContext';
import { documentService } from '../services/document.service';
import { CheckCircle, XCircle, Clock, FileSignature, AlertCircle, ChevronDown, MessageSquare, Loader2, Paperclip } from 'lucide-react';
import type { ApprovalStatus } from '../../../types/prisma-types';

interface PendingApproval {
  id: number;
  codigoDocumento: string;
  revisao: string;
  disciplina: string;
  solicitante: string;
  dataSolicitacao: string;
  // PATCH 10.2: Estágio do carimbo na Máquina de Estados
  stage: 'VERIFICACAO' | 'APROVACAO' | 'CLIENTE';
  stageLabel: string;
  isClient: boolean;
}

type ApprovalActionStatus = Exclude<ApprovalStatus, 'PENDENTE'>;

const STAGE_BADGE: Record<PendingApproval['stage'], { bg: string; text: string }> = {
  VERIFICACAO: { bg: 'bg-sky-100', text: 'text-sky-800' },
  APROVACAO: { bg: 'bg-violet-100', text: 'text-violet-800' },
  CLIENTE: { bg: 'bg-orange-100', text: 'text-orange-800' },
};

export function ApprovalDashboard() {
  const { contract, role } = useContract();
  const { user } = useAuth();
  const isClientUser = user?.isClient ?? false;
  const [pendingDocs, setPendingDocs] = useState<PendingApproval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // PATCH 10.2: Painel de decisão por pendência (comentários + anexo do PDF)
  const [openId, setOpenId] = useState<number | null>(null);
  const [actionStatus, setActionStatus] = useState<ApprovalActionStatus | null>(null);
  const [actionComments, setActionComments] = useState('');
  const [actionFile, setActionFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // RBAC de Segurança no Frontend
  const canApproveInternal = role === 'GESTOR' || role === 'APROVADOR';
  const canView = canApproveInternal || isClientUser;

  const canActOn = (doc: PendingApproval) => {
    if (doc.stage === 'CLIENTE') return isClientUser;
    return canApproveInternal && !isClientUser;
  };

  // Buscar pendências reais do backend assim que o contrato ativo mudar
  useEffect(() => {
    if (!contract?.id || !canView) return;

    async function fetchApprovals() {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        const response = await api.get<PendingApproval[]>('/approvals', {
          params: { contractId: contract?.id }
        });
        setPendingDocs(response.data);
      } catch (error: any) {
        console.error('Erro ao carregar o painel de aprovações:', error);
        setErrorMessage(error.response?.data?.error || 'Não foi possível carregar as pendências.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchApprovals();
  }, [contract?.id, role, isClientUser, canView]);

  const resetPanel = () => {
    setOpenId(null);
    setActionStatus(null);
    setActionComments('');
    setActionFile(null);
  };

  // PATCH 10.2: Ação única com envio multipart (comentários + arquivo comentado)
  const runAction = async (id: number, status: ApprovalActionStatus) => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await documentService.approveRevision(
        id,
        status,
        actionComments.trim() || undefined,
        actionFile ?? undefined
      );
      resetPanel();
      // Otimização de UI: Remove do estado local sem forçar um re-render completo do backend
      setPendingDocs(docs => docs.filter(doc => doc.id !== id));
    } catch (error: any) {
      setErrorMessage(error.response?.data?.error || 'Erro ao processar a ação de aprovação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Aprovação limpa — ação imediata, sem formulário de comentários/anexo
  const handleApproveClean = (id: number) => {
    void runAction(id, 'APROVADO');
  };

  if (!canView) {
    return (
      <div className="p-8 text-center bg-white rounded-xl shadow-sm border border-red-100">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-800">Acesso Restrito</h2>
        <p className="text-gray-500 mt-2">O seu perfil ({role}) não tem permissão para aprovar ou reprovar documentos nesta obra.</p>
      </div>
    );
  }

  if (isLoading) return <div className="p-6 text-gray-500 animate-pulse">A procurar pendências no acervo técnico...</div>;

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

      {errorMessage && (
        <div className="p-4 mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="p-6">
        {pendingDocs.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">Tudo em dia!</h3>
            <p className="text-gray-500">Não existem documentos a aguardar a sua revisão técnica neste momento.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {pendingDocs.map(doc => {
              const stageCfg = STAGE_BADGE[doc.stage] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
              const canAct = canActOn(doc);
              const isOpen = openId === doc.id;

              return (
                <div key={doc.id} className="p-4 border border-gray-200 rounded-lg hover:border-indigo-300 transition-colors bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-gray-900 text-lg">{doc.codigoDocumento}</span>
                        <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded uppercase">
                          {doc.revisao}
                        </span>
                        <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded">
                          {doc.disciplina}
                        </span>
                        {/* PATCH 10.2: Estágio do carimbo */}
                        <span className={`${stageCfg.bg} ${stageCfg.text} text-xs font-bold px-2 py-0.5 rounded uppercase`}>
                          {doc.stageLabel}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Enviado por <span className="font-medium text-gray-700">{doc.solicitante}</span> em {new Date(doc.dataSolicitacao).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    {canAct ? (
                      <button
                        onClick={() => {
                          setOpenId(isOpen ? null : doc.id);
                          setActionStatus(null);
                          setActionComments('');
                          setActionFile(null);
                          setErrorMessage(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium transition-colors shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Decidir Revisão
                        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 italic">Aguarde o responsável pelo estágio {doc.stageLabel}.</span>
                    )}
                  </div>

                  {/* PATCH 10.2: Painel de Decisão com comentários + anexo do PDF comentado */}
                  {isOpen && canAct && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {actionStatus === null ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleApproveClean(doc.id)}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Aprovar sem comentários
                          </button>
                          <button
                            onClick={() => setActionStatus('APROVADO_COM_COMENTARIOS')}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            Aprovar com comentários
                          </button>
                          <button
                            onClick={() => setActionStatus('REPROVADO')}
                            disabled={isSubmitting}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reprovar
                          </button>
                          <button
                            onClick={resetPanel}
                            disabled={isSubmitting}
                            className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">
                              {actionStatus === 'REPROVADO'
                                ? 'Justificativa técnica (obrigatória)'
                                : 'Comentário técnico (obrigatório)'}
                            </label>
                            <textarea
                              value={actionComments}
                              onChange={(e) => setActionComments(e.target.value)}
                              rows={3}
                              maxLength={2000}
                              placeholder="Registre o retorno técnico desta análise..."
                              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-xs font-medium text-gray-600 block mb-1">
                              Arquivo comentado (PDF) <span className="text-gray-400">— opcional</span>
                            </label>
                            <input
                              type="file"
                              accept=".pdf,.PDF"
                              onChange={(e) => setActionFile(e.target.files?.[0] ?? null)}
                              className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                            />
                            {actionFile && (
                              <p className="mt-1 text-xs text-gray-500 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                {actionFile.name}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => runAction(doc.id, actionStatus)}
                              disabled={isSubmitting || !actionComments.trim()}
                              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 rounded-lg text-xs font-medium transition-colors"
                            >
                              {isSubmitting ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Confirmar {actionStatus === 'REPROVADO' ? 'Reprovação' : 'Aprovação'}
                            </button>
                            <button
                              onClick={resetPanel}
                              disabled={isSubmitting}
                              className="px-3 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition-colors"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}