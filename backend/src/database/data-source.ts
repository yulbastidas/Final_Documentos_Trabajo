// DataSource para el CLI de TypeORM (migration:run / revert / show).
// Lee backend/.env; no contiene credenciales.
import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { typeormOptions } from './typeorm.options';

if (existsSync('.env')) {
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const env = process.env;
if (!env.DB_PASSWORD) throw new Error('Definir DB_PASSWORD en backend/.env');

export default new DataSource(
  typeormOptions({
    host: env.DB_HOST ?? 'localhost',
    port: Number(env.DB_PORT ?? 3306),
    username: env.DB_USER ?? 'securedocs_app',
    password: env.DB_PASSWORD,
    database: env.DB_NAME ?? 'securedocs',
  }),
);
