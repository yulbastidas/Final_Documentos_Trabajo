import { Test } from '@nestjs/testing';
import request from 'supertest';
import { API } from './helpers';

// DB_ENABLED=false: solo salud. Las rutas de identidad y documentos no existen
// (404) y readiness informa que la base de datos está desactivada (503).
describe('API sin base de datos', () => {
  it('liveness 200, readiness 503 y sin rutas protegidas', async () => {
    Object.assign(process.env, { DB_ENABLED: 'false', NODE_ENV: 'test' });
    const { AppModule } = await import('../../src/app.module');
    const { configureApp } = await import('../../src/app.setup');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    try {
      expect(
        (await request(app.getHttpServer()).get(`${API}/health`)).status,
      ).toBe(200);
      const ready = await request(app.getHttpServer()).get(
        `${API}/health/ready`,
      );
      expect(ready.status).toBe(503);
      expect(ready.body).toEqual({
        status: 'not_ready',
        checks: { database: 'disabled', storage: 'disabled' },
      });
      expect(
        (await request(app.getHttpServer()).post(`${API}/auth/login`)).status,
      ).toBe(404);
      expect(
        (await request(app.getHttpServer()).get(`${API}/documents`)).status,
      ).toBe(404);
    } finally {
      await app.close();
    }
  });
});
