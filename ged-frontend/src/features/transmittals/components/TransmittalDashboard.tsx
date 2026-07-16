import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { transmittalService, type Transmittal, type RealApprovedRevision } from '../services/transmittal.service';

export const TransmittalDashboard: React.FC = () => {
  const { contractId } = useParams<{ contractId: string }>();
  
  const [activeTab, setActiveTab] = useState<'NOVA_GUIA' | 'HISTORICO'>('NOVA_GUIA');
  const [transmittals, setTransmittals] = useState<Transmittal[]>([]);
  
  const [approvedRevisions, setApprovedRevisions] = useState<RealApprovedRevision[]>([]);
  const [selectedRevisionIds, setSelectedRevisionIds] = useState<number[]>([]);
  
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [destinatario, setDestinatario] = useState('');
  const [proposito, setProposito] = useState('PARA_CONHECIMENTO');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (activeTab === 'HISTORICO') {
      fetchTransmittals();
    } else {
      fetchRealApprovedRevisions();
    }
  }, [activeTab, contractId]);

  const fetchTransmittals = async () => {
    try {
      const data = await transmittalService.list(Number(contractId));
      setTransmittals(data);
    } catch (error) {
      console.error('Erro ao buscar histórico das GRDs:', error);
    }
  };

  const fetchRealApprovedRevisions = async () => {
    try {
      const data = await transmittalService.getApprovedRevisions(Number(contractId));
      setApprovedRevisions(data);
    } catch (error) {
      console.error('Erro crítico ao buscar documentos reais:', error);
    }
  };

  const handleToggleSelection = (id: number) => {
    if (!id) return; // PROTEÇÃO: Impede injeção de nulls no array
    setSelectedRevisionIds(prev => 
      prev.includes(id) ? prev.filter(rId => rId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRevisionIds.length === 0) {
      alert('Selecione pelo menos um documento aprovado.');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await transmittalService.create(Number(contractId), {
        assunto,
        mensagem,
        destinatario,
        proposito,
        revisionIds: selectedRevisionIds
      });
      
      alert('GRD registada! Aguardando o processamento do servidor.');
      setAssunto(''); setMensagem(''); setDestinatario(''); setProposito('PARA_CONHECIMENTO');
      setSelectedRevisionIds([]); 
      setActiveTab('HISTORICO');
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-800">Guias de Remessa de Documentos (GRD)</h1>
        <div className="space-x-2">
          <button onClick={() => setActiveTab('NOVA_GUIA')} className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'NOVA_GUIA' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
            Emitir Nova GRD
          </button>
          <button onClick={() => setActiveTab('HISTORICO')} className={`px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'HISTORICO' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'}`}>
            Histórico Oficial
          </button>
        </div>
      </div>

      {activeTab === 'NOVA_GUIA' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200 overflow-hidden h-fit">
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <h2 className="font-semibold text-gray-700">Documentos Físicos (Aprovados)</h2>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded font-bold">{approvedRevisions.length} Disponíveis</span>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider text-left">
                <tr><th className="px-6 py-3">Sel.</th><th className="px-6 py-3">Código</th><th className="px-6 py-3">Título</th><th className="px-6 py-3">Rev</th></tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {approvedRevisions.map(rev => (
                  <tr key={`doc-real-${rev.id}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer" 
                        checked={selectedRevisionIds.includes(rev.id)} 
                        onChange={() => handleToggleSelection(rev.id)}
                      />
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{rev.codigoDocumento}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{rev.titulo}</td>
                    <td className="px-6 py-4 text-sm font-bold"><span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">{rev.versionLabel}</span></td>
                  </tr>
                ))}
                {approvedRevisions.length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-500">O acervo técnico ainda não possui documentos com o status de aprovação final.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 h-fit">
            <h2 className="font-semibold text-gray-700 mb-4">Metadados da GRD</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destinatário (Para:)</label>
                <input type="text" value={destinatario} onChange={e => setDestinatario(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Consórcio Construtor / Eng. João" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Motivo da Emissão *</label>
                <select required value={proposito} onChange={e => setProposito(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white">
                  <option value="PARA_CONHECIMENTO">Para Conhecimento</option>
                  <option value="PARA_APROVACAO">Para Aprovação</option>
                  <option value="PARA_CONSTRUCAO">Para Construção</option>
                  <option value="AS_BUILT">As-Built</option>
                  <option value="OUTRO">Outro / Geral</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto / Descrição *</label>
                <input type="text" required value={assunto} onChange={e => setAssunto(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Envio do Lote 3 de Estruturas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações Internas</label>
                <textarea rows={3} value={mensagem} onChange={e => setMensagem(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-blue-500 focus:border-blue-500" placeholder="Detalhes adicionais do pacote..." />
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button type="submit" disabled={isSubmitting || selectedRevisionIds.length === 0} className="w-full bg-blue-800 hover:bg-blue-900 text-white font-bold py-2.5 rounded-md disabled:opacity-50 transition-colors shadow-sm">
                  {isSubmitting ? 'A Processar...' : 'Registrar Intenção de GRD'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'HISTORICO' && (
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase text-left tracking-wider">
              <tr><th className="px-6 py-3">Nº GRD</th><th className="px-6 py-3">Assunto</th><th className="px-6 py-3">Propósito</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 text-center">Ações</th></tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {transmittals.map(t => (
                <tr key={`grd-hist-${t.id}`} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">{t.codigo}</td>
                  <td className="px-6 py-4 text-sm text-gray-700 truncate max-w-xs">{t.assunto}</td>
                  <td className="px-6 py-4 text-xs font-semibold text-gray-500">{t.proposito?.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    {t.status === 'EM_PROCESSAMENTO' && <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium animate-pulse">Aguardando Worker (Python)</span>}
                    {t.status === 'CONCLUIDO' && <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Pronto</span>}
                    {t.status === 'ERRO' && <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-xs font-medium">Falha no Worker</span>}
                  </td>
                  <td className="px-6 py-4 text-center space-x-2">
                    {t.status === 'CONCLUIDO' ? (
                      <>
                        <a href={t.pdfCapaUrl!} target="_blank" rel="noreferrer" className="inline-block px-3 py-1 bg-gray-800 hover:bg-gray-700 text-white text-xs font-medium rounded transition-colors shadow-sm">Capa PDF</a>
                        <a href={t.zipUrl!} target="_blank" rel="noreferrer" className="inline-block px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded transition-colors shadow-sm">Pacote ZIP</a>
                      </>
                    ) : <span className="text-xs text-gray-400 italic">Pendente...</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};