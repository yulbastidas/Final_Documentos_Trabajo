import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { KEY_BYTES } from './aead';

/**
 * Carga las claves desde el entorno o desde archivos (*_FILE). Las claves
 * nunca se guardan en la base de datos ni junto a los documentos cifrados.
 * El servicio falla al iniciar si falta una clave o es inválida.
 */
@Injectable()
export class KeyService {
  readonly documentKekId: string;
  private readonly documentKeks = new Map<string, Buffer>();
  readonly mfaKey: Buffer;
  private readonly csrfSecret: Buffer;

  constructor(config: ConfigService) {
    const read = (name: string): Buffer => {
      const file = config.get<string>(`${name}_FILE`);
      const raw = file
        ? readFileSync(file, 'utf8').trim()
        : (config.get<string>(name) ?? '');
      const key = Buffer.from(raw, 'base64');
      if (!raw || key.length !== KEY_BYTES)
        throw new Error(`${name} debe ser base64 de ${KEY_BYTES} bytes`);
      return key;
    };
    this.documentKekId = config.getOrThrow<string>('DOCUMENT_KEK_ID');
    this.documentKeks.set(this.documentKekId, read('DOCUMENT_KEK'));
    const previousFile = config.get<string>('DOCUMENT_KEK_PREVIOUS_FILE');
    const previousKeys = previousFile
      ? readFileSync(previousFile, 'utf8').trim()
      : (config.get<string>('DOCUMENT_KEK_PREVIOUS') ?? '');
    for (const entry of previousKeys
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean)) {
      const [id, value] = entry.split(':');
      const key = Buffer.from(value ?? '', 'base64');
      if (!/^[a-z0-9-]{1,32}$/.test(id) || key.length !== KEY_BYTES)
        throw new Error('DOCUMENT_KEK_PREVIOUS con formato inválido');
      if (!this.documentKeks.has(id)) this.documentKeks.set(id, key);
    }
    this.mfaKey = read('MFA_ENCRYPTION_KEY');
    this.csrfSecret = read('CSRF_SECRET');
    const fingerprints = new Set(
      [
        this.documentKeks.get(this.documentKekId)!,
        this.mfaKey,
        this.csrfSecret,
      ].map((k) => createHash('sha256').update(k).digest('hex')),
    );
    if (fingerprints.size !== 3)
      throw new Error(
        'Las claves de documentos, MFA y CSRF deben ser distintas',
      );
  }

  currentDocumentKek(): { id: string; key: Buffer } {
    return {
      id: this.documentKekId,
      key: this.documentKeks.get(this.documentKekId)!,
    };
  }

  documentKek(id: string): Buffer | undefined {
    return this.documentKeks.get(id);
  }

  /** Token CSRF derivado del token de sesión: no requiere almacenarlo. */
  csrfTokenFor(sessionToken: string): string {
    return createHmac('sha256', this.csrfSecret)
      .update(`csrf:${sessionToken}`)
      .digest('base64url');
  }
}
