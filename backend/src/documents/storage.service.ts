import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';

const ID = /^[0-9a-f-]{36}$/;

/**
 * Almacenamiento privado en disco, fuera de directorios públicos. Solo
 * guarda texto cifrado; los nombres son UUID, nunca el nombre original.
 */
@Injectable()
export class StorageService implements OnModuleInit {
  readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = resolve(config.getOrThrow<string>('STORAGE_DIR'));
    const parts = this.dir.toLowerCase().split(sep);
    if (parts.includes('public') || parts.includes('.next'))
      throw new Error(
        'STORAGE_DIR no puede estar dentro de un directorio público',
      );
  }

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true, mode: 0o700 });
  }

  private path(id: string, suffix = '.enc') {
    if (!ID.test(id))
      throw new Error('Identificador de almacenamiento inválido');
    return join(this.dir, `${id}${suffix}`);
  }

  /** Escritura atómica: archivo temporal + fsync + rename. */
  async write(id: string, data: Buffer) {
    const tmp = this.path(id, `.${randomBytes(6).toString('hex')}.tmp`);
    const handle = await open(tmp, 'wx', 0o600);
    try {
      await handle.writeFile(data);
      await handle.sync();
    } finally {
      await handle.close();
    }
    try {
      await rename(tmp, this.path(id));
    } catch (e) {
      await unlink(tmp).catch(() => undefined);
      throw e;
    }
  }

  read(id: string) {
    return readFile(this.path(id));
  }

  async remove(id: string) {
    try {
      await unlink(this.path(id));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }

  /** Para readiness: comprueba que el directorio admite escritura. */
  async probe(): Promise<boolean> {
    const p = join(this.dir, `.probe-${randomBytes(6).toString('hex')}`);
    try {
      const h = await open(p, 'wx', 0o600);
      await h.close();
      await unlink(p);
      return true;
    } catch {
      return false;
    }
  }
}
