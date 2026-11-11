import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/prisma';
import { InvitationService } from '../../src/modules/organizations/invitation.service';
import bcrypt from 'bcrypt';

describe('Corporate Member Invitations & Onboarding (Phase 6)', () => {
  let adminUserId: number;
  let orgId: number;

  beforeAll(async () => {
    const senhaHash = await bcrypt.hash('AdminSenha123!', 10);
    const admin = await prisma.user.create({
      data: {
        nome: 'Admin Corporativo',
        email: `admin-inv-${Date.now()}@exemplo.com`,
        senhaHash,
      },
    });
    adminUserId = admin.id;

    const org = await prisma.organization.create({
      data: {
        nome: 'Engenharia & Obras S/A',
        slug: `eng-obras-${Date.now()}`,
      },
    });
    orgId = org.id;

    await prisma.organizationMembership.create({
      data: {
        organizationId: org.id,
        userId: admin.id,
        role: 'ORG_ADMIN',
      },
    });
  });

  afterAll(async () => {
    // Teardown
    await prisma.organizationInvitation.deleteMany({ where: { organizationId: orgId } });
    await prisma.organizationMembership.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: adminUserId } });
  });

  it('Deve emitir um convite corporativo gerando token único e status PENDING', async () => {
    const inviteEmail = `novo-eng-${Date.now()}@exemplo.com`;
    const { invitation, rawToken } = await InvitationService.createInvitation({
      organizationId: orgId,
      email: inviteEmail,
      role: 'ORG_MEMBER',
      invitedBy: adminUserId,
    });

    expect(invitation).toBeDefined();
    expect(invitation.email).toBe(inviteEmail);
    expect(invitation.role).toBe('ORG_MEMBER');
    expect(invitation.status).toBe('PENDING');
    expect(rawToken).toBeDefined();
    expect(rawToken.length).toBe(64); // 32 bytes hex
  });

  it('Deve aceitar o convite para um novo usuário e registrar a membership na organização', async () => {
    const inviteEmail = `novo-eng-2-${Date.now()}@exemplo.com`;
    const { rawToken } = await InvitationService.createInvitation({
      organizationId: orgId,
      email: inviteEmail,
      role: 'ORG_MEMBER',
      invitedBy: adminUserId,
    });

    const accepted = await InvitationService.acceptInvitation({
      rawToken,
      nome: 'Engenheiro Convidado',
      senha: 'SenhaSegura123!',
    });

    expect(accepted.user.email).toBe(inviteEmail);
    expect(accepted.role).toBe('ORG_MEMBER');
    expect(accepted.organization.id).toBe(orgId);

    // Validação no banco
    const membership = await prisma.organizationMembership.findFirst({
      where: {
        organizationId: orgId,
        user: { email: inviteEmail },
      },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('ORG_MEMBER');

    // Validação do status do convite
    const inviteInDb = await prisma.organizationInvitation.findFirst({
      where: { email: inviteEmail },
    });
    expect(inviteInDb?.status).toBe('ACCEPTED');

    // Limpar usuário criado
    await prisma.user.delete({ where: { email: inviteEmail } });
  });

  it('Tentativa de reutilizar um convite já aceito deve ser rejeitada com erro', async () => {
    const inviteEmail = `novo-eng-3-${Date.now()}@exemplo.com`;
    const { rawToken } = await InvitationService.createInvitation({
      organizationId: orgId,
      email: inviteEmail,
      role: 'ORG_MEMBER',
      invitedBy: adminUserId,
    });

    await InvitationService.acceptInvitation({
      rawToken,
      nome: 'Engenheiro Teste 3',
      senha: 'SenhaSegura123!',
    });

    await expect(
      InvitationService.acceptInvitation({
        rawToken,
        nome: 'Replay Attack',
        senha: 'SenhaSegura123!',
      })
    ).rejects.toThrow(/Este convite já foi accepted/);

    await prisma.user.delete({ where: { email: inviteEmail } });
  });
});
