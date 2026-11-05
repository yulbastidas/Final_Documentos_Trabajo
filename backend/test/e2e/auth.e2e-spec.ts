import request from 'supertest';
import {
  API,
  Client,
  codeAt,
  createUser,
  expectErrorEnvelope,
  ORIGIN,
  PASSWORD,
  TestApp,
  bootApp,
  uniqueEmail,
} from './helpers';

describe('identidad: registro, login, sesión, logout, expiración y MFA', () => {
  let t: TestApp;
  const secrets: string[] = [PASSWORD];

  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(() => t.close());

  const sessionCookie = (res: request.Response) =>
    ([] as string[])
      .concat(res.headers['set-cookie'] ?? [])
      .find((c) => c.startsWith('sd_session='));

  describe('registro', () => {
    it('crea la cuenta con rol reader y sin exponer el hash', async () => {
      const email = uniqueEmail('registro');
      const res = await request(t.http)
        .post(`${API}/auth/register`)
        .set('Origin', ORIGIN)
        .send({
          email: email.toUpperCase(),
          password: PASSWORD,
          displayName: 'Ana Prueba',
        });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        email,
        displayName: 'Ana Prueba',
        role: 'reader',
        mfaEnabled: false,
        status: 'active',
      });
      expect(res.body.permissions).toEqual([
        'documents:read',
        'documents:favorite',
      ]);
      expect(JSON.stringify(res.body)).not.toMatch(/argon2|password/i);
      const [row] = await t.db.query(
        'SELECT password_hash FROM users WHERE email = ?',
        [email],
      );
      expect(row.password_hash).toMatch(/^\$argon2id\$/);
    });

    it('impide autoasignarse un rol (campo no permitido)', async () => {
      const res = await request(t.http)
        .post(`${API}/auth/register`)
        .send({
          email: uniqueEmail('escala'),
          password: PASSWORD,
          displayName: 'Escala',
          role: 'admin',
        });
      expect(res.status).toBe(400);
      expectErrorEnvelope(res.body, 'VALIDATION_FAILED');
      expect(res.body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field: 'role' })]),
      );
    });

    it('valida correo, contraseña débil, nombre y duplicados', async () => {
      const bad = await request(t.http)
        .post(`${API}/auth/register`)
        .send({ email: 'no-es-correo', password: 'corta', displayName: '<b>' });
      expect(bad.status).toBe(400);
      expect(
        bad.body.details.map((d: { field: string }) => d.field).sort(),
      ).toEqual(['displayName', 'email']);
      const weak = await request(t.http)
        .post(`${API}/auth/register`)
        .send({
          email: uniqueEmail('debil'),
          password: 'Password1234',
          displayName: 'Débil',
        });
      expect(weak.status).toBe(400);
      expect(weak.body.details[0].field).toBe('password');
      const email = uniqueEmail('dup');
      await request(t.http)
        .post(`${API}/auth/register`)
        .send({ email, password: PASSWORD, displayName: 'Dup' })
        .expect(201);
      const dup = await request(t.http)
        .post(`${API}/auth/register`)
        .send({ email, password: PASSWORD, displayName: 'Dup' });
      expect(dup.status).toBe(409);
      expectErrorEnvelope(dup.body, 'EMAIL_ALREADY_REGISTERED');
    });

    it('rechaza solicitudes desde otro origen (CSRF de login/registro)', async () => {
      const res = await request(t.http)
        .post(`${API}/auth/register`)
        .set('Origin', 'https://atacante.example')
        .send({
          email: uniqueEmail('origen'),
          password: PASSWORD,
          displayName: 'Origen',
        });
      expect(res.status).toBe(403);
      expectErrorEnvelope(res.body, 'ORIGIN_NOT_ALLOWED');
      // Fuera de producción se admite el origen de la propia API (Swagger UI).
      const swagger = await request(t.http)
        .post(`${API}/auth/register`)
        .set('Origin', 'http://localhost:4000')
        .send({
          email: uniqueEmail('swagger'),
          password: PASSWORD,
          displayName: 'Swagger',
        });
      expect(swagger.status).toBe(201);
    });
  });

  describe('login, sesión y logout', () => {
    it('emite cookie HttpOnly SameSite=Strict, guarda solo el hash del token y exige CSRF', async () => {
      const { email } = await createUser(t, 'reader', 'sesion');
      const c = new Client(t.http);
      const res = await c.login(email);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('authenticated');
      const cookie = sessionCookie(res)!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).not.toMatch(/Secure/); // COOKIE_SECURE=false fuera de HTTPS
      const token = decodeURIComponent(cookie.split(';')[0].split('=')[1]);
      secrets.push(token, c.csrf);
      const rows = await t.db.query(
        'SELECT token_hash FROM sessions WHERE token_hash = ? OR token_hash = SHA2(?, 256)',
        [token, token],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].token_hash).not.toBe(token);

      expect((await c.get('/users/me')).body.email).toBe(email);
      const session = await c.get('/auth/session');
      expect(session.body.csrfToken).toBe(c.csrf);

      const noCsrf = await c.agent.post(`${API}/auth/logout`);
      expect(noCsrf.status).toBe(403);
      expectErrorEnvelope(noCsrf.body, 'CSRF_INVALID');
      const wrongCsrf = await c.agent
        .post(`${API}/auth/logout`)
        .set('X-CSRF-Token', 'x'.repeat(43));
      expect(wrongCsrf.status).toBe(403);

      const out = await c.post('/auth/logout');
      expect(out.status).toBe(204);
      expect(sessionCookie(out)).toMatch(/Expires=Thu, 01 Jan 1970/);
      // Reutilizar el token revocado no funciona.
      const reuse = await request(t.http)
        .get(`${API}/users/me`)
        .set('Cookie', `sd_session=${token}`);
      expect(reuse.status).toBe(401);
    });

    it('sin sesión: 401 AUTH_REQUIRED; token inventado: 401', async () => {
      const res = await request(t.http).get(`${API}/users/me`);
      expect(res.status).toBe(401);
      expectErrorEnvelope(res.body, 'AUTH_REQUIRED');
      const fake = await request(t.http)
        .get(`${API}/users/me`)
        .set('Cookie', 'sd_session=' + 'A'.repeat(43));
      expect(fake.status).toBe(401);
    });

    it('credenciales incorrectas y usuario inexistente dan la misma respuesta', async () => {
      const { email } = await createUser(t, 'reader', 'malpass');
      const a = await new Client(t.http).login(email, 'Otra-Clave-Erronea-1');
      const b = await new Client(t.http).login(uniqueEmail('noexiste'));
      for (const r of [a, b]) {
        expect(r.status).toBe(401);
        expectErrorEnvelope(r.body, 'INVALID_CREDENTIALS');
        expect(sessionCookie(r)).toBeUndefined();
      }
      expect(a.body.message).toBe(b.body.message);
    });

    it('bloquea temporalmente tras 5 fallos, incluso con la contraseña correcta', async () => {
      const { email } = await createUser(t, 'reader', 'bloqueo');
      for (let i = 0; i < 5; i++)
        expect(
          (await new Client(t.http).login(email, 'Incorrecta-Clave-' + i))
            .status,
        ).toBe(401);
      expect((await new Client(t.http).login(email)).status).toBe(401);
      const [u] = await t.db.query(
        'SELECT locked_until FROM users WHERE email = ?',
        [email],
      );
      expect(u.locked_until).not.toBeNull();
      await t.db.query(
        'UPDATE users SET locked_until = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE WHERE email = ?',
        [email],
      );
      expect((await new Client(t.http).login(email)).status).toBe(200);
    });

    it('expira por inactividad y por tiempo absoluto', async () => {
      const { user, client } = await createUser(t, 'reader', 'expira');
      await t.db.query(
        'UPDATE sessions SET idle_expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE user_id = ?',
        [user.id],
      );
      const idle = await client.get('/users/me');
      expect(idle.status).toBe(401);
      expectErrorEnvelope(idle.body, 'SESSION_EXPIRED');
      expect(String(idle.headers['set-cookie'])).toMatch(/sd_session=;/);

      await client.login(user.email);
      await t.db.query(
        'UPDATE sessions SET absolute_expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE user_id = ? AND revoked_at IS NULL',
        [user.id],
      );
      expect((await client.get('/users/me')).body.code).toBe('SESSION_EXPIRED');
      const [ev] = await t.db.query(
        "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'auth.session.expired' AND actor_id = ?",
        [user.id],
      );
      expect(Number(ev.n)).toBe(2);
    });

    it('la renovación por actividad nunca supera la expiración absoluta', async () => {
      const { user, client } = await createUser(t, 'reader', 'renueva');
      await t.db.query(
        'UPDATE sessions SET last_seen_at = UTC_TIMESTAMP(3) - INTERVAL 5 MINUTE, absolute_expires_at = UTC_TIMESTAMP(3) + INTERVAL 2 MINUTE WHERE user_id = ?',
        [user.id],
      );
      const res = await client.get('/auth/session');
      expect(res.status).toBe(200);
      expect(new Date(res.body.idleExpiresAt).getTime()).toBeLessThanOrEqual(
        new Date(res.body.absoluteExpiresAt).getTime(),
      );
    });
  });

  describe('MFA TOTP', () => {
    it('enrolamiento, desafío, protección de reutilización, recuperación y desactivación', async () => {
      const { email, user, client } = await createUser(t, 'editor', 'mfa');
      const other = new Client(t.http);
      await other.login(email); // segunda sesión, se revoca al activar MFA

      expect(
        (await client.post('/auth/mfa/confirm').send({ code: '123456' })).body
          .code,
      ).toBe('MFA_SETUP_REQUIRED');
      const setup = await client.post('/auth/mfa/setup');
      expect(setup.status).toBe(200);
      const secret: string = setup.body.secret;
      secrets.push(secret);
      expect(setup.body.otpauthUri).toContain(`secret=${secret}`);

      const wrong = await client
        .post('/auth/mfa/confirm')
        .send({ code: codeAt(secret, 5) });
      expect(wrong.status).toBe(401);
      expectErrorEnvelope(wrong.body, 'MFA_INVALID');
      const confirmCode = codeAt(secret);
      const confirm = await client
        .post('/auth/mfa/confirm')
        .send({ code: confirmCode });
      expect(confirm.status).toBe(200);
      const recovery: string[] = confirm.body.recoveryCodes;
      expect(recovery).toHaveLength(10);
      expect(new Set(recovery).size).toBe(10);
      secrets.push(...recovery);
      expect((await client.post('/auth/mfa/setup')).body.code).toBe(
        'MFA_ALREADY_ENABLED',
      );
      expect((await other.get('/users/me')).status).toBe(401);
      expect((await client.get('/users/me')).body.mfaEnabled).toBe(true);

      // Secreto cifrado y códigos con HMAC: nada legible en la BD.
      const [row] = await t.db.query(
        'SELECT mfa_secret_enc, mfa_pending_secret_enc FROM users WHERE id = ?',
        [user.id],
      );
      expect(row.mfa_pending_secret_enc).toBeNull();
      expect(Buffer.from(row.mfa_secret_enc).toString('latin1')).not.toContain(
        secret,
      );
      const codes = await t.db.query(
        'SELECT code_hash FROM mfa_recovery_codes WHERE user_id = ?',
        [user.id],
      );
      expect(codes).toHaveLength(10);
      for (const c of codes)
        for (const r of recovery)
          expect(c.code_hash).not.toContain(r.replace('-', ''));

      // Login con MFA: no hay cookie hasta completar el desafío.
      const c2 = new Client(t.http);
      const step1 = await c2.login(email);
      expect(step1.status).toBe(200);
      expect(step1.body).toEqual({
        status: 'mfa_required',
        challengeId: expect.any(String),
        expiresAt: expect.any(String),
      });
      expect(sessionCookie(step1)).toBeUndefined();
      expect((await c2.get('/users/me')).status).toBe(401);
      secrets.push(step1.body.challengeId);

      // El código ya usado en la confirmación no sirve de nuevo (anti-replay).
      expect(
        (
          await c2.verifyMfa({
            challengeId: step1.body.challengeId,
            code: confirmCode,
          })
        ).status,
      ).toBe(401);
      const ok = await c2.verifyMfa({
        challengeId: step1.body.challengeId,
        code: codeAt(secret, 1),
      });
      expect(ok.status).toBe(200);
      expect(sessionCookie(ok)).toMatch(/HttpOnly/);
      expect((await c2.get('/users/me')).body.email).toBe(email);
      // Desafío consumido: no puede reutilizarse.
      expect(
        (
          await new Client(t.http).verifyMfa({
            challengeId: step1.body.challengeId,
            code: codeAt(secret, 1),
          })
        ).status,
      ).toBe(401);

      // Desafío con intentos limitados.
      const c3 = new Client(t.http);
      const ch = (await c3.login(email)).body.challengeId;
      for (let i = 0; i < 5; i++)
        expect(
          (await c3.verifyMfa({ challengeId: ch, code: '000000' })).status,
        ).toBe(401);
      expect(
        (await c3.verifyMfa({ challengeId: ch, recoveryCode: recovery[0] }))
          .status,
      ).toBe(401);

      // Desafío expirado.
      const c4 = new Client(t.http);
      const ch4 = (await c4.login(email)).body.challengeId;
      await t.db.query(
        'UPDATE mfa_challenges SET expires_at = UTC_TIMESTAMP(3) - INTERVAL 1 SECOND WHERE user_id = ? AND consumed_at IS NULL',
        [user.id],
      );
      expect(
        (await c4.verifyMfa({ challengeId: ch4, recoveryCode: recovery[0] }))
          .status,
      ).toBe(401);

      // Código de recuperación: un solo uso.
      const c5 = new Client(t.http);
      const r1 = await c5.verifyMfa({
        challengeId: (await c5.login(email)).body.challengeId,
        recoveryCode: recovery[0],
      });
      expect(r1.status).toBe(200);
      const c6 = new Client(t.http);
      expect(
        (
          await c6.verifyMfa({
            challengeId: (await c6.login(email)).body.challengeId,
            recoveryCode: recovery[0],
          })
        ).status,
      ).toBe(401);
      const r2 = await c6.verifyMfa({
        challengeId: (await c6.login(email)).body.challengeId,
        recoveryCode: recovery[1].toLowerCase(),
      });
      expect(r2.status).toBe(200);

      // Validación del cuerpo del desafío.
      expect(
        (await new Client(t.http).verifyMfa({ challengeId: 'x' })).status,
      ).toBe(400);

      // Desactivar exige contraseña y TOTP válidos.
      expect(
        (
          await c2
            .post('/auth/mfa/disable')
            .send({ password: 'Incorrecta-Clave-9', code: codeAt(secret, -1) })
        ).status,
      ).toBe(401);
      const disabled = await c2
        .post('/auth/mfa/disable')
        .send({ password: PASSWORD, code: codeAt(secret, -1) });
      // El paso -1 es anterior al último usado: rechazado por anti-replay.
      expect(disabled.status).toBe(401);
      await t.db.query(
        'UPDATE users SET mfa_last_used_step = mfa_last_used_step - 3 WHERE id = ?',
        [user.id],
      );
      expect(
        (
          await c2
            .post('/auth/mfa/disable')
            .send({ password: PASSWORD, code: codeAt(secret) })
        ).status,
      ).toBe(204);
      expect((await c2.get('/users/me')).body.mfaEnabled).toBe(false);
      expect((await new Client(t.http).login(email)).body.status).toBe(
        'authenticated',
      );
    });
  });

  describe('auditoría de identidad', () => {
    it('registra eventos reales sin contraseñas, tokens, secretos ni códigos', async () => {
      const rows: { action: string; outcome: string }[] = await t.db.query(
        'SELECT action, outcome FROM audit_events',
      );
      const seen = new Set(rows.map((r) => `${r.action}:${r.outcome}`));
      for (const e of [
        'auth.register:success',
        'auth.register:failure',
        'auth.login:success',
        'auth.login:failure',
        'auth.login.locked:failure',
        'auth.logout:success',
        'auth.session.expired:denied',
        'auth.mfa.enroll:success',
        'auth.mfa.confirm:success',
        'auth.mfa.confirm:failure',
        'auth.mfa.challenge:success',
        'auth.mfa.verify:success',
        'auth.mfa.verify:failure',
        'auth.mfa.recovery_used:success',
        'auth.mfa.disable:success',
        'auth.mfa.disable:failure',
      ])
        expect(seen).toContain(e);
      const dump = JSON.stringify(
        await t.db.query('SELECT * FROM audit_events'),
      );
      expect(secrets.length).toBeGreaterThan(14);
      for (const s of secrets) expect(dump).not.toContain(s);
      expect(dump).not.toMatch(/argon2/);
    });
  });
});
