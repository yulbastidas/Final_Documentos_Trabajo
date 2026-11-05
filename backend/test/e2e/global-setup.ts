// Inicia un MySQL 8.4 temporal (mysql-memory-server), crea una base y un
// usuario de prueba con permisos limitados a esa base y aplica las migraciones.
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { createDB } from 'mysql-memory-server';
import { createConnection } from 'mysql2/promise';
import { DataSource } from 'typeorm';
import { typeormOptions } from '../../src/database/typeorm.options';
import { DB_INFO_FILE, type DbInfo } from './db-info';

export default async function globalSetup() {
  const db = await createDB({ version: '8.4.x', logLevel: 'ERROR' });
  const password = randomBytes(18).toString('base64url');
  const info: DbInfo = {
    host: '127.0.0.1',
    port: db.port,
    user: 'securedocs_test',
    password,
    database: 'securedocs_test',
    keys: {
      DOCUMENT_KEK: randomBytes(32).toString('base64'),
      MFA_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
      CSRF_SECRET: randomBytes(32).toString('base64'),
    },
  };
  const root = await createConnection({
    host: info.host,
    port: db.port,
    user: db.username,
  });
  await root.query(
    'CREATE DATABASE securedocs_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci',
  );
  await root.query("CREATE USER 'securedocs_test'@'%' IDENTIFIED BY ?", [
    password,
  ]);
  await root.query(
    "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, INDEX, REFERENCES ON securedocs_test.* TO 'securedocs_test'@'%'",
  );
  await root.end();

  const ds = new DataSource(
    typeormOptions({
      host: info.host,
      port: info.port,
      username: info.user,
      password,
      database: info.database,
    }),
  );
  await ds.initialize();
  await ds.runMigrations({ transaction: 'each' });
  await ds.destroy();

  writeFileSync(DB_INFO_FILE, JSON.stringify(info), { mode: 0o600 });
  (globalThis as unknown as { __MYSQL__: typeof db }).__MYSQL__ = db;
}
