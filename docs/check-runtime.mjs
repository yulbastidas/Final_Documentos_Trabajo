// Comprobación de humo de los artefactos compilados. No escribe datos.
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  importJsonsFromDirectories,
} = require('typeorm/util/DirectoryExportedClassesLoader.js');
assert.equal(
  importJsonsFromDirectories(['backend/package.json'])[0].name,
  '@securedocs/backend',
);
console.log('PASS compatibilidad TypeORM con glob corregido.');
const processes = [];
function launch(args, cwd, extra = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...extra },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (data) => (output += data));
  child.stderr.on('data', (data) => (output += data));
  child.on('error', (error) => (output += error.message));
  processes.push(child);
  return { child, output: () => output };
}
async function ready(url, processInfo) {
  for (let i = 0; i < 100; i++) {
    if (processInfo.child.exitCode !== null)
      throw new Error(processInfo.output());
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No inició ${url}: ${processInfo.output()}`);
}
try {
  const apiArgs = process.argv.includes('--dev')
    ? ['../node_modules/ts-node/dist/bin.js', 'src/main.ts']
    : ['dist/main.js'];
  const api = launch(apiArgs, 'backend', {
    PORT: '4100',
    DB_ENABLED: 'false',
    NODE_ENV: 'test',
  });
  const health = await ready('http://127.0.0.1:4100/api/v1/health', api);
  assert.deepEqual(await health.json(), {
    status: 'ok',
    service: 'securedocs-api',
    version: '0.0.0',
  });
  const schema = await (
    await fetch('http://127.0.0.1:4100/api/docs-json')
  ).json();
  assert.ok(schema.paths['/api/v1/health'].get);
  assert.equal(
    (await fetch('http://127.0.0.1:4100/api/v1/auth/login', { method: 'POST' }))
      .status,
    404,
  );
  console.log('PASS API: salud, OpenAPI y ausencia de autenticación futura.');
  const production = launch(['dist/main.js'], 'backend', {
    PORT: '4101',
    DB_ENABLED: 'false',
    NODE_ENV: 'production',
  });
  await ready('http://127.0.0.1:4101/api/v1/health', production);
  assert.equal((await fetch('http://127.0.0.1:4101/api/docs')).status, 404);
  assert.equal(
    (await fetch('http://127.0.0.1:4101/api/docs-json')).status,
    404,
  );
  console.log('PASS Swagger desactivado en producción.');
  const web = launch(
    ['../node_modules/next/dist/bin/next', 'start', '-p', '3100'],
    'frontend',
  );
  await ready('http://127.0.0.1:3100', web);
  for (const route of ['/', '/login', '/registro', '/dashboard']) {
    const response = await fetch(`http://127.0.0.1:3100${route}`);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /SecureDocs/);
  }
  console.log('PASS frontend: inicio, login, registro y dashboard HTTP 200.');
} finally {
  await Promise.all(
    processes.map(
      (child) =>
        new Promise((resolve) => {
          if (child.exitCode !== null) return resolve();
          child.once('exit', resolve);
          child.kill();
        }),
    ),
  );
}
