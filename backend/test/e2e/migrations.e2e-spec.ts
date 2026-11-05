import { readFileSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { typeormOptions } from '../../src/database/typeorm.options';
import { DB_INFO_FILE, type DbInfo } from './db-info';

const TABLES = [
  'audit_events',
  'document_favorites',
  'documents',
  'mfa_challenges',
  'mfa_recovery_codes',
  'sessions',
  'users',
];

describe('migraciones MySQL', () => {
  let ds: DataSource;
  const tables = async () =>
    (
      await ds.query(
        'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE() ORDER BY table_name',
      )
    ).map((r: { t: string }) => r.t);

  beforeAll(async () => {
    const info = JSON.parse(readFileSync(DB_INFO_FILE, 'utf8')) as DbInfo;
    ds = new DataSource(
      typeormOptions({
        host: info.host,
        port: info.port,
        username: info.user,
        password: info.password,
        database: info.database,
      }),
    );
    await ds.initialize();
  });
  afterAll(() => ds.destroy());

  it('synchronize, dropSchema y migrationsRun están desactivados', () => {
    expect(ds.options.synchronize).toBe(false);
    expect(ds.options.dropSchema).toBe(false);
    expect(ds.options.migrationsRun).toBe(false);
  });

  it('no quedan migraciones pendientes tras el setup', async () => {
    expect(await ds.showMigrations()).toBe(false);
    expect(await tables()).toEqual([...TABLES, 'migrations'].sort());
  });

  it('revert y re-run son reproducibles', async () => {
    await ds.undoLastMigration({ transaction: 'each' });
    expect(await tables()).toEqual(['migrations']);
    expect(await ds.showMigrations()).toBe(true);
    await ds.runMigrations({ transaction: 'each' });
    expect(await tables()).toEqual([...TABLES, 'migrations'].sort());
  });

  it('las entidades coinciden con el esquema migrado (sin diferencias para sincronizar)', async () => {
    const sql = await ds.driver.createSchemaBuilder().log();
    expect(sql.upQueries.map((q) => q.query)).toEqual([]);
  });

  it('usa InnoDB, utf8mb4 y claves foráneas', async () => {
    const engines = await ds.query(
      'SELECT DISTINCT engine AS e, table_collation AS c FROM information_schema.tables WHERE table_schema = DATABASE()',
    );
    expect(engines).toEqual([{ e: 'InnoDB', c: 'utf8mb4_0900_ai_ci' }]);
    const fks = await ds.query(
      'SELECT COUNT(*) AS n FROM information_schema.referential_constraints WHERE constraint_schema = DATABASE()',
    );
    expect(Number(fks[0].n)).toBe(6);
  });
});
