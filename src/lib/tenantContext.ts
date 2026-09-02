import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Contexto assíncrono da requisição (Etapa 2.2 — Isolamento Multi-Tenant).
 *
 * No nosso modelo, a unidade isolada (tenant) é o CONTRATO. Não existe uma
 * coluna `tenantId`: o identificador do tenant é o `contractId`, presente
 * nas tabelas que pertencem a um contrato (Document, Transmittal,
 * WorkPackage, ContractDiscipline, ContractMembership, AuditLog).
 *
 * Como um usuário pode ser membro de VÁRIOS contratos, o tenant ativo de
 * uma requisição NÃO vem do JWT (que carrega apenas userId/globalRole) e sim
 * da própria requisição — query string (`?contractId=`), rota
 * (`/contracts/:contractId/...`) ou body. O AsyncLocalStorage propaga esse
 * contexto por toda a cadeia de operações assíncronas da requisição,
 * permitindo que a extensão do Prisma injete o filtro automaticamente.
 */
export interface TenantContext {
  userId?: number;
  contractId?: number;
}

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

/** Retorna o contexto completo do tenant ativo (ou undefined fora de uma requisição). */
export function getTenantContext(): TenantContext | undefined {
  return tenantStorage.getStore();
}

/** ID do usuário autenticado ativo na requisição. */
export function getTenantUserId(): number | undefined {
  return getTenantContext()?.userId;
}

/** ID do contrato (tenant) ativo na requisição. */
export function getTenantContractId(): number | undefined {
  return getTenantContext()?.contractId;
}

/**
 * Executa uma função dentro do contexto de tenant informado.
 * O middleware de autenticação usa este helper para envolver o `next()` do
 * Express, garantindo que o handler e todas as suas queries herdaram o
 * contexto via AsyncLocalStorage.
 */
export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return tenantStorage.run(ctx, fn);
}