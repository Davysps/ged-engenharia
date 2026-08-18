import { prisma } from '../../prisma';
import type {
  CreateWorkPackageInput,
  UpdateWorkPackageInput,
  WorkPackageStatus,
} from './planning.schemas';

/**
 * Service do Épico 7: Módulo de Planejamento e Coordenação.
 *
 * Segue o princípio do DDD: isola toda a lógica de negócio e queries
 * do Prisma no service, mantendo o controller fino e testável.
 *
 * ISOLAMENTO MULTI-TENANT (CRÍTICO):
 * Todo e qualquer acesso ao Prisma é filtrado obrigatoriamente pelo
 * `contractId` (tenantId), que é previamente validado contra a
 * `ContractMembership` do usuário autenticado. Clientes diferentes
 * nunca enxergam dados uns dos outros.
 *
 * RBAC:
 * - Listar: qualquer membro do contrato.
 * - Criar/editar/deletar: apenas usuários com role GESTOR.
 */
export class PlanningService {

  /**
   * Valida que o usuário é membro do contrato e retorna a membership.
   * @throws Error com código 'ACCESS_DENIED' caso não seja membro.
   */
  private static async requireMembership(contractId: number, userId: number) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    return membership;
  }

  /**
   * Garante RBAC de escrita: apenas GESTOR.
   * @throws Error com código 'ACCESS_DENIED' caso a role não seja GESTOR.
   */
  private static requireManager(membershipRole: string) {
    if (membershipRole !== 'GESTOR') {
      const error = new Error('Permissão insuficiente: apenas gestores podem realizar esta ação.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }
  }

  /**
   * Lista os pacotes de trabalho de um contrato (tenant).
   * Filtros opcionais: status e busca por nome.
   * Acesso: qualquer membro do contrato.
   */
  static async listWorkPackages(
    contractId: number,
    userId: number,
    filters?: { status?: WorkPackageStatus; busca?: string }
  ) {
    await PlanningService.requireMembership(contractId, userId);

    const where: {
      contractId: number;
      status?: WorkPackageStatus;
      nome?: { contains: string; mode: 'insensitive' };
    } = { contractId };

    if (filters?.status) {
      where.status = filters.status;
    }

    const busca = filters?.busca?.trim();
    if (busca) {
      where.nome = { contains: busca, mode: 'insensitive' };
    }

    return await prisma.workPackage.findMany({
      where,
      orderBy: { dataInicio: 'asc' },
    });
  }

  /**
   * Cria um novo pacote de trabalho.
   * Acesso: apenas GESTOR.
   */
  static async createWorkPackage(
    contractId: number,
    userId: number,
    data: CreateWorkPackageInput
  ) {
    const membership = await PlanningService.requireMembership(contractId, userId);
    PlanningService.requireManager(membership.role);

    return await prisma.workPackage.create({
      data: {
        contractId,
        nome: data.nome,
        descricao: data.descricao || null,
        dataInicio: data.dataInicio,
        dataFim: data.dataFim,
        status: data.status ?? 'PENDENTE',
      },
    });
  }

  /**
   * Atualiza um pacote de trabalho existente.
   * Acesso: apenas GESTOR.
   */
  static async updateWorkPackage(
    contractId: number,
    userId: number,
    workPackageId: number,
    data: UpdateWorkPackageInput
  ) {
    const membership = await PlanningService.requireMembership(contractId, userId);
    PlanningService.requireManager(membership.role);

    const existing = await prisma.workPackage.findFirst({
      where: { id: workPackageId, contractId },
      select: { id: true, contractId: true },
    });

    if (!existing || existing.contractId !== contractId) {
      const error = new Error('Pacote de trabalho não encontrado neste contrato.');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    const updateData: {
      nome?: string;
      descricao?: string | null;
      dataInicio?: Date;
      dataFim?: Date;
      status?: string;
    } = {};

    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.descricao !== undefined) updateData.descricao = data.descricao || null;
    if (data.dataInicio !== undefined) updateData.dataInicio = data.dataInicio;
    if (data.dataFim !== undefined) updateData.dataFim = data.dataFim;
    if (data.status !== undefined) updateData.status = data.status;

    return await prisma.workPackage.update({
      where: { id: workPackageId },
      data: updateData,
    });
  }

  /**
   * Remove um pacote de trabalho.
   * Acesso: apenas GESTOR.
   */
  static async deleteWorkPackage(
    contractId: number,
    userId: number,
    workPackageId: number
  ) {
    const membership = await PlanningService.requireMembership(contractId, userId);
    PlanningService.requireManager(membership.role);

    const existing = await prisma.workPackage.findFirst({
      where: { id: workPackageId, contractId },
      select: { id: true, contractId: true },
    });

    if (!existing || existing.contractId !== contractId) {
      const error = new Error('Pacote de trabalho não encontrado neste contrato.');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return await prisma.workPackage.delete({
      where: { id: workPackageId },
    });
  }
}
