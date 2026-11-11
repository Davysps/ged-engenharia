import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Organization Module & Tenant SaaS (Phase 2)', () => {
  const app = createApp();
  let testUserToken: string;
  let testUserId: number;
  const testEmail = `org-test-${Date.now()}@exemplo.com`;
  const orgSlug = `eng-corp-${Date.now()}`;

  beforeAll(async () => {
    const senhaHash = await bcrypt.hash('SenhaForte123!', 10);
    const user = await prisma.user.create({
      data: {
        nome: 'Engenheiro Chefe',
        email: testEmail,
        senhaHash,
        globalRole: 'USER',
      },
    });
    testUserId = user.id;

    const secret = process.env.JWT_SECRET || 'test_jwt_secret_12345';
    testUserToken = jwt.sign(
      { userId: user.id, globalRole: user.globalRole },
      secret,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Limpeza dos dados criados no teste
    await prisma.organization.deleteMany({
      where: { slug: { startsWith: 'eng-corp-' } },
    });
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it('GET /organizations sem autenticação deve retornar 401', async () => {
    const res = await request(app).get('/organizations');
    expect(res.status).toBe(401);
  });

  it('POST /organizations com dados válidos deve criar a Organização e vincular o usuário como ORG_ADMIN', async () => {
    const res = await request(app)
      .post('/organizations')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        nome: 'Engenharia Corporativa S/A',
        slug: orgSlug,
        cnpj: '12.345.678/0001-99',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('organization');
    expect(res.body.organization.nome).toBe('Engenharia Corporativa S/A');
    expect(res.body.organization.slug).toBe(orgSlug);
    expect(res.body.organization.role).toBe('ORG_ADMIN');

    // Validação direta no banco
    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: testUserId, organizationId: res.body.organization.id },
    });
    expect(membership).not.toBeNull();
    expect(membership?.role).toBe('ORG_ADMIN');
  });

  it('GET /organizations deve listar a organização da qual o usuário é membro', async () => {
    const res = await request(app)
      .get('/organizations')
      .set('Authorization', `Bearer ${testUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('organizations');
    expect(Array.isArray(res.body.organizations)).toBe(true);
    expect(res.body.organizations.length).toBeGreaterThanOrEqual(1);

    const found = res.body.organizations.find((o: any) => o.slug === orgSlug);
    expect(found).toBeDefined();
    expect(found.role).toBe('ORG_ADMIN');
  });

  it('POST /organizations com slug duplicado deve retornar 409', async () => {
    const res = await request(app)
      .post('/organizations')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({
        nome: 'Outra Empresa',
        slug: orgSlug,
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('slug já está em uso');
  });
});
