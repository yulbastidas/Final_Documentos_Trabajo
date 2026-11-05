import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// TOTP RFC 6238 (HMAC-SHA1, 6 dígitos, paso de 30 s), compatible con
// aplicaciones autenticadoras. Implementación verificada con los vectores
// de prueba del RFC en test/unit/totp.spec.ts.
export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error('Invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): Buffer {
  return randomBytes(20); // 160 bits, recomendado por RFC 4226
}

export function hotp(secret: Buffer, counter: number, digits = TOTP_DIGITS) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return bin.toString().padStart(digits, '0');
}

export function totpStep(timeMs = Date.now()) {
  return Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS);
}

export function totp(
  secret: Buffer,
  timeMs = Date.now(),
  digits = TOTP_DIGITS,
) {
  return hotp(secret, totpStep(timeMs), digits);
}

/**
 * Devuelve el paso aceptado o null. Acepta ±window pasos por desfase de reloj
 * y rechaza pasos <= lastUsedStep (protección contra reutilización).
 */
export function verifyTotp(
  secret: Buffer,
  code: string,
  lastUsedStep: number | null,
  timeMs = Date.now(),
  window = 1,
): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(timeMs);
  const given = Buffer.from(code);
  let matched: number | null = null;
  for (let d = -window; d <= window; d++) {
    const step = current + d;
    const expected = Buffer.from(hotp(secret, step));
    // Comparar todos los pasos sin salir antes, en tiempo constante.
    if (timingSafeEqual(expected, given) && matched === null) matched = step;
  }
  if (matched === null) return null;
  if (lastUsedStep !== null && matched <= lastUsedStep) return null;
  return matched;
}

export function otpauthUri(secret: Buffer, account: string, issuer: string) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: base32Encode(secret),
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
