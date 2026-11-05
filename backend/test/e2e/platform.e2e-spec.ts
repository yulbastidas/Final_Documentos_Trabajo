import request from 'supertest';
import {
  API,
  Client,
  createUser,
  expectErrorEnvelope,
  ORIGIN,
  TestApp,
  bootApp,
} from './helpers';

describe('límites, cabeceras, errores y salud', () => {
  let t: TestApp;
  let reader: Client;
  beforeAll(async () => {
    t = await bootApp({ AUTH_RATE_LIMIT_PER_MINUTE: '4' });
    reader = (await createUser(t, 'reader', 'limite')).client; // consume 1 intento
  });
  afterAll(() => t.close());

  it('limita intentos de login por IP con 429 y sobre de error', async () => {
    const statuses: number[] = [];
    let last: request.Response | undefined;
    for (let i = 0; i < 5; i++) {
      last = await new Client(t.http).login(
        'nadie@example.test',
        'Incorrecta-Clave-1',
      );
      statuses.push(last.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429, 429]);
    expectErrorEnvelope(last!.body, 'RATE_LIMITED');
    expect(last!.headers['retry-after-auth']).toBeDefined();
  });

  it('el límite estricto no afecta a rutas sin @AuthRateLimit', async () => {
    for (let i = 0; i < 6; i++)
      expect((await reader.get('/users/me')).status).toBe(200);
  });

  it('liveness y readiness son distintos', async () => {
    const live = await request(t.http).get(`${API}/health`);
    expect(live.body).toEqual({
      status: 'ok',
      service: 'securedocs-api',
      version: '0.1.0',
    });
    const ready = await request(t.http).get(`${API}/health/ready`);
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({
      status: 'ready',
      checks: { database: 'up', storage: 'up' },
    });
  });

  it('cabeceras de seguridad, CORS con credenciales y requestId', async () => {
    const res = await request(t.http)
      .get(`${API}/health`)
      .set('Origin', ORIGIN)
      .set('X-Request-Id', 'prueba-req-12345');
    expect(res.headers['x-request-id']).toBe('prueba-req-12345');
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
    const evil = await request(t.http)
      .get(`${API}/health`)
      .set('Origin', 'https://atacante.example');
    // cors responde siempre con el origen permitido; el navegador bloquea otro origen.
    expect(evil.headers['access-control-allow-origin']).toBe(ORIGIN);
    const bad = await request(t.http)
      .get(`${API}/health`)
      .set('X-Request-Id', '<script>');
    expect(bad.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('errores sin trazas: 404, JSON malformado y cuerpo excesivo', async () => {
    const nf = await request(t.http).get(`${API}/no-existe`);
    expect(nf.status).toBe(404);
    expectErrorEnvelope(nf.body, 'NOT_FOUND');
    const malformed = await request(t.http)
      .post(`${API}/auth/login`)
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(malformed.status).toBe(400);
    expectErrorEnvelope(malformed.body, 'BAD_REQUEST');
    const huge = await request(t.http)
      .post(`${API}/auth/register`)
      .send({
        email: 'x@example.test',
        password: 'p'.repeat(200_000),
        displayName: 'X',
      });
    expect(huge.status).toBe(413);
    expectErrorEnvelope(huge.body, 'PAYLOAD_TOO_LARGE');
  });

  it('Swagger publica el contrato con las rutas implementadas', async () => {
    const doc = (await request(t.http).get('/api/docs-json')).body;
    for (const p of [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/mfa/verify',
      '/api/v1/auth/session',
      '/api/v1/auth/logout',
      '/api/v1/auth/mfa/setup',
      '/api/v1/auth/mfa/confirm',
      '/api/v1/auth/mfa/disable',
      '/api/v1/auth/mfa/recovery-codes',
      '/api/v1/users/me',
      '/api/v1/users',
      '/api/v1/users/{id}',
      '/api/v1/documents',
      '/api/v1/documents/{id}',
      '/api/v1/documents/{id}/download',
      '/api/v1/documents/{id}/favorite',
      '/api/v1/audit-events',
      '/api/v1/reports/summary',
      '/api/v1/health',
      '/api/v1/health/ready',
    ])
      expect(Object.keys(doc.paths)).toContain(p);
    expect(doc.components.securitySchemes).toHaveProperty('csrf');
  });
});
