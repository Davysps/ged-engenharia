import { prisma } from '../../prisma';

export interface SubscriptionLimitCheckResult {
  allowed: boolean;
  reason?: string;
  currentCount: number;
  maxLimit: number;
}

export class SubscriptionService {
  /**
   * Inicializa planos padrão do sistema (Starter, Professional, Enterprise) se não existirem.
   */
  static async ensureDefaultPlans(): Promise<void> {
    const plans = [
      {
        tier: 'STARTER' as const,
        nome: 'Starter B2B',
        maxStorageGB: 50,
        maxContracts: 5,
        maxUsers: 10,
        precoMensal: 1490.0,
      },
      {
        tier: 'PROFESSIONAL' as const,
        nome: 'Professional Multi-Project',
        maxStorageGB: 250,
        maxContracts: 25,
        maxUsers: 50,
        precoMensal: 3890.0,
      },
      {
        tier: 'ENTERPRISE' as const,
        nome: 'Enterprise Unlimited',
        maxStorageGB: 2000,
        maxContracts: 200,
        maxUsers: 500,
        precoMensal: 8990.0,
      },
    ];

    for (const plan of plans) {
      await prisma.plan.upsert({
        where: { tier: plan.tier },
        update: {},
        create: plan,
      });
    }
  }

  /**
   * Associa uma organização a um plano inicial.
   */
  static async assignPlanToOrganization(
    organizationId: number,
    tier: 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' = 'STARTER'
  ) {
    await this.ensureDefaultPlans();
    const plan = await prisma.plan.findUniqueOrThrow({ where: { tier } });

    return prisma.subscription.upsert({
      where: { organizationId },
      update: {
        planId: plan.id,
        status: 'ACTIVE',
      },
      create: {
        organizationId,
        planId: plan.id,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });
  }

  /**
   * Verifica se a organização pode criar mais contratos com base na cota do seu plano ativo.
   */
  static async checkContractCreationLimit(organizationId: number): Promise<SubscriptionLimitCheckResult> {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    // Se não tiver assinatura configurada, adota limite padrão de segurança do Starter
    const maxContracts = subscription?.plan?.maxContracts ?? 5;
    const isSubscriptionActive = !subscription || subscription.status === 'ACTIVE' || subscription.status === 'TRIALING';

    if (!isSubscriptionActive) {
      return {
        allowed: false,
        reason: `Assinatura suspensa ou inadimplente (status: ${subscription?.status}). A criação de novos contratos está bloqueada.`,
        currentCount: 0,
        maxLimit: maxContracts,
      };
    }

    const currentContractsCount = await prisma.contract.count({
      where: {
        client: {
          organizationId,
        },
      },
    });

    if (currentContractsCount >= maxContracts) {
      return {
        allowed: false,
        reason: `Limite de contratos do plano atingido (${currentContractsCount}/${maxContracts}). Faça upgrade para adicionar mais empreendimentos.`,
        currentCount: currentContractsCount,
        maxLimit: maxContracts,
      };
    }

    return {
      allowed: true,
      currentCount: currentContractsCount,
      maxLimit: maxContracts,
    };
  }

  /**
   * Retorna o resumo de utilização de recursos da organização.
   */
  static async getUsageOverview(organizationId: number) {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      include: { plan: true },
    });

    const contractsCount = await prisma.contract.count({
      where: { client: { organizationId } },
    });

    const usersCount = await prisma.organizationMembership.count({
      where: { organizationId },
    });

    return {
      subscription: subscription ? {
        status: subscription.status,
        planName: subscription.plan.nome,
        tier: subscription.plan.tier,
        maxContracts: subscription.plan.maxContracts,
        maxUsers: subscription.plan.maxUsers,
        maxStorageGB: subscription.plan.maxStorageGB,
      } : null,
      usage: {
        contracts: contractsCount,
        users: usersCount,
      },
    };
  }
}
