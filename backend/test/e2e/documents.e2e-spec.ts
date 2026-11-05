import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { DocumentEntity } from '../../src/database/entities';
import {
  API,
  Client,
  createUser,
  expectErrorEnvelope,
  TestApp,
  bootApp,
} from './helpers';

const MAX = 64 * 1024;
const TXT = 'Contenido SINTÉTICO de prueba — confidencial-demo-7f3a\nlínea 2\n';
const PDF = Buffer.from(
  '%PDF-1.4\n% documento sintético\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n',
);

describe('documentos: carga, autorización, cifrado, integridad y auditoría', () => {
  let t: TestApp;
  let admin: Client, editorA: Client, editorB: Client, reader: Client;
  let ids: {
    internal: string;
    confidential: string;
    restricted: string;
    ofB: string;
  };
  const blobs = () =>
    readdirSync(t.storageDir).filter((f) => !f.startsWith('.'));

  const upload = (
    c: Client,
    opts: {
      name?: string;
      content?: Buffer | string;
      type?: string;
      title?: string;
      classification?: string;
      extra?: Record<string, string>;
    } = {},
  ) => {
    const req = c
      .post('/documents')
      .field('title', opts.title ?? 'Acta sintética')
      .field('classification', opts.classification ?? 'internal');
    for (const [k, v] of Object.entries(opts.extra ?? {})) req.field(k, v);
    return req.attach(
      'file',
      Buffer.isBuffer(opts.content)
        ? opts.content
        : Buffer.from(opts.content ?? TXT),
      {
        filename: opts.name ?? 'acta.txt',
        contentType: opts.type ?? 'text/plain',
      },
    );
  };

  beforeAll(async () => {
    t = await bootApp({ UPLOAD_MAX_BYTES: String(MAX) });
    admin = (await createUser(t, 'admin', 'docadmin')).client;
    editorA = (await createUser(t, 'editor', 'editora')).client;
    editorB = (await createUser(t, 'editor', 'editorb')).client;
    reader = (await createUser(t, 'reader', 'lector')).client;
  });
  afterAll(() => t.close());

  it('carga cifrada: 201, metadatos sin material criptográfico, archivo en disco sin texto plano', async () => {
    const res = await upload(editorA, { name: 'acta-integración.txt' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Acta sintética',
      filename: 'acta-integración.txt',
      mimeType: 'text/plain; charset=utf-8',
      size: Buffer.byteLength(TXT),
      classification: 'internal',
      favorite: false,
      permissions: { canDownload: true, canDelete: true },
    });
    expect(res.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(res.body)).not.toEqual(
      expect.arrayContaining(['nonce', 'authTag', 'wrappedKey', 'keyId']),
    );
    const files = blobs();
    expect(files).toContain(`${res.body.id}.enc`);
    const onDisk = readFileSync(join(t.storageDir, `${res.body.id}.enc`));
    expect(onDisk.toString('utf8')).not.toContain('SINTÉTICO');
    expect(onDisk.length).toBe(Buffer.byteLength(TXT)); // GCM: sin relleno
    const [row] = await t.db.query(
      'SELECT LENGTH(nonce) n, LENGTH(auth_tag) t, key_id k FROM documents WHERE id = ?',
      [res.body.id],
    );
    expect({ n: Number(row.n), t: Number(row.t), k: row.k }).toEqual({
      n: 12,
      t: 16,
      k: 'k1',
    });

    const conf = await upload(editorA, {
      name: 'plan.pdf',
      content: PDF,
      type: 'application/pdf',
      classification: 'confidential',
    });
    const restr = await upload(editorA, {
      classification: 'restricted',
      title: 'Restringido sintético',
    });
    const ofB = await upload(editorB, { title: 'De B' });
    expect([conf.status, restr.status, ofB.status]).toEqual([201, 201, 201]);
    ids = {
      internal: res.body.id,
      confidential: conf.body.id,
      restricted: restr.body.id,
      ofB: ofB.body.id,
    };
    const nonces = await t.db.query(
      'SELECT COUNT(DISTINCT nonce) AS n, COUNT(*) AS total FROM documents',
    );
    expect(Number(nonces[0].n)).toBe(Number(nonces[0].total));
  });

  it('descarga autorizada devuelve el original con cabeceras seguras', async () => {
    const res = await editorA
      .get(`/documents/${ids.internal}/download`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect((res.body as Buffer).toString('utf8')).toBe(TXT);
    expect(res.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="acta-integraci_n.txt"; filename\*=UTF-8''acta-integraci%C3%B3n.txt$/,
    );
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['cache-control']).toBe('no-store');
    const pdf = await reader.get(`/documents/${ids.internal}/download`);
    expect(pdf.status).toBe(200);
  });

  it('lectura por rol y clasificación (lista y detalle)', async () => {
    const visible = async (c: Client) =>
      (await c.get('/documents?pageSize=100')).body.items
        .map((d: { id: string }) => d.id)
        .sort();
    expect(await visible(reader)).toEqual([ids.internal, ids.ofB].sort());
    expect(await visible(editorB)).toEqual(
      [ids.internal, ids.confidential, ids.ofB].sort(),
    );
    expect(await visible(editorA)).toEqual(Object.values(ids).sort());
    expect(await visible(admin)).toEqual(Object.values(ids).sort());

    // Ajeno no visible: 404 en detalle, descarga, borrado y favorito (sin revelar existencia).
    for (const path of [
      `/documents/${ids.restricted}`,
      `/documents/${ids.restricted}/download`,
    ]) {
      const r = await editorB.get(path);
      expect(r.status).toBe(404);
      expectErrorEnvelope(r.body, 'NOT_FOUND');
    }
    expect((await reader.get(`/documents/${ids.confidential}`)).status).toBe(
      404,
    );
    expect((await editorB.delete(`/documents/${ids.restricted}`)).status).toBe(
      404,
    );
    expect(
      (await reader.put(`/documents/${ids.confidential}/favorite`)).status,
    ).toBe(404);
    expect(
      (await admin.get(`/documents/${ids.restricted}/download`)).status,
    ).toBe(200);
    expect((await editorA.get('/documents/no-es-uuid')).status).toBe(404);
  });

  it('permisos de escritura: lector no sube ni borra; editor no borra ajenos; sin sesión 401', async () => {
    const r = await upload(reader);
    expect(r.status).toBe(403);
    expectErrorEnvelope(r.body, 'FORBIDDEN');
    expect((await reader.delete(`/documents/${ids.internal}`)).status).toBe(
      403,
    );
    const other = await editorB.delete(`/documents/${ids.internal}`);
    expect(other.status).toBe(403);
    expect(
      (await editorB.get(`/documents/${ids.internal}`)).body.permissions
        .canDelete,
    ).toBe(false);
    expect((await request(t.http).get(`${API}/documents`)).status).toBe(401);
    // CSRF obligatorio también en la carga.
    const noCsrf = await editorA.agent
      .post(`${API}/documents`)
      .field('title', 'x')
      .field('classification', 'internal')
      .attach('file', Buffer.from('x'), 'x.txt');
    expect(noCsrf.status).toBe(403);
    expect(noCsrf.body.code).toBe('CSRF_INVALID');
  });

  it('rechaza archivos inválidos sin dejar archivos ni registros', async () => {
    const before = {
      files: blobs().length,
      rows: await t.db.getRepository(DocumentEntity).count(),
    };
    type Opts = NonNullable<Parameters<typeof upload>[1]>;
    const cases: [Opts, number, string][] = [
      [
        {
          name: 'malware.exe',
          content: Buffer.from('MZ\x90\x00'),
          type: 'application/octet-stream',
        },
        415,
        'UNSUPPORTED_FILE_TYPE',
      ],
      [
        {
          name: 'falso.pdf',
          content: 'no soy un pdf',
          type: 'application/pdf',
        },
        415,
        'UNSUPPORTED_FILE_TYPE',
      ],
      [
        { name: 'binario.txt', content: Buffer.from([0x00, 0x01, 0x02]) },
        415,
        'UNSUPPORTED_FILE_TYPE',
      ],
      [
        { name: 'pagina.txt', content: TXT, type: 'text/html' },
        415,
        'UNSUPPORTED_FILE_TYPE',
      ],
      [{ name: 'vacio.txt', content: '' }, 400, 'INVALID_FILE'],
      [
        { name: 'grande.txt', content: 'x'.repeat(MAX + 1) },
        413,
        'PAYLOAD_TOO_LARGE',
      ],
      [{ classification: 'secreto' }, 400, 'VALIDATION_FAILED'],
      [{ title: '<script>alert(1)</script>' }, 400, 'VALIDATION_FAILED'],
      [
        { extra: { ownerId: '00000000-0000-4000-8000-000000000000' } },
        400,
        'VALIDATION_FAILED',
      ],
    ];
    for (const [opts, status, code] of cases) {
      const res = await upload(editorA, opts);
      const label = opts.name ?? opts.classification ?? opts.title ?? 'extra';
      expect([label, res.status]).toEqual([label, status]);
      expectErrorEnvelope(res.body, code);
    }
    const noFile = await editorA
      .post('/documents')
      .field('title', 'x')
      .field('classification', 'internal');
    expect(noFile.status).toBe(400);
    expect({
      files: blobs().length,
      rows: await t.db.getRepository(DocumentEntity).count(),
    }).toEqual(before);
  });

  it('si falla la BD tras escribir el archivo, se elimina el archivo cifrado', async () => {
    const before = blobs().length;
    const repo = t.app.get(DataSource).getRepository(DocumentEntity);
    const spy = jest
      .spyOn(Object.getPrototypeOf(repo), 'insert')
      .mockRejectedValueOnce(new Error('simulated'));
    const res = await upload(editorA);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expectErrorEnvelope(res.body, 'INTERNAL_ERROR');
    expect(blobs().length).toBe(before);
  });

  it('detecta manipulación: archivo alterado, tag alterado, archivos intercambiados, archivo ausente', async () => {
    const victim = (await upload(editorA, { title: 'Víctima' })).body
      .id as string;
    const other = (await upload(editorA, { title: 'Otro' })).body.id as string;
    const path = join(t.storageDir, `${victim}.enc`);
    const original = readFileSync(path);
    const expectIntegrity = async (id: string) => {
      const r = await editorA.get(`/documents/${id}/download`);
      expect(r.status).toBe(500);
      expectErrorEnvelope(r.body, 'DOCUMENT_INTEGRITY_FAILED');
      expect(r.headers['content-disposition']).toBeUndefined();
    };

    const flipped = Buffer.from(original);
    flipped[0] ^= 0x01;
    writeFileSync(path, flipped);
    await expectIntegrity(victim);

    writeFileSync(path, original);
    expect((await editorA.get(`/documents/${victim}/download`)).status).toBe(
      200,
    );
    await t.db.query(
      "UPDATE documents SET auth_tag = UNHEX(REPEAT('00', 16)) WHERE id = ?",
      [victim],
    );
    await expectIntegrity(victim);

    const [{ tag }] = await t.db.query(
      'SELECT HEX(auth_tag) AS tag FROM documents WHERE id = ?',
      [other],
    );
    expect(tag).toMatch(/^[0-9A-F]{32}$/);
    // Intercambiar el archivo de otro documento con el mismo tamaño: AAD distinta.
    writeFileSync(path, readFileSync(join(t.storageDir, `${other}.enc`)));
    await t.db.query(
      'UPDATE documents SET auth_tag = (SELECT auth_tag FROM (SELECT auth_tag FROM documents WHERE id = ?) x), nonce = (SELECT nonce FROM (SELECT nonce FROM documents WHERE id = ?) y) WHERE id = ?',
      [other, other, victim],
    );
    await expectIntegrity(victim);

    await t.db.query('UPDATE documents SET sha256 = ? WHERE id = ?', [
      '0'.repeat(64),
      other,
    ]);
    await expectIntegrity(other);

    const gone = (await upload(editorA, { title: 'Ausente' })).body
      .id as string;
    require('node:fs').rmSync(join(t.storageDir, `${gone}.enc`));
    await expectIntegrity(gone);

    const [{ n }] = await t.db.query(
      "SELECT COUNT(*) AS n FROM audit_events WHERE action = 'document.integrity_failed'",
    );
    expect(Number(n)).toBe(5);
  });

  it('borrado autorizado elimina registro, favoritos y archivo', async () => {
    const id = (await upload(editorA, { title: 'Para borrar' })).body
      .id as string;
    expect((await reader.put(`/documents/${id}/favorite`)).status).toBe(204);
    expect((await editorA.delete(`/documents/${id}`)).status).toBe(204);
    expect(blobs()).not.toContain(`${id}.enc`);
    expect(
      await t.db.query(
        'SELECT * FROM document_favorites WHERE document_id = ?',
        [id],
      ),
    ).toEqual([]);
    expect((await editorA.get(`/documents/${id}`)).status).toBe(404);
    expect((await editorA.delete(`/documents/${id}`)).status).toBe(404);
    const adminDel = (await upload(editorB, { title: 'Admin borra' })).body
      .id as string;
    expect((await admin.delete(`/documents/${adminDel}`)).status).toBe(204);
  });

  it('favoritos, filtros, orden, búsqueda parametrizada y paginación', async () => {
    expect(
      (await reader.put(`/documents/${ids.internal}/favorite`)).status,
    ).toBe(204);
    expect(
      (await reader.put(`/documents/${ids.internal}/favorite`)).status,
    ).toBe(204); // idempotente
    const favs = await reader.get('/documents?favorite=true');
    expect(favs.body.items.map((d: { id: string }) => d.id)).toEqual([
      ids.internal,
    ]);
    expect(favs.body.items[0].favorite).toBe(true);
    // El favorito es por usuario.
    expect(
      (await editorA.get(`/documents/${ids.internal}`)).body.favorite,
    ).toBe(false);
    expect(
      (await reader.delete(`/documents/${ids.internal}/favorite`)).status,
    ).toBe(204);
    expect((await reader.get('/documents?favorite=true')).body.total).toBe(0);

    const page = await editorA.get(
      '/documents?page=1&pageSize=2&sort=title&order=asc',
    );
    expect(page.body).toMatchObject({ page: 1, pageSize: 2 });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.total).toBeGreaterThan(2);
    const titles = page.body.items.map((d: { title: string }) => d.title);
    expect(
      [...titles].sort((a: string, b: string) => a.localeCompare(b)),
    ).toEqual(titles);

    expect(
      (
        await editorA.get('/documents?classification=confidential')
      ).body.items.map((d: { id: string }) => d.id),
    ).toEqual([ids.confidential]);
    expect(
      (await editorB.get('/documents?scope=mine')).body.items.every(
        (d: { owner: { id: string } }) => d.owner.id !== undefined,
      ),
    ).toBe(true);
    for (const search of ["' OR 1=1 --", '%', '_', '\\']) {
      const r = await reader.get(
        `/documents?search=${encodeURIComponent(search)}`,
      );
      expect(r.status).toBe(200);
      expect(r.body.total).toBe(0);
    }
    expect(
      (await reader.get('/documents?search=Acta')).body.total,
    ).toBeGreaterThan(0);
    for (const q of [
      'pageSize=101',
      'page=0',
      'sort=password_hash',
      'order=sideways',
      'favorite=maybe',
      'evil=1',
    ])
      expect((await reader.get(`/documents?${q}`)).status).toBe(400);
  });

  describe('usuarios y roles (IAM)', () => {
    it('solo admin lista/gestiona; sin autoescalamiento; último admin protegido; cambios revocan sesiones', async () => {
      expect((await editorA.get('/users')).status).toBe(403);
      const me = (await reader.get('/users/me')).body;
      expect(
        (await reader.patch(`/users/${me.id}`).send({ role: 'admin' })).status,
      ).toBe(403);
      const list = await admin.get('/users?pageSize=100');
      expect(list.status).toBe(200);
      expect(JSON.stringify(list.body)).not.toMatch(
        /argon2|password_hash|passwordHash/,
      );

      const adminMe = (await admin.get('/users/me')).body;
      const self = await admin
        .patch(`/users/${adminMe.id}`)
        .send({ role: 'reader' });
      expect(self.status).toBe(409);
      expectErrorEnvelope(self.body, 'SELF_MODIFICATION');

      // Último admin: un segundo admin intenta degradar al único otro admin activo.
      await t.db.query(
        "UPDATE users SET role = 'reader' WHERE role = 'admin' AND id <> ?",
        [adminMe.id],
      );
      const second = await createUser(t, 'reader', 'promovido');
      const promoted = await admin
        .patch(`/users/${second.user.id}`)
        .send({ role: 'admin' });
      expect(promoted.status).toBe(200);
      expect(promoted.body.role).toBe('admin');
      // La sesión del promovido se revocó; debe volver a entrar para obtener el rol nuevo.
      expect((await second.client.get('/users/me')).status).toBe(401);
      await second.client.login(second.email);
      await t.db.query("UPDATE users SET status = 'disabled' WHERE id = ?", [
        adminMe.id,
      ]);
      const last = await second.client
        .patch(`/users/${second.user.id}`)
        .send({ role: 'reader' });
      expect(last.status).toBe(409); // también es auto-modificación
      await t.db.query("UPDATE users SET status = 'active' WHERE id = ?", [
        adminMe.id,
      ]);
      await admin.login(
        (
          await t.db.query('SELECT email FROM users WHERE id = ?', [adminMe.id])
        )[0].email,
      );
      const demote = await second.client
        .patch(`/users/${adminMe.id}`)
        .send({ role: 'reader' });
      expect(demote.status).toBe(200);
      const lastAdmin = await second.client
        .patch(`/users/${adminMe.id}`)
        .send({ status: 'disabled' });
      expect(lastAdmin.status).toBe(200);

      // Usuario deshabilitado: no puede iniciar sesión.
      const blocked = await new Client(t.http).login(
        (
          await t.db.query('SELECT email FROM users WHERE id = ?', [adminMe.id])
        )[0].email,
      );
      expect(blocked.status).toBe(401);

      // Alta controlada por admin con rol asignado.
      const created = await second.client.post('/users').send({
        email: 'creado-por-admin@example.test',
        displayName: 'Creado',
        password: 'Prueba-Sintetica-2026',
        role: 'editor',
      });
      expect(created.status).toBe(201);
      expect(created.body.role).toBe('editor');
      expect(
        (
          await second.client
            .patch('/users/00000000-0000-4000-8000-000000000000')
            .send({ role: 'reader' })
        ).status,
      ).toBe(404);
      expect(
        (
          await second.client
            .patch(`/users/${me.id}`)
            .send({ role: 'superadmin' })
        ).status,
      ).toBe(400);
      expect(
        (await second.client.patch(`/users/${me.id}`).send({})).status,
      ).toBe(400);
      admin = second.client;
    });
  });

  describe('auditoría y reportes', () => {
    it('solo admin consulta eventos; los denegados quedan registrados', async () => {
      const denied = await reader.get('/audit-events');
      expect(denied.status).toBe(403);
      expect((await editorA.get('/reports/summary')).status).toBe(403);
      const res = await admin.get(
        '/audit-events?pageSize=100&action=access.denied',
      );
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(res.body.items[0]).toMatchObject({
        action: 'access.denied',
        outcome: 'denied',
        actor: { id: expect.any(String) },
      });
      const uploads = await admin.get(
        '/audit-events?action=document.upload&outcome=failure&pageSize=100',
      );
      // 5 archivos rechazados por contenido + 1 fallo simulado de BD.
      expect(uploads.body.total).toBe(6);
      expect((await admin.get('/audit-events?action=drop_table')).status).toBe(
        400,
      );
      expect((await admin.get('/audit-events?from=ayer')).status).toBe(400);
    });

    it('reporte agregado sin datos sensibles', async () => {
      const res = await admin.get('/reports/summary?days=7');
      expect(res.status).toBe(200);
      expect(res.body.documents.total).toBeGreaterThan(0);
      expect(res.body.documents.byClassification).toEqual(
        expect.objectContaining({
          internal: expect.any(Number),
          confidential: expect.any(Number),
          restricted: expect.any(Number),
        }),
      );
      expect(res.body.events.integrityFailures).toBe(5);
      expect(res.body.events.accessDenied).toBeGreaterThan(0);
      expect((await admin.get('/reports/summary?days=1000')).status).toBe(400);
    });

    it('los eventos no contienen contenido documental, contraseñas ni material de claves', async () => {
      const dump = JSON.stringify(
        await t.db.query('SELECT * FROM audit_events'),
      );
      expect(dump).not.toContain('SINTÉTICO');
      expect(dump).not.toContain('confidencial-demo-7f3a');
      expect(dump).not.toContain('Prueba-Sintetica-2026');
      expect(dump).not.toMatch(/argon2/);
      for (const k of Object.values(
        JSON.parse(readFileSync(require('./db-info').DB_INFO_FILE, 'utf8'))
          .keys as Record<string, string>,
      ))
        expect(dump).not.toContain(k);
      const rows = await t.db.query(
        'SELECT HEX(wrapped_key) w, HEX(nonce) n FROM documents',
      );
      for (const r of rows) {
        expect(dump).not.toContain(r.w);
        expect(dump.toUpperCase()).not.toContain(r.n);
      }
    });
  });
});
