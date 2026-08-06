import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useParams } from 'react-router-dom';
import {
  FileText,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Tag,
  ChevronRight,
  RefreshCw,
  BarChart3,
  Users,
  Hash,
} from 'lucide-react';
import { dashboardService } from '../services/dashboard.service';
import type { DashboardData, DocumentByDiscipline, PendingApproval, RecentTransmittal } from '../types/dashboard.types';

// ─────────────────────────────────────────────────────────────────────────────
// Mapeamentos de exibição (labels e cores)
// ─────────────────────────────────────────────────────────────────────────────

const DISCIPLINE_LABELS: Record<string, string> = {
  ELETRICA: 'Elétrica',
  HIDRAULICA: 'Hidráulica',
  ESTRUTURAL: 'Estrutural',
  MECANICA: 'Mecânica',
  CIVIL: 'Civil',
  ARQUITETURA: 'Arquitetura',
  OUTRO: 'Outro',
};

const STATUS_CONFIG: Record<string, { label: string; icon: ReactElement; color: string }> = {
  EM_ELABORACAO: { label: 'Em Elaboração', icon: <Clock className="w-4 h-4" />, color: 'text-gray-600' },
  EM_REVISAO: { label: 'Em Revisão', icon: <Clock className="w-4 h-4" />, color: 'text-blue-600' },
  APROVADO: { label: 'Aprovado', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600' },
  REJEITADO: { label: 'Rejeitado', icon: <XCircle className="w-4 h-4" />, color: 'text-red-600' },
  OBSOLETO: { label: 'Obsoleto', icon: <Tag className="w-4 h-4" />, color: 'text-slate-500' },
};

const TRANSMITTAL_STATUS_CONFIG: Record<string, { label: string; icon: ReactElement; color: string }> = {
  EM_PROCESSAMENTO: { label: 'Em Processamento', icon: <Clock className="w-4 h-4" />, color: 'text-amber-600' },
  CONCLUIDO: { label: 'Concluído', icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600' },
  ERRO: { label: 'Erro', icon: <XCircle className="w-4 h-4" />, color: 'text-red-600' },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: KPI Summary Cards
// ─────────────────────────────────────────────────────────────────────────────

interface KpiSummaryProps {
  totalDocuments: number;
  totalTransmittals: number;
  pendingApprovals: number;
}

function KpiSummary({ totalDocuments, totalTransmittals, pendingApprovals }: KpiSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
        <div className="p-3 bg-blue-100 rounded-lg">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalDocuments}</p>
          <p className="text-sm text-gray-500">Documentos no Contrato</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
        <div className="p-3 bg-amber-100 rounded-lg">
          <Clock className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{pendingApprovals}</p>
          <p className="text-sm text-gray-500">Aprovações Pendentes</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center gap-4">
        <div className="p-3 bg-indigo-100 rounded-lg">
          <Send className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{totalTransmittals}</p>
          <p className="text-sm text-gray-500">Transmittals Emitidos</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Documents by Discipline (Bar Chart)
// ─────────────────────────────────────────────────────────────────────────────

interface DisciplineChartProps {
  data: DocumentByDiscipline[];
}

function DisciplineChart({ data }: DisciplineChartProps) {
  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 0;

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Documentos por Disciplina</h3>
        <p className="text-sm text-gray-400 italic">Nenhum documento encontrado neste contrato.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-indigo-600" />
        Documentos por Disciplina
      </h3>
      <div className="space-y-4">
        {data.map((item) => {
          const percentage = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
          const label = DISCIPLINE_LABELS[item.disciplina] ?? item.disciplina;
          return (
            <div key={item.disciplina}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{label}</span>
                <span className="text-sm font-bold text-gray-900">{item.count}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Revision Status Cards
// ─────────────────────────────────────────────────────────────────────────────

interface RevisionStatusProps {
  counts: Record<string, number>;
}

function RevisionStatusCards({ counts }: RevisionStatusProps) {
  const allStatuses = ['EM_ELABORACAO', 'EM_REVISAO', 'APROVADO', 'REJEITADO', 'OBSOLETO'];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Hash className="w-5 h-5 text-indigo-600" />
        Status das Revisões
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {allStatuses.map((status) => {
          const cfg = (STATUS_CONFIG[status] ?? STATUS_CONFIG.EM_ELABORACAO)!;
          const count = counts[status] ?? 0;
          return (
            <div key={status} className="text-center p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className={`flex justify-center mb-2 ${cfg.color}`}>{cfg.icon}</div>
              <p className="text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500 mt-1">{cfg.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Pending Approvals Table
// ─────────────────────────────────────────────────────────────────────────────

interface PendingApprovalsTableProps {
  approvals: PendingApproval[];
}

function PendingApprovalsTable({ approvals }: PendingApprovalsTableProps) {
  if (approvals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          Fila de Trabalho — Pendências de Aprovação
        </h3>
        <p className="text-sm text-gray-400 italic">Nenhuma pendência de aprovação no momento.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-600" />
        Fila de Trabalho — Top 5 Pendências
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Documento</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Revisão</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Disciplina</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Solicitante</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {approvals.map((approval) => (
              <tr key={approval.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 font-mono">{approval.codigoDocumento}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{approval.titulo}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md">
                    {approval.versionLabel}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-gray-700">
                    {DISCIPLINE_LABELS[approval.disciplina] ?? approval.disciplina}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{approval.solicitante}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(approval.dataSolicitacao).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: Recent Transmittals Table
// ─────────────────────────────────────────────────────────────────────────────

interface RecentTransmittalsTableProps {
  transmittals: RecentTransmittal[];
}

function RecentTransmittalsTable({ transmittals }: RecentTransmittalsTableProps) {
  if (transmittals.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Send className="w-5 h-5 text-indigo-600" />
          Histórico Recente — Últimas GRDs
        </h3>
        <p className="text-sm text-gray-400 italic">Nenhuma Guia de Remessa emitida ainda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
        <Send className="w-5 h-5 text-indigo-600" />
        Histórico Recente — Últimas 5 GRDs
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nº GRD</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Assunto</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Itens</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Emitida por</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Data</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transmittals.map((t) => {
              const cfg = (TRANSMITTAL_STATUS_CONFIG[t.status] ?? TRANSMITTAL_STATUS_CONFIG.ERRO)!;
              return (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-sm font-bold text-gray-900 font-mono">{t.codigo}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate">{t.assunto}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-md">
                      <Users className="w-3 h-3 mr-1" />
                      {t.itemCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md ${cfg.color} bg-gray-50`}>
                      {cfg.icon}
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{t.createdByNome}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component: DashboardOperacional
// ─────────────────────────────────────────────────────────────────────────────

export function DashboardOperacional() {
  const { contractId } = useParams<{ contractId: string }>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const numericContractId = Number(contractId);

  const fetchDashboard = async () => {
    if (!contractId || isNaN(numericContractId)) {
      setError('ID do contrato inválido.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const dashboardData = await dashboardService.getDashboardData(numericContractId);
      setData(dashboardData);
    } catch (err: unknown) {
      const errorMessage =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : 'Erro ao carregar os indicadores do dashboard.';
      setError(errorMessage || 'Erro ao carregar os indicadores do dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [contractId]);

  if (isLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-24 bg-gray-200 rounded-xl"></div>
            <div className="h-24 bg-gray-200 rounded-xl"></div>
            <div className="h-24 bg-gray-200 rounded-xl"></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-xl"></div>
            <div className="h-64 bg-gray-200 rounded-xl"></div>
          </div>
          <div className="h-80 bg-gray-200 rounded-xl"></div>
          <div className="h-80 bg-gray-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Erro ao Carregar Dashboard</h2>
          <p className="text-gray-500 mb-4">{error ?? 'Dados não encontrados.'}</p>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  const totalDocuments = data.documentsByDiscipline.reduce((sum: number, d: DocumentByDiscipline) => sum + d.count, 0);
  const totalTransmittals = data.recentTransmittals.length;
  const pendingCount = data.pendingApprovals.length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard Operacional</h1>
            <p className="text-sm text-gray-500 mt-1">
              Indicadores consolidados do contrato #{data.contractId}
            </p>
          </div>
        </div>
        <button
          onClick={fetchDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
          title="Atualizar indicadores"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* KPI Summary Cards */}
      <KpiSummary
        totalDocuments={totalDocuments}
        totalTransmittals={totalTransmittals}
        pendingApprovals={pendingCount}
      />

      {/* Grid: Discipline Chart + Revision Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DisciplineChart data={data.documentsByDiscipline} />
        <RevisionStatusCards counts={data.revisionStatusCounts} />
      </div>

      {/* Grid: Pending Approvals + Recent Transmittals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PendingApprovalsTable approvals={data.pendingApprovals} />
        <RecentTransmittalsTable transmittals={data.recentTransmittals} />
      </div>

      {/* Footer: Navigation hint */}
      <div className="flex justify-end">
        <button
          onClick={() => window.open(`/contracts/${data.contractId}/approvals`, '_self')}
          className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
        >
          Ver todas as aprovações
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
