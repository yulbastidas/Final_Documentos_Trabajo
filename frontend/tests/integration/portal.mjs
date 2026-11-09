import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { chromium, expect as playwrightExpect } from '@playwright/test';

const expect = playwrightExpect.configure({ timeout: 15000 });
const origin = process.env.PORTAL_TEST_ORIGIN ?? 'http://localhost:8080';
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;
assert.ok(
  adminEmail && adminPassword,
  'Se necesita un administrador sintético recién creado.',
);
const suffix = randomBytes(6).toString('hex');
const reader = {
  email: 'lector-' + suffix + '@example.test',
  password: 'Prueba-' + randomBytes(18).toString('hex'),
};
const title = 'Documento de integración ' + suffix;
const contents = 'Contenido sintético para la prueba de descarga.';
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const main = page.getByRole('main');
  const heading = (name) =>
    main.getByRole('heading', { name, level: 1, exact: true });
  const button = (name) => main.getByRole('button', { name, exact: true });
  async function login(email, password) {
    await main.getByLabel('Correo electrónico').fill(email);
    await main.getByLabel('Contraseña', { exact: true }).fill(password);
    await button('Entrar').click();
    await expect(heading('Documentos')).toBeVisible({ timeout: 15000 });
  }
  async function logout() {
    await button('Cerrar sesión').click();
    await expect(heading('Iniciar sesión')).toBeVisible();
  }
  await page.goto(origin + '/portal');
  await expect(heading('Iniciar sesión')).toBeVisible();
  await login(adminEmail, adminPassword);
  await expect
    .poll(async () =>
      (await context.cookies()).some(
        (cookie) => cookie.name.endsWith('sd_session') && cookie.httpOnly,
      ),
    )
    .toBe(true);
  await page.reload();
  await expect(heading('Documentos')).toBeVisible();
  await button('Cargar documento').click();
  const upload = page.getByRole('dialog', { name: 'Cargar documento' });
  await upload.getByLabel('Título').fill(title);
  await upload.getByLabel('Clasificación').selectOption('restricted');
  await upload.getByLabel('Archivo PDF o TXT').setInputFiles({
    name: 'integracion.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from(contents),
  });
  await upload.getByRole('button', { name: 'Cargar', exact: true }).click();
  const row = main.locator('article').filter({ hasText: title });
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.getByRole('button', { name: 'Marcar favorito' }).click();
  await expect(
    row.getByRole('button', { name: 'Quitar favorito' }),
  ).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await row.getByRole('button', { name: 'Descargar', exact: true }).click();
  const download = await downloaded;
  const stream = await download.createReadStream();
  assert.ok(stream);
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString('utf8'), contents);
  await button('Auditoría').click();
  await expect(
    main.getByText('document.download', { exact: true }).first(),
  ).toBeVisible();
  await button('Reportes').click();
  await expect(button('Exportar resumen CSV')).toBeVisible();
  await button('Usuarios').click();
  await expect(main.getByText(adminEmail, { exact: false })).toBeVisible();
  await logout();
  await button('Crear cuenta').click();
  await main.getByLabel('Nombre completo').fill('Lector Sintético');
  await main.getByLabel('Correo electrónico').fill(reader.email);
  await main.getByLabel('Contraseña', { exact: true }).fill(reader.password);
  await main.getByLabel('Confirmar contraseña').fill(reader.password);
  await button('Registrar').click();
  await expect(
    main.getByText('Cuenta creada. Ya puedes iniciar sesión.'),
  ).toBeVisible();
  await login(reader.email, reader.password);
  await expect(main.getByText(/registros · Página/)).toBeVisible();
  await expect(button('Cargar documento')).toHaveCount(0);
  await expect(button('Usuarios')).toHaveCount(0);
  await expect(row).toHaveCount(0);
  const forbidden = await context.request.get(origin + '/api/v1/users');
  assert.equal(forbidden.status(), 403);
  await logout();
  await login(adminEmail, adminPassword);
  await row.getByRole('button', { name: 'Eliminar', exact: true }).click();
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(row).toHaveCount(0);
  await logout();
  assert.ok(
    !(await context.cookies()).some((cookie) =>
      cookie.name.endsWith('sd_session'),
    ),
  );
  assert.deepEqual(
    await page.evaluate(() => [localStorage.length, sessionStorage.length]),
    [0, 0],
  );
  console.log(
    'Portal real: sesión, carga, favoritos, descarga íntegra, auditoría, reportes, alta, autorización y salida aprobados.',
  );
} finally {
  await browser.close();
}
