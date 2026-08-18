/**
 * Tipagens do Épico 7: Módulo de Planejamento e Coordenação (Frontend).
 *
 * Estas tipagens espelham o model Prisma `WorkPackage` e os retornos
 * do backend, garantindo type-safety ponta a ponta.
 */

/**
 * Status de um Pacote de Trabalho.
 * Espelha os valores aceitos pelo schema Zod `workPackageStatusSchema`.
 */
export type WorkPackageStatus =
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDO'
  | 'ATRASADO'
  | 'CANCELADO';

/**
 * Representa um Pacote de Trabalho (WorkPackage) de um contrato (tenant).
 */
export interface WorkPackage {
  id: number;
  contractId: number;
  nome: string;
  descricao: string | null;
  dataInicio: string;
  dataFim: string;
  status: WorkPackageStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload para criação/edição de um pacote de trabalho.
 * Datas em formato ISO (YYYY-MM-DD para inputs `type="date"`).
 */
export interface WorkPackageFormInput {
  nome: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  status: WorkPackageStatus;
}

/**
 * Filtros opcionais de listagem (Busca Avançada / Filtros Refinados).
 */
export interface WorkPackageFilters {
  status?: WorkPackageStatus;
  busca?: string;
}

/**
 * Configuração de exibição por status (rótulo + classes Tailwind v4).
 */
export const WORK_PACKAGE_STATUS_CONFIG: Record<WorkPackageStatus, {
  label: string;
  badgeClass: string;
}> = {
  PENDENTE: {
    label: 'Pendente',
    badgeClass: 'bg-yellow-100 text-yellow-800',
  },
  EM_ANDAMENTO: {
    label: 'Em Andamento',
    badgeClass: 'bg-blue-100 text-blue-800',
  },
  CONCLUIDO: {
    label: 'Concluído',
    badgeClass: 'bg-green-100 text-green-800',
  },
  ATRASADO: {
    label: 'Atrasado',
    badgeClass: 'bg-red-100 text-red-800',
  },
  CANCELADO: {
    label: 'Cancelado',
    badgeClass: 'bg-gray-200 text-gray-700',
  },
};
