import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const DB_INFO_FILE = join(tmpdir(), 'securedocs-e2e-db.json');

export interface DbInfo {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  keys: Record<'DOCUMENT_KEK' | 'MFA_ENCRYPTION_KEY' | 'CSRF_SECRET', string>;
}
