import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

describe('Server & Healthcheck Endpoints', () => {
  const app = createApp();

  it('GET /health deve retornar status 200 com status "ok"', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('POST /auth/login sem payload deve retornar 400 com validação Zod', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /projects sem token de autorização deve retornar 401', async () => {
    const res = await request(app).get('/projects');
    expect(res.status).toBe(401);
  });
});
