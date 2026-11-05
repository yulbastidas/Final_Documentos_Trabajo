import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM con nonce aleatorio de 96 bits por operación y tag de 128 bits.
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
export const KEY_BYTES = 32;

export class IntegrityError extends Error {
  constructor() {
    super('Authenticated decryption failed');
    this.name = 'IntegrityError';
  }
}

export interface Sealed {
  nonce: Buffer;
  ciphertext: Buffer;
  tag: Buffer;
}

function assertKey(key: Buffer) {
  if (key.length !== KEY_BYTES) throw new Error('AES-256 requires 32-byte key');
}

export function seal(key: Buffer, plaintext: Buffer, aad: string): Sealed {
  assertKey(key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { nonce, ciphertext, tag: cipher.getAuthTag() };
}

export function open(key: Buffer, sealed: Sealed, aad: string): Buffer {
  assertKey(key);
  if (sealed.nonce.length !== NONCE_BYTES || sealed.tag.length !== TAG_BYTES)
    throw new IntegrityError();
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, sealed.nonce, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(aad, 'utf8'));
    decipher.setAuthTag(sealed.tag);
    return Buffer.concat([
      decipher.update(sealed.ciphertext),
      decipher.final(),
    ]);
  } catch {
    throw new IntegrityError();
  }
}

// Formato compacto nonce | ciphertext | tag para valores pequeños en BD
// (claves de documento envueltas y secretos TOTP).
export function sealToBuffer(key: Buffer, plaintext: Buffer, aad: string) {
  const s = seal(key, plaintext, aad);
  return Buffer.concat([s.nonce, s.ciphertext, s.tag]);
}

export function openFromBuffer(key: Buffer, packed: Buffer, aad: string) {
  if (packed.length < NONCE_BYTES + TAG_BYTES) throw new IntegrityError();
  return open(
    key,
    {
      nonce: packed.subarray(0, NONCE_BYTES),
      ciphertext: packed.subarray(NONCE_BYTES, packed.length - TAG_BYTES),
      tag: packed.subarray(packed.length - TAG_BYTES),
    },
    aad,
  );
}
