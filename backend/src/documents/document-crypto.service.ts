import { Injectable } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  IntegrityError,
  KEY_BYTES,
  open,
  openFromBuffer,
  seal,
  sealToBuffer,
} from '../crypto/aead';
import { KeyService } from '../crypto/key.service';

export interface EncryptedDocument {
  ciphertext: Buffer;
  nonce: Buffer;
  authTag: Buffer;
  wrappedKey: Buffer;
  keyId: string;
  sha256: string;
}

/**
 * Cifrado de sobre: cada documento usa una DEK aleatoria de 256 bits
 * (AES-256-GCM, nonce único) y la DEK se envuelve con la KEK externa.
 * La AAD liga el contenido y la DEK al identificador del documento, de modo
 * que intercambiar archivos o claves entre registros se detecta.
 */
@Injectable()
export class DocumentCryptoService {
  constructor(private readonly keys: KeyService) {}

  private contentAad(id: string) {
    return `securedocs:doc:v1:${id}`;
  }
  private keyAad(id: string, keyId: string) {
    return `securedocs:dek:v1:${id}:${keyId}`;
  }

  encrypt(id: string, plaintext: Buffer): EncryptedDocument {
    const dek = randomBytes(KEY_BYTES);
    try {
      const sealed = seal(dek, plaintext, this.contentAad(id));
      const kek = this.keys.currentDocumentKek();
      return {
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        authTag: sealed.tag,
        wrappedKey: sealToBuffer(kek.key, dek, this.keyAad(id, kek.id)),
        keyId: kek.id,
        sha256: createHash('sha256').update(plaintext).digest('hex'),
      };
    } finally {
      dek.fill(0);
    }
  }

  /** Descifra y verifica tag GCM + SHA-256; lanza IntegrityError si algo no cuadra. */
  decrypt(
    id: string,
    meta: {
      nonce: Buffer;
      authTag: Buffer;
      wrappedKey: Buffer;
      keyId: string;
      sha256: string;
      sizeBytes: number;
    },
    ciphertext: Buffer,
  ): Buffer {
    const kek = this.keys.documentKek(meta.keyId);
    if (!kek) throw new IntegrityError();
    const dek = openFromBuffer(
      kek,
      meta.wrappedKey,
      this.keyAad(id, meta.keyId),
    );
    try {
      const plaintext = open(
        dek,
        { nonce: meta.nonce, ciphertext, tag: meta.authTag },
        this.contentAad(id),
      );
      const digest = createHash('sha256').update(plaintext).digest();
      const expected = Buffer.from(meta.sha256, 'hex');
      if (
        plaintext.length !== meta.sizeBytes ||
        expected.length !== digest.length ||
        !timingSafeEqual(digest, expected)
      )
        throw new IntegrityError();
      return plaintext;
    } finally {
      dek.fill(0);
    }
  }
}
