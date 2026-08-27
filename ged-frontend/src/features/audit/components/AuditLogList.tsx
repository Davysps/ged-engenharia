import { useEffect, useState, type FC } from 'react';
import { useContract } from '../../../contexts/ContractContext';
import { useAuditLogs } from '../hooks/useAuditLogs';
import type { AuditLogEntry } from '../types/audit.types';

const ACTION_LABELS: Record<string, string> = {
  UPLOAD_DOCUMENT: 'Upload de Documento',
  UPLOAD_REVISION: 'Nova Revisão',
  INTERNAL_UPDATE_REVISION: 'Correção Interna',
  APPROVAL_APROVADO: 'Aprovação',
  APPROVAL_APROVADO_COM_COMENTARIOS: 'Aprovação c/ Comentários',
  APPROVAL_REPROVADO: 'Reprovação',
  EMIT_GRD: 'Emissão de GRD',
};

const ENTITY_LABELS: Record<string, string> = {
  Document: 'Documento',
  Revision: 'Revisão',
  ApprovalWorkflow: 'Aprovação',
  Transmittal: 'GRD',
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function DetailsJson({ details }: { details: Record<string, unknown> | null }) {
  if (!details) return <span className="text-gray-400">—</span>;
  return (
    <span className="font-mono text-xs text-gray-600 break-all">
      {JSON.stringify(details)}
    </span>
  );
}

export const AuditLogList: FC = () => {
  const { contract } = useContract();
  const contractId = Number(contract?.id);
  const { logs, isLoading, error, fetchLogs } = useAuditLogs(contractId);
  const [entityFilter, setEntityFilter] = useState<string>('');

  useEffect(() => {
    if (contractId) {
      fetchLogs(entityFilter ? { entity: entityFilter } : undefined);
    }
  }, [contractId, entityFilter, fetchLogs]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-700" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Filtrar por entidade:</label>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-500"
        >
          <option value="">Todas</option>
          <option value="Document">Documento</option>
          <option value="Revision">Revisão</option>
          <option value="ApprovalWorkflow">Aprovação</option>
          <option value="Transmittal">GRD</option>
        </select>
        <button
          onClick={() => fetchLogs(entityFilter ? { entity: entityFilter } : undefined)}
          className="px-3 py-1.5 text-sm bg-slate-700 text-white rounded-md hover:bg-slate-800 transition-colors"
        >
          Atualizar
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Nenhum evento de auditoria registado neste contrato.
        </div>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Data / Hora
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Ação
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Entidade
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">
                  Detalhes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {logs.map((log: AuditLogEntry) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-800">
                    {log.user.nome}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {ENTITY_LABELS[log.entity] ?? log.entity}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    #{log.entityId}
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <DetailsJson details={log.details} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 font-mono">
        {logs.length} evento(s) registado(s)
      </p>
    </div>
  );
};
