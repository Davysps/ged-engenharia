import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/prisma';
import { SubscriptionService } from '../../src/modules/subscriptions/subscription.service';

describe('Subscription, Plans & Resource Limiting (Phase 5)', () => {
  let orgId: number;

  beforeAll(async () => {
    // Inicializar os planos padrão do SaaS
    await SubscriptionService.ensureDefaultPlans();

    // Criar organização de teste
    const org = await prisma.organization.create({
      data: {
        nome: 'Empresa Teste Planos',
        slug: `org-plan-${Date.now()}`,
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    // Teardown
    await prisma.subscription.deleteMany({ where: { organizationId: orgId } });
    await prisma.contract.deleteMany({
      where: { client: { organizationId: orgId } },
    });
    await prisma.client.deleteMany({ where: { organizationId: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
  });

  it('Deve inicializar planos Starter, Professional e Enterprise no banco', async () => {
    const starterPlan = await prisma.plan.findUnique({ where: { tier: 'STARTER' } });
    const proPlan = await prisma.plan.findUnique({ where: { tier: 'PROFESSIONAL' } });
    const enterprisePlan = await prisma.plan.findUnique({ where: { tier: 'ENTERPRISE' } });

    expect(starterPlan).not.toBeNull();
    expect(starterPlan?.maxContracts).toBe(5);

    expect(proPlan).not.toBeNull();
    expect(proPlan?.maxContracts).toBe(25);

    expect(enterprisePlan).not.toBeNull();
    expect(enterprisePlan?.maxContracts).toBe(200);
  });

  it('Deve associar a organização ao plano STARTER com status ACTIVE', async () => {
    const sub = await SubscriptionService.assignPlanToOrganization(orgId, 'STARTER');
    expect(sub.organizationId).toBe(orgId);
    expect(sub.status).toBe('ACTIVE');
    expect(sub.plan.tier).toBe('STARTER');
  });

  it('Deve permitir criação de contratos dentro do limite do plano', async () => {
    const check = await SubscriptionService.checkContractCreationLimit(orgId);
    expect(check.allowed).toBe(true);
    expect(check.currentCount).toBe(0);
    expect(check.maxLimit).toBe(5);
  });

  it('Deve bloquear a criação de novos contratos ao atingir a cota do plano', async () => {
    const client = await prisma.client.create({
      data: {
        nome: 'Cliente Construtor',
        organizationId: orgId,
      },
    });

    // Criar 5 contratos para atingir o teto de 5 do STARTER
    for (let i = 1; i <= 5; i++) {
      await prisma.contract.create({
        data: {
          nome: `Empreendimento ${i}`,
          codigo: `EMP-${orgId}-${i}`,
          clientId: client.id,
        },
      });
    }

    const limitCheck = await SubscriptionService.checkContractCreationLimit(orgId);
    expect(limitCheck.allowed).toBe(false);
    expect(limitCheck.currentCount).toBe(5);
    expect(limitCheck.maxLimit).toBe(5);
    expect(limitCheck.reason).toContain('Limite de contratos do plano atingido');
  });

  it('Upgrade para PROFESSIONAL deve liberar a cota de contratos', async () => {
    await SubscriptionService.assignPlanToOrganization(orgId, 'PROFESSIONAL');

    const limitCheck = await SubscriptionService.checkContractCreationLimit(orgId);
    expect(limitCheck.allowed).toBe(true);
    expect(limitCheck.currentCount).toBe(5);
    expect(limitCheck.maxLimit).toBe(25);
  });

  it('Assinatura em estado PAST_DUE ou CANCELED deve suspender a criação de novos contratos', async () => {
    await prisma.subscription.update({
      where: { organizationId: orgId },
      data: { status: 'PAST_DUE' },
    });

    const limitCheck = await SubscriptionService.checkContractCreationLimit(orgId);
    expect(limitCheck.allowed).toBe(false);
    expect(limitCheck.reason).toContain('Assinatura suspensa ou inadimplente');
  });
});
