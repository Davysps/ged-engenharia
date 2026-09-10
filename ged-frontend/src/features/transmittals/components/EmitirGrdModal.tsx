import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { X, Send, AlertTriangle, CheckCircle2, Loader2, FileText, Users } from 'lucide-react';
import { transmittalService, type RealApprovedRevision } from '../services/transmittal.service';
import type { DocumentListItem } from '../../documents/types/document.types';

interface EmitirGrdModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: number;
  documents: DocumentListItem[];
  // Cada abertura do botão incrementa o sessionKey no pai → remonta o conteúdo
  // com estado 100% limpo (formulário, seleção e loading) sem effects de reset.
  sessionKey: number;
  onSuccess: () => void;
}

const PROPOSITO_LABELS: Array<{ value: string; label: string }> = [
  { value: 'PARA_CONHECIMENTO', label: 'Para Conhecimento' },
  { value: 'PARA_APROVACAO', label: 'Para Aprovação' },
  { value: 'PARA_CONSTRUCAO', label: 'Para Construção' },
  { value: 'AS_BUILT', label: 'As-Built' },
  { value: 'OUTRO', label: 'Outro / Geral' },
];

export function EmitirGrdModal({ isOpen, onClose, contractId, documents, sessionKey, onSuccess }: EmitirGrdModalProps) {
  if (!isOpen) return null;

  return (
    <EmitirGrdModalInner
      key={`grd-${sessionKey}`}
      contractId={contractId}
      documents={documents}
      onClose={onClose}
      onSuccess={onSuccess}
    />
  );
}

interface EmitirGrdModalInnerProps {
  contractId: number;
  documents: DocumentListItem[];
  onClose: () => void;
  onSuccess: () => void;
}

