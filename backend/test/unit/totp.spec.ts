import {
  base32Decode,
  base32Encode,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from '../../src/crypto/totp';

// Vectores de RFC 6238, apéndice B (SHA1, secreto ASCII "12345678901234567890", 8 dígitos).
const SECRET = Buffer.from('12345678901234567890', 'ascii');
const VECTORS: [number, string][] = [
  [59, '94287082'],
  [1111111109, '07081804'],
  [1111111111, '14050471'],
  [1234567890, '89005924'],
  [2000000000, '69279037'],
  [20000000000, '65353130'],
];

describe('TOTP RFC 6238', () => {
  it.each(VECTORS)('t=%i -> %s', (t, expected) => {
    expect(totp(SECRET, t * 1000, 8)).toBe(expected);
  });

  it('HOTP RFC 4226 contador 0 y 1', () => {
    expect(hotp(SECRET, 0)).toBe('755224');
    expect(hotp(SECRET, 1)).toBe('287082');
  });

  it('base32 ida y vuelta', () => {
    expect(base32Encode(SECRET)).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(
      base32Decode('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ').equals(SECRET),
    ).toBe(true);
  });

  it('acepta ±1 paso y rechaza fuera de ventana', () => {
    const now = 1_700_000_000_000;
    expect(
      verifyTotp(SECRET, totp(SECRET, now - 30_000), null, now),
    ).not.toBeNull();
    expect(
      verifyTotp(SECRET, totp(SECRET, now + 30_000), null, now),
    ).not.toBeNull();
    expect(
      verifyTotp(SECRET, totp(SECRET, now - 90_000), null, now),
    ).toBeNull();
  });

  it('rechaza reutilización de un paso ya usado', () => {
    const now = 1_700_000_000_000;
    const code = totp(SECRET, now);
    const step = verifyTotp(SECRET, code, null, now);
    expect(step).not.toBeNull();
    expect(verifyTotp(SECRET, code, step, now)).toBeNull();
  });

  it('rechaza formatos inválidos', () => {
    for (const c of ['', '12345', '1234567', 'abcdef', '12 456'])
      expect(verifyTotp(SECRET, c, null)).toBeNull();
  });

  it('URI otpauth sin datos extra', () => {
    const uri = otpauthUri(SECRET, 'ana@example.test', 'SecureDocs');
    expect(
      uri.startsWith('otpauth://totp/SecureDocs%3Aana%40example.test?'),
    ).toBe(true);
    expect(uri).toContain('secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });
});
