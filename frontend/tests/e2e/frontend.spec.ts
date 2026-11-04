import { test, expect, type Page } from '@playwright/test';
async function navigate(page: Page, name: string) {
  if ((page.viewportSize()?.width ?? 1440) < 960)
    await page.locator('.mobile-nav summary').click();
  await page.getByRole('link', { name, exact: true }).click();
}
async function addDemo(page: Page, title: string) {
  await page.getByRole('button', { name: 'Añadir documento demo' }).click();
  await page.getByLabel('Título del documento').fill(title);
  await page.getByLabel('Archivo de prueba').setInputFiles({
    name: 'ejemplo.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Datos sintéticos de prueba'),
  });
  await page
    .getByRole('button', { name: 'Añadir metadatos', exact: true })
    .click();
}

test('rutas públicas, navegación y ausencia de errores de hidratación', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const path of [
    '/',
    '/login',
    '/registro',
    '/mfa',
    '/dashboard',
    '/dashboard/documentos',
    '/dashboard/usuarios',
    '/dashboard/seguridad',
    '/dashboard/auditoria',
    '/dashboard/reportes',
    '/dashboard/laboratorios',
    '/dashboard/ayuda',
    '/sesion-expirada',
    '/acceso-denegado',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
test('registro detecta contraseñas diferentes y no crea cuentas ni transmite credenciales', async ({
  page,
}) => {
  const posts: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posts.push(r.url());
  });
  await page.goto('/registro');
  await page.getByLabel('Nombre completo').fill('Persona Demo');
  await page.getByLabel('Correo electrónico').fill('persona@example.test');
  await page.locator('[name="password"]').fill('EjemploSoloDemo2026');
  await page.getByLabel('Confirmar contraseña').fill('NoCoincideDemo2026');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Revisar solicitud' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'no coinciden',
  );
  await page.getByLabel('Confirmar contraseña').fill('EjemploSoloDemo2026');
  await page.getByRole('button', { name: 'Revisar solicitud' }).click();
  await expect(page.getByRole('status')).toContainText(
    'No se creó ninguna cuenta',
  );
  await expect(page.locator('[name="password"]')).toHaveValue('');
  expect(posts).toEqual([]);
  expect(
    await page.evaluate(() => ({
      local: localStorage.length,
      session: sessionStorage.length,
      cookies: document.cookie,
    })),
  ).toEqual({ local: 0, session: 0, cookies: '' });
});
test('acceso y MFA informan sus límites sin autenticar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico').fill('persona@example.test');
  await page.locator('[name="password"]').fill('SoloDemo123456');
  await page.getByRole('button', { name: 'Mostrar', exact: true }).click();
  await expect(page.locator('[name="password"]')).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Revisar formulario' }).click();
  await expect(page.getByRole('status')).toContainText(
    'No se inició ninguna sesión',
  );
  await page.goto('/mfa');
  await page.getByLabel('Código de seis dígitos').fill('abc123');
  await page
    .getByRole('button', { name: 'Revisar formato del código' })
    .click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'seis dígitos',
  );
  await page.getByLabel('Código de seis dígitos').fill('123456');
  await page
    .getByRole('button', { name: 'Revisar formato del código' })
    .click();
  await expect(page.getByRole('status')).toContainText(
    'No se verificó ningún segundo factor',
  );
});
test('documentos: añade metadatos, conserva estado entre rutas, filtra y elimina con confirmación', async ({
  page,
}) => {
  await page.goto('/dashboard/documentos');
  await addDemo(page, 'Acta sintética E2E');
  await expect(
    page.getByRole('button', { name: 'Acta sintética E2E', exact: true }),
  ).toBeVisible();
  await navigate(page, 'Auditoría');
  await expect(
    page.getByRole('cell', { name: 'Acta sintética E2E', exact: true }),
  ).toBeVisible();
  await navigate(page, 'Documentos');
  await page.getByLabel('Buscar documentos').fill('Acta sintética E2E');
  await page
    .getByRole('button', { name: 'Eliminar Acta sintética E2E', exact: true })
    .click();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Acta sintética E2E', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Eliminar Acta sintética E2E', exact: true })
    .click();
  await page.getByRole('button', { name: 'Confirmar eliminación' }).click();
  await expect(
    page.getByRole('heading', { name: 'No encontramos documentos' }),
  ).toBeVisible();
});
test('filtros, favoritos y paginación documental', async ({ page }) => {
  await page.goto('/dashboard/documentos');
  await page.getByLabel('Solo favoritos').check();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await page.getByLabel('Solo favoritos').uncheck();
  await page
    .getByRole('combobox', { name: 'Clasificación', exact: true })
    .selectOption('Restringido');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page
    .getByRole('combobox', { name: 'Clasificación', exact: true })
    .selectOption('Todas');
  await addDemo(page, 'Nuevo para paginación');
  await expect(page.getByText('Página 1 de 2')).toBeVisible();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByText('Página 2 de 2')).toBeVisible();
});
test('selector de rol limita acciones visuales y edición de usuarios', async ({
  page,
}) => {
  await page.goto('/dashboard/documentos');
  await page.getByLabel('Vista de rol').selectOption('Lector');
  await expect(
    page.getByRole('button', { name: 'Añadir documento demo' }),
  ).toBeDisabled();
  await expect(
    page.getByRole('button', {
      name: 'Eliminar Arquitectura de SecureDocs',
      exact: true,
    }),
  ).toBeDisabled();
  await navigate(page, 'Usuarios y roles');
  await expect(
    page.getByRole('button', { name: 'Editar rol demo' }).first(),
  ).toBeDisabled();
  await page.getByLabel('Vista de rol').selectOption('Administrador');
  await page.getByRole('button', { name: 'Editar rol demo' }).first().click();
  await page.getByLabel('Nuevo rol').selectOption('Lector');
  await page.getByRole('button', { name: 'Guardar cambio visual' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'yuly@example.test' }),
  ).toContainText('Lector');
});
test('archivo no admitido, diálogo accesible y Escape', async ({ page }) => {
  await page.goto('/dashboard/documentos');
  await page.getByRole('button', { name: 'Añadir documento demo' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Archivo de prueba').setInputFiles({
    name: 'demo.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('demo'),
  });
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'PDF o TXT',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Añadir documento demo' }),
  ).toBeFocused();
});
test('entrada con HTML se presenta como texto y reporte neutraliza fórmulas', async ({
  page,
}) => {
  await page.goto('/dashboard/documentos');
  const title = '<img src=x onerror=alert(1)>';
  await addDemo(page, title);
  await expect(
    page.getByRole('button', { name: title, exact: true }),
  ).toBeVisible();
  expect(await page.locator('tbody img').count()).toBe(0);
  await addDemo(page, '=1+1');
  await navigate(page, 'Reportes');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar CSV demo' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('securedocs-reporte-DEMO.csv');
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  if (stream) for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('NO ES UN REPORTE DE AUDITORÍA REAL');
  expect(csv).toContain('"\'=1+1"');
});
test('auditoría filtra resultados y detecta fechas invertidas', async ({
  page,
}) => {
  await page.goto('/dashboard/auditoria');
  await page
    .getByRole('combobox', { name: 'Resultado', exact: true })
    .selectOption('Denegado');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Desde (UTC)').fill('2026-11-05');
  await page.getByLabel('Hasta (UTC)').fill('2026-11-01');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'fecha inicial',
  );
});
test('salud de API admite éxito, error y reintento sin fingir controles activos', async ({
  page,
}) => {
  await page.route('**/api/v1/health', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        status: 'ok',
        service: 'securedocs-api',
        version: '0.0.0',
      }),
    }),
  );
  await page.goto('/dashboard/seguridad');
  await page.getByRole('button', { name: 'Comprobar API' }).click();
  await expect(page.getByRole('status')).toContainText(
    'Los controles de seguridad siguen pendientes',
  );
  await page.unroute('**/api/v1/health');
  await page.route('**/api/v1/health', (route) => route.abort());
  await page.getByRole('button', { name: 'Comprobar API' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'No fue posible comprobar la API',
  );
  await expect(
    page.getByRole('button', { name: 'Comprobar API' }),
  ).toBeEnabled();
});
test('laboratorios, reinicio de datos y página 404', async ({ page }) => {
  await page.goto('/dashboard/laboratorios');
  await page.getByRole('button', { name: /WPA2/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Plan de evidencia: WPA2' }),
  ).toBeVisible();
  await page.getByLabel('Alcance y autorización documentados').check();
  await page.reload();
  await expect(
    page.getByLabel('Alcance y autorización documentados'),
  ).not.toBeChecked();
  const response = await page.goto('/ruta-que-no-existe');
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole('heading', { name: 'No encontramos esta página.' }),
  ).toBeVisible();
});
test('cabeceras de seguridad y capturas de la presentación', async ({
  page,
}) => {
  const response = await page.goto('/dashboard');
  expect(response?.headers()['x-content-type-options']).toBe('nosniff');
  expect(response?.headers()['x-frame-options']).toBe('DENY');
  expect(response?.headers()['content-security-policy']).toContain(
    "frame-ancestors 'none'",
  );
  expect(response?.headers()['x-powered-by']).toBeUndefined();
  await page.screenshot({
    path: test.info().outputPath('dashboard.png'),
    fullPage: true,
  });
  await page.goto('/login');
  await page.screenshot({
    path: test.info().outputPath('login.png'),
    fullPage: true,
  });
});
