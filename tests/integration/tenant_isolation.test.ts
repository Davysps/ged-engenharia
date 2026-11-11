import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Multi-Tenant Isolation & Cross-Tenant Boundary (Phase 3)', () => {
  const app = createApp();
  const secret = process.env.JWT_SECRET || 'test_jwt_secret_12345';

  let userAId: number;
  let userAToken: string;
  let orgAId: number;
  let contractAId: number;

  let userBId: number;
  let userBToken: string;
  let orgBId: number;
  let contractBId: number;

  beforeAll(async () => {
    const senhaHash = await bcrypt.hash('Senha123!', 10);

    // Criar Usuário A e Organização A
    const userA = await prisma.user.create({
      data: {
        nome: 'Usuario Org A',
        email: `usera-${Date.now()}@exemplo.com`,
        senhaHash,
      },
    });
    userAId = userA.id;
    userAToken = jwt.sign({ userId: userA.id, globalRole: 'USER' }, secret);

    const orgA = await prisma.organization.create({
      data: {
        nome: 'Organizacao Alfa',
        slug: `org-alfa-${Date.now()}`,
      },
    });
    orgAId = orgA.id;
    await prisma.organizationMembership.create({
      data: { organizationId: orgA.id, userId: userA.id, role: 'ORG_ADMIN' },
    });

    // Cliente e Contrato da Org A
    const clientA = await prisma.client.create({
      data: {
        nome: 'Cliente Exclusivo Org A',
        organizationId: orgA.id,
      },
    });
    const contractA = await prisma.contract.create({
      data: {
        nome: 'Contrato Confidencial A',
        codigo: `CONT-A-${Date.now()}`,
        clientId: clientA.id,
      },
    });
    contractAId = contractA.id;
    await prisma.contractMembership.create({
      data: { contractId: contractA.id, userId: userA.id, role: 'GESTOR' },
    });

    // Criar Usuário B e Organização B
    const userB = await prisma.user.create({
      data: {
        nome: 'Usuario Org B',
        email: `userb-${Date.now()}@exemplo.com`,
        senhaHash,
      },
    });
    userBId = userB.id;
    userBToken = jwt.sign({ userId: userB.id, globalRole: 'USER' }, secret);

    const orgB = await prisma.organization.create({
      data: {
        nome: 'Organizacao Beta',
        slug: `org-beta-${Date.now()}`,
      },
    });
    orgBId = orgB.id;
    await prisma.organizationMembership.create({
      data: { organizationId: orgB.id, userId: userB.id, role: 'ORG_ADMIN' },
    });

    // Cliente e Contrato da Org B
    const clientB = await prisma.client.create({
      data: {
        nome: 'Cliente Exclusivo Org B',
        organizationId: orgB.id,
      },
    });
    const contractB = await prisma.contract.create({
      data: {
        nome: 'Contrato Confidencial B',
        codigo: `CONT-B-${Date.now()}`,
        clientId: clientB.id,
      },
    });
    contractBId = contractB.id;
    await prisma.contractMembership.create({
      data: { contractId: contractB.id, userId: userB.id, role: 'GESTOR' },
    });
  });

  afterAll(async () => {
    // Limpeza
    await prisma.contractMembership.deleteMany({
      where: { contractId: { in: [contractAId, contractBId] } },
    });
    await prisma.contract.deleteMany({
      where: { id: { in: [contractAId, contractBId] } },
    });
    await prisma.client.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organizationMembership.deleteMany({
      where: { organizationId: { in: [orgAId, orgBId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [orgAId, orgBId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userAId, userBId] } },
    });
  });

  it('GET /projects com x-organization-id da Org A só deve listar contratos pertencentes à Org A', async () => {
    const res = await request(app)
      .get('/projects')
      .set('Authorization', `Bearer ${userAToken}`)
      .set('x-organization-id', String(orgAId));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].nome).toBe('Cliente Exclusivo Org A');

    // Garantir que nenhum dado da Org B vazou
    const nomesClientes = res.body.map((c: any) => c.nome);
    expect(nomesClientes).not.toContain('Cliente Exclusivo Org B');
  });

  it('GET /projects/:id - Usuário B não deve conseguir acessar contrato confidencial da Org A', async () => {
    const res = await request(app)
      .get(`/projects/${contractAId}`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Falha fechada: como o Usuário B não tem membership no contrato da Org A, o middleware/controller bloqueia (403 ou 404)
    expect([403, 404]).toContain(res.status);
  });

  it('GET /projects/:id/documents - Usuário B não deve conseguir listar documentos do contrato da Org A', async () => {
    const res = await request(app)
      .get(`/projects/${contractAId}/documents`)
      .set('Authorization', `Bearer ${userBToken}`);

    // Falha fechada: 403 ou 404
    expect([403, 404]).toContain(res.status);
  });
});
