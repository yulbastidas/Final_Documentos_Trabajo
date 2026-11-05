import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { InitialSchema1762300000000 } from './migrations/1762300000000-initial-schema';

export const MIGRATIONS = [InitialSchema1762300000000];

export function typeormOptions(env: {
  host: string;
  port: number;
  username: string;
  password?: string;
  database: string;
}): DataSourceOptions {
  return {
    type: 'mysql',
    ...env,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migrations',
    migrationsRun: false, // aplicar explícitamente con npm run migration:run
    synchronize: false,
    dropSchema: false,
    logging: false,
    timezone: 'Z',
    charset: 'utf8mb4_0900_ai_ci',
    supportBigNumbers: true,
    bigNumberStrings: true,
  };
}
