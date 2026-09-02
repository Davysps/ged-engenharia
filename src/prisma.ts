import 'dotenv/config'; // Garante que o .env é carregado antes de tudo
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { getTenantContractId } from './lib/tenantContext';

const connectionString = process.env.DATABASE_URL!;

// Configura o Pool de conexões e o Adaptador Oficial exigido pelo Prisma 7
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

/**
 * ETAPA 2.2 — Isolamento Multi-Tenant (Segurança).
 *
 * O identificador do tenant no nosso modelo é o `contractId` (a unidade
 * isolada é o Contrato). Estes são os únicos modelos que possuem a coluna
 * `contractId` de forma direta e, portanto, recebem o filtro automático.
 *
 * Modelos de fora do conjunto:
 * - Globais (User, Client, Contract): não são propriedade de um contrato.
 *   O Contract é ele próprio o tenant — filtrá-lo por `contractId`
 *   seria um erro de schema.
 * - Filhas (Revision, ApprovalWorkflow, TransmittalItem, TimeLog,
 *   DocumentLink): não possuem a FK direta; o isolamento é herdado pelos
 *   filtros relacionais que os services já aplicam (ex: document.contractId).
 */
const TENANT_SCOPED_MODELS = new Set<string>([
  'ContractDiscipline',
  'ContractMembership',
  'Document',
  'Transmittal',
  'WorkPackage',
  'AuditLog',
]);

// Operações que aceitam `where` e recebem o filtro automático de tenant.
const WHERE_OPERATIONS = new Set<string>([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

// Operações de criação que recebem o contractId automático quando ausente.
const CREATE_OPERATIONS = new Set<string>(['create', 'createMany', 'createManyAndReturn']);

// Exporta a instância única e configurada para o resto do sistema.
export const prisma = new PrismaClient({ adapter }).$extends({
  name: 'tenantIsolation',
  query: {
    async $allOperations({ model, operation, args, query }) {
      const contractId = getTenantContractId();

      // 1. Sem tenant ativo no AsyncLocalStorage (rota pública, webhook interno,
      //    ou rota autenticada sem contractId no request): a query passa exatamente
      //    como antes — o desenvolvedor segue responsável pelo filtro manual.
      if (!contractId) return query(args);

      // 2. Modelos que não possuem a coluna `contractId` (globais/filhas).
      if (!model || !TENANT_SCOPED_MODELS.has(model)) return query(args);

      const safeArgs = args as Record<string, unknown>;

      // 3. Injeção automática do tenant no `where` — cobre leituras, contagens,
      //    agregações e mutações sem depender de o dev lembrar do filtro.
      if (WHERE_OPERATIONS.has(operation)) {
        const currentWhere = (safeArgs.where ?? {}) as Record<string, unknown>;
        safeArgs.where = { ...currentWhere, contractId };
      }

      // 4. Injeção automática do tenant nos dados de criação (create/upsert),
      //    APENAS quando o dev não forneceu a FK escalar nem o relation object
      //    `contract` — evita conflito com o padrão `contract: { connect }`
      //    usado pelo AuditService (Prisma não aceita FK escalar + relation juntos).
      if (operation === 'create' || operation === 'upsert') {
        const createData = operation === 'upsert' ? safeArgs.create : safeArgs.data;
        if (
          createData &&
          typeof createData === 'object' &&
          !Array.isArray(createData)
        ) {
          const data = createData as Record<string, unknown>;
          if (!('contractId' in data) && !('contract' in data)) {
            data.contractId = contractId;
          }
        }
      }

      // createMany / createManyAndReturn: `data` é um array de objetos.
      if (CREATE_OPERATIONS.has(operation) && Array.isArray(safeArgs.data)) {
        for (const item of safeArgs.data as Record<string, unknown>[]) {
          if (!('contractId' in item) && !('contract' in item)) {
            item.contractId = contractId;
          }
        }
      }

      return query(safeArgs);
    },
  },
});