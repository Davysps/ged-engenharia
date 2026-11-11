import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../../src/prisma';
import bcrypt from 'bcrypt';

describe('AuditLog Immutability & Compliance (Phase 4)', () => {
  let userId: number;
  let contractId: number;
  let auditLogId: number;

  beforeAll(async () => {
    const senhaHash = await bcrypt.hash('Senha123!', 10);
    const user = await prisma.user.create({
      data: {
        nome: 'Usuario Auditoria',
        email: `audit-test-${Date.now()}@exemplo.com`,
        senhaHash,
      },
    });
    userId = user.id;

    const client = await prisma.client.create({
      data: {
        nome: 'Cliente Auditoria',
      },
    });

    const contract = await prisma.contract.create({
      data: {
        nome: 'Contrato Auditoria',
        codigo: `AUDIT-CONT-${Date.now()}`,
        clientId: client.id,
      },
    });
    contractId = contract.id;

    // Criar um registro inicial de auditoria
    const log = await prisma.auditLog.create({
      data: {
        userId,
        contractId,
        action: 'TEST_AUDIT_ACTION',
        entity: 'DOCUMENT',
        entityId: 1,
        details: { info: 'Registro inicial imutável' },
      },
    });
    auditLogId = log.id;
  });

  afterAll(async () => {
    // Como a extensão protege AuditLog de delete, usamos o pool/query bruta apenas para o teardown limpo do teste
    // ou deixamos persistido caso RLS/Trigger bloqueie.
  });

  it('Tentativa de UPDATE em AuditLog deve ser terminantemente bloqueada com erro', async () => {
    await expect(
      prisma.auditLog.update({
        where: { id: auditLogId },
        data: { action: 'MODIFIED_ACTION' },
      })
    ).rejects.toThrow(/Operações de modificação ou exclusão em AuditLog são estritamente proibidas/);
  });

  it('Tentativa de UPDATE MANY em AuditLog deve ser terminantemente bloqueada com erro', async () => {
    await expect(
      prisma.auditLog.updateMany({
        where: { id: auditLogId },
        data: { action: 'MASS_ALTER' },
      })
    ).rejects.toThrow(/Operações de modificação ou exclusão em AuditLog são estritamente proibidas/);
  });

  it('Tentativa de DELETE em AuditLog deve ser terminantemente bloqueada com erro', async () => {
    await expect(
      prisma.auditLog.delete({
        where: { id: auditLogId },
      })
    ).rejects.toThrow(/Operações de modificação ou exclusão em AuditLog são estritamente proibidas/);
  });

  it('Tentativa de DELETE MANY em AuditLog deve ser terminantemente bloqueada com erro', async () => {
    await expect(
      prisma.auditLog.deleteMany({
        where: { id: auditLogId },
      })
    ).rejects.toThrow(/Operações de modificação ou exclusão em AuditLog são estritamente proibidas/);
  });

  it('Leitura e consulta de AuditLog permanecem íntegras', async () => {
    const log = await prisma.auditLog.findUnique({
      where: { id: auditLogId },
    });
    expect(log).not.toBeNull();
    expect(log?.action).toBe('TEST_AUDIT_ACTION');
    expect(log?.entity).toBe('DOCUMENT');
  });
});
