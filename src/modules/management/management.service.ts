import { prisma } from '../../prisma';
import type { ContractRole } from '@prisma/client';
import type {
  CreateDisciplineInput,
  UpdateDisciplineInput,
  InviteUserInput,
} from './management.schemas';

export class ManagementService {

  static async listDisciplines(contractId: number, userId: number) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    return await prisma.contractDiscipline.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async createDiscipline(
    contractId: number, userId: number, data: CreateDisciplineInput
  ) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    if (membership.role !== 'GESTOR') {
      const error = new Error('Permissão insuficiente: apenas gestores podem criar disciplinas.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

        return await prisma.contractDiscipline.create({
      data: {
        contractId,
        nome: data.nome,
        codigo: data.codigo,
        descricao: data.descricao || null,
      },
    });
  }

  static async updateDiscipline(
    contractId: number, userId: number, disciplineId: number, data: UpdateDisciplineInput
  ) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    if (membership.role !== 'GESTOR') {
      const error = new Error('Permissão insuficiente: apenas gestores podem atualizar disciplinas.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

        const updateData: { nome?: string; codigo?: string; descricao?: string | null } = {};
    if (data.nome !== undefined) updateData.nome = data.nome;
    if (data.codigo !== undefined) updateData.codigo = data.codigo;
    if (data.descricao !== undefined) updateData.descricao = data.descricao || null;

    return await prisma.contractDiscipline.update({
      where: { id: disciplineId, contractId },
      data: updateData,
    });
  }

  /** Remove uma disciplina. Acesso: apenas GESTOR. */
  static async deleteDiscipline(
    contractId: number, userId: number, disciplineId: number
  ) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    if (membership.role !== 'GESTOR') {
      const error = new Error('Permissão insuficiente: apenas gestores podem remover disciplinas.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    const existing = await prisma.contractDiscipline.findUnique({
      where: { id: disciplineId },
      select: { id: true, contractId: true },
    });

    if (!existing || existing.contractId !== contractId) {
      const error = new Error('Disciplina não encontrada neste contrato.');
      (error as any).code = 'NOT_FOUND';
      throw error;
    }

    return await prisma.contractDiscipline.delete({
      where: { id: disciplineId },
    });
  }

  /** Lista todos os membros de um contrato. Acesso: qualquer membro. */
  static async listUsers(contractId: number, userId: number) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    const members = await prisma.contractMembership.findMany({
      where: { contractId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, nome: true, email: true } },
      },
    });

    return members.map((m) => ({
      id: m.user.id,
      nome: m.user.nome,
      email: m.user.email,
      role: m.role as ContractRole,
      createdAt: m.createdAt.toISOString(),
    }));
  }

  /** Convida um novo usuário. Acesso: apenas GESTOR. */
  static async inviteUser(
    contractId: number, userId: number, data: InviteUserInput
  ) {
    const membership = await prisma.contractMembership.findUnique({
      where: { userId_contractId: { userId, contractId } },
      select: { role: true },
    });

    if (!membership) {
      const error = new Error('Acesso negado: usuário não é membro deste contrato.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    if (membership.role !== 'GESTOR') {
      const error = new Error('Permissão insuficiente: apenas gestores podem convidar usuários.');
      (error as any).code = 'ACCESS_DENIED';
      throw error;
    }

    const existingMembership = await prisma.contractMembership.findFirst({
      where: { contractId, user: { email: data.email } },
    });

    if (existingMembership) {
      const error = new Error('Este usuário já é membro deste contrato.');
      (error as any).code = 'CONFLICT';
      throw error;
    }

    let user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          nome: data.nome,
          email: data.email,
          senhaHash: 'TEMP_PASSWORD_' + Date.now(),
        },
      });
    }

    const member = await prisma.contractMembership.create({
      data: { userId: user.id, contractId, role: data.role },
      include: {
        user: { select: { id: true, nome: true, email: true } },
      },
    });

    return {
      id: member.user.id,
      nome: member.user.nome,
      email: member.user.email,
      role: member.role as ContractRole,
      createdAt: member.createdAt.toISOString(),
    };
  }
}
