import * as argon2 from 'argon2';

// argon2id (biblioteca node-argon2). Parámetros por encima del mínimo de
// OWASP (m=19 MiB, t=2, p=1).
const OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const COMMON = new Set([
  'password1234',
  'contraseña123',
  'contrasena123',
  '123456789012',
  'qwertyuiop12',
  'securedocs123',
  'administrador',
  'passwordpassword',
]);

/** Devuelve un mensaje de política incumplida o null. */
export function passwordPolicyError(
  password: string,
  email: string,
): string | null {
  if (password.length < PASSWORD_MIN)
    return `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX)
    return `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'La contraseña es demasiado común.';
  const local = email.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local))
    return 'La contraseña no debe contener tu correo.';
  if (new Set(password).size < 5)
    return 'La contraseña debe tener más variedad de caracteres.';
  return null;
}

export function hashPassword(password: string) {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Hash ficticio para igualar el tiempo cuando el usuario no existe.
let dummyHash: Promise<string> | undefined;
export function dummyVerify(password: string) {
  dummyHash ??= argon2.hash('securedocs-dummy-password', OPTIONS);
  return dummyHash.then((h) => verifyPassword(h, password)).then(() => false);
}
