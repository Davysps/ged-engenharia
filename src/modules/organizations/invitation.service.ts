import crypto from 'node:crypto';
import { prisma } from '../../prisma';
import bcrypt from 'bcrypt';
import type { OrganizationRole } from '@prisma/client';

export class InvitationService {
  /**
   * Cria um convite corporativo seguro gerando um token aleatório criptográfico.
   */
  static async createInvitation(params: {
    organizationId: number;
    email: string;
    role: OrganizationRole;
    invitedBy: number;
  }) {
    const { organizationId, email, role, invitedBy } = params;

    // Gerar token de alta entropia (32 bytes hex) e hash para armazenamento
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Expira em 7 dias
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: email.toLowerCase().trim(),
        role,
        tokenHash,
        expiresAt,
        invitedBy,
      },
      include: {
        organization: {
          select: { nome: true, slug: true },
        },
      },
    });

    return {
      invitation,
      rawToken, // Retornado apenas na emissão para envio por e-mail ou link
    };
  }

  /**
   * Aceita um convite corporativo utilizando o token seguro.
   */
  static async acceptInvitation(params: {
    rawToken: string;
    nome?: string;
    senha?: string;
  }) {
    const { rawToken, nome, senha } = params;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const invitation = await prisma.organizationInvitation.findUnique({
      where: { tokenHash },
      include: { organization: true },
    });

    if (!invitation) {
      throw new Error('Convite inválido ou inexistente.');
    }

    if (invitation.status !== 'PENDING') {
      throw new Error(`Este convite já foi ${invitation.status.toLowerCase()}.`);
    }

    if (invitation.expiresAt < new Date()) {
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      throw new Error('Este convite expirou.');
    }

    // Localizar ou criar o usuário convidado
    let user = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    if (!user) {
      if (!senha || !nome) {
        throw new Error('Nome e senha são obrigatórios para novos usuários.');
      }
      const senhaHash = await bcrypt.hash(senha, 10);
      user = await prisma.user.create({
        data: {
          nome,
          email: invitation.email,
          senhaHash,
          globalRole: 'USER',
        },
      });
    }

    // Registrar membership na organização e marcar convite como aceito transacionalmente
    await prisma.$transaction([
      prisma.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: invitation.organizationId,
            userId: user.id,
          },
        },
        update: { role: invitation.role },
        create: {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
        },
      }),
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    return {
      organization: invitation.organization,
      user: { id: user.id, email: user.email, nome: user.nome },
      role: invitation.role,
    };
  }
}
