import { randomBytes } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import {
  IntegrityError,
  open,
  openFromBuffer,
  seal,
  sealToBuffer,
} from '../../src/crypto/aead';
import { KeyService } from '../../src/crypto/key.service';
import { DocumentCryptoService } from '../../src/documents/document-crypto.service';

const key = () => randomBytes(32).toString('base64');
function keyService(extra: Record<string, string> = {}) {
  const values: Record<string, string> = {
    DOCUMENT_KEK_ID: 'k1',
    DOCUMENT_KEK: key(),
    MFA_ENCRYPTION_KEY: key(),
    CSRF_SECRET: key(),
    ...extra,
  };
  return new KeyService(new ConfigService(values));
}

describe('AES-256-GCM', () => {
  const k = randomBytes(32);
  const msg = Buffer.from('contenido sintético de prueba');

  it('cifra y descifra', () => {
    const s = seal(k, msg, 'aad');
    expect(s.nonce).toHaveLength(12);
    expect(s.tag).toHaveLength(16);
    expect(s.ciphertext.equals(msg)).toBe(false);
    expect(open(k, s, 'aad').equals(msg)).toBe(true);
  });

  it('usa un nonce distinto en cada cifrado', () => {
    const nonces = new Set(
      Array.from({ length: 1000 }, () =>
        seal(k, msg, 'a').nonce.toString('hex'),
      ),
    );
    expect(nonces.size).toBe(1000);
  });

  it('rechaza texto cifrado, tag, nonce o AAD manipulados, y clave incorrecta', () => {
    const s = seal(k, msg, 'aad');
    const flip = (b: Buffer, i = 0) => {
      const c = Buffer.from(b);
      c[i] ^= 0x01;
      return c;
    };
    expect(() =>
      open(k, { ...s, ciphertext: flip(s.ciphertext) }, 'aad'),
    ).toThrow(IntegrityError);
    expect(() => open(k, { ...s, tag: flip(s.tag) }, 'aad')).toThrow(
      IntegrityError,
    );
    expect(() => open(k, { ...s, nonce: flip(s.nonce) }, 'aad')).toThrow(
      IntegrityError,
    );
    expect(() => open(k, s, 'otra')).toThrow(IntegrityError);
    expect(() => open(randomBytes(32), s, 'aad')).toThrow(IntegrityError);
    expect(() => open(k, { ...s, tag: s.tag.subarray(0, 8) }, 'aad')).toThrow(
      IntegrityError,
    );
  });

  it('formato empaquetado', () => {
    const packed = sealToBuffer(k, msg, 'x');
    expect(openFromBuffer(k, packed, 'x').equals(msg)).toBe(true);
    expect(() => openFromBuffer(k, packed.subarray(0, 10), 'x')).toThrow(
      IntegrityError,
    );
  });
});

describe('KeyService', () => {
  it('rechaza claves ausentes, cortas o repetidas', () => {
    expect(() => keyService({ DOCUMENT_KEK: '' })).toThrow(/DOCUMENT_KEK/);
    expect(() =>
      keyService({ MFA_ENCRYPTION_KEY: randomBytes(16).toString('base64') }),
    ).toThrow(/MFA_ENCRYPTION_KEY/);
    const same = key();
    expect(() => keyService({ DOCUMENT_KEK: same, CSRF_SECRET: same })).toThrow(
      /distintas/,
    );
  });

  it('CSRF determinista por sesión y distinto entre sesiones', () => {
    const ks = keyService();
    expect(ks.csrfTokenFor('a')).toBe(ks.csrfTokenFor('a'));
    expect(ks.csrfTokenFor('a')).not.toBe(ks.csrfTokenFor('b'));
  });
});

describe('DocumentCryptoService (cifrado de sobre)', () => {
  const ks = keyService();
  const svc = new DocumentCryptoService(ks);
  const id = '3f9c1c1e-7d2b-4c47-9a1e-2b5c6d7e8f90';
  const content = Buffer.from('%PDF-1.4 sintético %%EOF');

  it('ida y vuelta con verificación de SHA-256', () => {
    const enc = svc.encrypt(id, content);
    expect(enc.sha256).toMatch(/^[0-9a-f]{64}$/);
    const meta = { ...enc, sizeBytes: content.length };
    expect(svc.decrypt(id, meta, enc.ciphertext).equals(content)).toBe(true);
  });

  it('la misma entrada produce cifrados distintos (DEK y nonce nuevos)', () => {
    const a = svc.encrypt(id, content);
    const b = svc.encrypt(id, content);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.wrappedKey.equals(b.wrappedKey)).toBe(false);
  });

  it('detecta manipulación del archivo, del hash, del tamaño, de la clave envuelta y el cambio de id', () => {
    const enc = svc.encrypt(id, content);
    const meta = { ...enc, sizeBytes: content.length };
    const tampered = Buffer.from(enc.ciphertext);
    tampered[3] ^= 0xff;
    expect(() => svc.decrypt(id, meta, tampered)).toThrow(IntegrityError);
    expect(() =>
      svc.decrypt(id, { ...meta, sha256: '0'.repeat(64) }, enc.ciphertext),
    ).toThrow(IntegrityError);
    expect(() =>
      svc.decrypt(id, { ...meta, sizeBytes: 1 }, enc.ciphertext),
    ).toThrow(IntegrityError);
    const wk = Buffer.from(enc.wrappedKey);
    wk[20] ^= 1;
    expect(() =>
      svc.decrypt(id, { ...meta, wrappedKey: wk }, enc.ciphertext),
    ).toThrow(IntegrityError);
    expect(() =>
      svc.decrypt('00000000-0000-4000-8000-000000000000', meta, enc.ciphertext),
    ).toThrow(IntegrityError);
    expect(() =>
      svc.decrypt(id, { ...meta, keyId: 'desconocida' }, enc.ciphertext),
    ).toThrow(IntegrityError);
  });

  it('descifra con una KEK anterior tras rotación', () => {
    const oldKek = key();
    const before = new DocumentCryptoService(
      keyService({ DOCUMENT_KEK: oldKek, DOCUMENT_KEK_ID: 'k1' }),
    );
    const enc = before.encrypt(id, content);
    const after = new DocumentCryptoService(
      keyService({
        DOCUMENT_KEK_ID: 'k2',
        DOCUMENT_KEK_PREVIOUS: `k1:${oldKek}`,
      }),
    );
    expect(
      after
        .decrypt(id, { ...enc, sizeBytes: content.length }, enc.ciphertext)
        .equals(content),
    ).toBe(true);
  });
});