function EmitirGrdModalInner({ contractId, documents, onClose, onSuccess }: EmitirGrdModalInnerProps) {
  // Snapshot dos documentos da sessão: como o componente remonta (key) a cada
  // abertura, o `documents` recebido nunca muda durante a vida do modal.
  const [docsSnapshot] = useState<DocumentListItem[]>(documents);

  const [approvedRevisions, setApprovedRevisions] = useState<RealApprovedRevision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<number[]>([]);
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [proposito, setProposito] = useState('PARA_CONHECIMENTO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Consulta as revisões aprovadas do contrato e cruza com a seleção do Acervo.
  // Toda atualização de estado acontece em callbacks assíncronos (após fetch).
  useEffect(() => {
    let cancelled = false;

    transmittalService
      .getApprovedRevisions(contractId)
      .then((data) => {
        if (cancelled) return;
        setApprovedRevisions(data);
        const approved = new Set(data.map((rev) => rev.id));
        const ids = docsSnapshot
          .map((doc) => doc.revisions.find((rev) => approved.has(rev.id))?.id)
          .filter((id): id is number => typeof id === 'number');
        setSelectedRevisionIds(ids);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[EmitirGrdModal] Erro ao buscar revisões aprovadas:', error);
        alert('Não foi possível consultar os documentos aprovados. Tente novamente.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contractId, docsSnapshot]);

  // Cruzamento: revisão aprovada (id real de revision) presente na seleção do Acervo
  const approvedIds = useMemo(
    () => new Set(approvedRevisions.map((rev) => rev.id)),
    [approvedRevisions]
  );

  const { validDocuments, invalidDocuments } = useMemo(() => {
    const valid: DocumentListItem[] = [];
    const invalid: DocumentListItem[] = [];
    for (const doc of docsSnapshot) {
      const hasApproved = doc.revisions.some((rev) => approvedIds.has(rev.id));
      if (hasApproved) valid.push(doc);
      else invalid.push(doc);
    }
    return { validDocuments: valid, invalidDocuments: invalid };
  }, [docsSnapshot, approvedIds]);

  const handleToggle = (id: number) => {
    setSelectedRevisionIds((prev) =>
      prev.includes(id) ? prev.filter((revId) => revId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRevisionIds.length === 0) {
      alert('Selecione pelo menos um documento aprovado para emitir a GRD.');
      return;
    }

    setIsSubmitting(true);
    try {
      await transmittalService.create(contractId, {
        assunto,
        mensagem,
        destinatario,
        proposito,
        revisionIds: selectedRevisionIds,
      });
      alert('GRD registada com sucesso! Aguardando o processamento do servidor.');
      onSuccess();
      onClose();
    } catch (error) {
      if (axios.isAxiosError(error)) {
        alert(error.response?.data?.error || 'Erro ao gerar GRD.');
      } else {
        alert('Erro inesperado no servidor.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Emitir GRD
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {validDocuments.length} documento{validDocuments.length !== 1 ? 's' : ''} pronto{validDocuments.length !== 1 ? 's' : ''} para envio
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
            <p className="text-sm">Consultando documentos aprovados...</p>
          </div>
        ) : (
          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
            <div className="space-y-4">
              {/* Aviso de itens removidos (validação) */}
              {invalidDocuments.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4.5 h-4.5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-xs text-amber-800">
                      <p className="font-bold mb-1">
                        {invalidDocuments.length} documento{invalidDocuments.length !== 1 ? 's' : ''} ignora{invalidDocuments.length === 1 ? '' : 'do'} por não estar no status APROVADO:
                      </p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        {invalidDocuments.map((doc) => (
                          <li key={doc.id}>
                            <span className="font-semibold">{doc.codigoDocumento}</span> — {doc.titulo}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2">Apenas revisões com status final <span className="font-bold">APROVADO</span> podem ser emitidas em uma Guia de Remessa.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Lista de documentos válidos removíveis.
                  ÁREA DE ROLAGEM PRÓPRIA (max-h-40 + overflow-y-auto): com 100
                  documentos selecionados o modal NÃO cresce infinitamente — a
                  lista rola internamente sobre fundo slate suave. */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                    <FileText className="w-3.5 h-3.5 text-slate-500" />
                    Documentos no lote
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 bg-white border border-slate-200 text-[11px] font-bold text-slate-600 rounded-full whitespace-nowrap">
                    {selectedRevisionIds.length}/{validDocuments.length} selecionado{selectedRevisionIds.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {validDocuments.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-slate-500">
                    Nenhum documento selecionado possui revisão aprovada para envio.
                  </div>
                ) : (
                  <ul className="max-h-40 overflow-y-auto divide-y divide-slate-200/70 bg-slate-50">
                    {validDocuments.map((doc) => {
                      const approvedRev = doc.revisions.find((rev) => approvedIds.has(rev.id));
                      const isChecked = !!approvedRev && selectedRevisionIds.includes(approvedRev.id);
                      return (
                        <li
                          key={doc.id}
                          className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                            isChecked ? 'bg-blue-50/60' : 'hover:bg-slate-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            checked={isChecked}
                            disabled={!approvedRev}
                            onChange={() => approvedRev && handleToggle(approvedRev.id)}
                          />
                          <FileText className={`w-4 h-4 shrink-0 ${isChecked ? 'text-blue-500' : 'text-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{doc.codigoDocumento}</p>
                            <p className="text-xs text-slate-500 truncate">{doc.titulo}</p>
                          </div>
                          {approvedRev && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-full whitespace-nowrap">
                              <CheckCircle2 className="w-3 h-3" />
                              Rev {approvedRev.versionLabel}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Divisor visual: documentos vs. metadados da GRD */}
            <div className="mt-6 pt-5 border-t-2 border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-blue-700" />
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Dados da Guia de Remessa</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assunto / Descrição *</label>
                  <input
                    type="text"
                    required
                    value={assunto}
                    onChange={(e) => setAssunto(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                    placeholder="Ex: Envio do Lote 3 de Estruturas"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Destinatário (Para:)</label>
                    <input
                      type="text"
                      value={destinatario}
                      onChange={(e) => setDestinatario(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                      placeholder="Ex: Consórcio Construtor / Eng. João"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Emissão *</label>
                    <select
                      required
                      value={proposito}
                      onChange={(e) => setProposito(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none bg-white"
                    >
                      {PROPOSITO_LABELS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Observações Internas</label>
                  <textarea
                    rows={2}
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                    placeholder="Detalhes adicionais do pacote..."
                  />
                </div>

                <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || selectedRevisionIds.length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-blue-800 hover:bg-blue-900 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        A Processar...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Registrar Intenção de GRD
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}