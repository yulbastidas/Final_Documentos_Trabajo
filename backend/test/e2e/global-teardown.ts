import { rmSync } from 'node:fs';
import { DB_INFO_FILE } from './db-info';

export default async function globalTeardown() {
  rmSync(DB_INFO_FILE, { force: true });
  const db = (
    globalThis as unknown as { __MYSQL__?: { stop: () => Promise<void> } }
  ).__MYSQL__;
  await db?.stop();
}
