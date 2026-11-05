import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { DataSource } from 'typeorm';
import { totp } from '../../src/crypto/totp';
import { base32Decode } from '../../src/crypto/totp';
import { DB_INFO_FILE, type DbInfo } from './db-info';

export const API = '/api/v1';
export const ORIGIN = 'http://localhost:3000';
export const PASSWORD = 'Prueba-Sintetica-2026';

export interface TestApp {
  app: INestApplication;
  http: ReturnType<INestApplication['getHttpServer']>;
  storageDir: string;
  db: DataSource;
  close: () => Promise<void>;
}

/** Levanta la API completa contra la base de prueba. Llamar una vez por archivo. */
export async function bootApp(
  extra: Record<string, string> = {},
): Promise<TestApp> {
  const info = JSON.parse(readFileSync(DB_INFO_FILE, 'utf8')) as DbInfo;
  const storageDir = mkdtempSync(join(tmpdir(), 'securedocs-storage-'));
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DB_ENABLED: 'true',
    DB_HOST: info.host,
    DB_PORT: String(info.port),
    DB_USER: info.user,
    DB_PASSWORD: info.password,
    DB_NAME: info.database,
    FRONTEND_ORIGIN: ORIGIN,
    STORAGE_DIR: storageDir,
    RATE_LIMIT_PER_MINUTE: '100000',
    AUTH_RATE_LIMIT_PER_MINUTE: '100000',
    DOCUMENT_KEK_ID: 'k1',
    ...info.keys,
    ...extra,
  });
  const { AppModule } = await import('../../src/app.module');
  const { configureApp } = await import('../../src/app.setup');
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return {
    app,
    http: app.getHttpServer(),
    storageDir,
    db: app.get(DataSource),
    close: async () => {
      await app.close();
      rmSync(storageDir, { recursive: true, force: true });
    },
  };
}

export const uniqueEmail = (prefix: string) =>
  `${prefix}-${randomUUID().slice(0, 8)}@example.test`;

/** Cliente con cookie de sesión y token CSRF, como lo haría el navegador. */
export class Client {
  readonly agent: TestAgent;
  csrf = '';
  constructor(http: TestApp['http']) {
    this.agent = request.agent(http);
  }
  async login(email: string, password = PASSWORD) {
    const res = await this.agent
      .post(`${API}/auth/login`)
      .send({ email, password });
    if (res.body?.csrfToken) this.csrf = res.body.csrfToken;
    return res;
  }
  async verifyMfa(body: Record<string, string>) {
    const res = await this.agent.post(`${API}/auth/mfa/verify`).send(body);
    if (res.body?.csrfToken) this.csrf = res.body.csrfToken;
    return res;
  }
  get(path: string) {
    return this.agent.get(`${API}${path}`);
  }
  post(path: string) {
    return this.agent.post(`${API}${path}`).set('X-CSRF-Token', this.csrf);
  }
  put(path: string) {
    return this.agent.put(`${API}${path}`).set('X-CSRF-Token', this.csrf);
  }
  patch(path: string) {
    return this.agent.patch(`${API}${path}`).set('X-CSRF-Token', this.csrf);
  }
  delete(path: string) {
    return this.agent.delete(`${API}${path}`).set('X-CSRF-Token', this.csrf);
  }
}

export async function createUser(
  t: TestApp,
  role: 'admin' | 'editor' | 'reader',
  prefix: string = role,
) {
  const { UsersService } = await import('../../src/users/users.service');
  const email = uniqueEmail(prefix);
  const user = await t.app.get(UsersService).create({
    email,
    displayName: `${prefix} Prueba`,
    password: PASSWORD,
    role,
  });
  const client = new Client(t.http);
  const res = await client.login(email);
  if (res.status !== 200) throw new Error(`login ${res.status}`);
  return { user, email, client };
}

export const codeAt = (secretBase32: string, offsetSteps = 0) =>
  totp(base32Decode(secretBase32), Date.now() + offsetSteps * 30_000);

/** El sobre de error nunca debe incluir trazas u otras claves internas. */
export function expectErrorEnvelope(
  body: Record<string, unknown>,
  code: string,
) {
  expect(body.code).toBe(code);
  expect(typeof body.message).toBe('string');
  expect(typeof body.requestId).toBe('string');
  for (const k of Object.keys(body))
    expect(['code', 'message', 'requestId', 'details']).toContain(k);
  expect(JSON.stringify(body)).not.toMatch(
    /at \w+ \(|\.ts:\d+|QueryFailedError|SELECT |INSERT /,
  );
}
