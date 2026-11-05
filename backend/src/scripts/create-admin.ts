// Crea el primer administrador (alta controlada, fuera de la API pública).
// Uso (PowerShell), desde backend/ con migraciones aplicadas:
//   $env:ADMIN_EMAIL='admin@example.test'; $env:ADMIN_NAME='Admin Prueba'
//   $env:ADMIN_PASSWORD='<contraseña sintética>'; npm run admin:create
//   Remove-Item Env:ADMIN_PASSWORD
import { randomUUID } from 'node:crypto';
import dataSource from '../database/data-source';
import { UserEntity } from '../database/entities';
import { hashPassword, passwordPolicyError } from '../auth/password';

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const displayName = (process.env.ADMIN_NAME ?? 'Administrador').trim();
  const password = process.env.ADMIN_PASSWORD ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    throw new Error('ADMIN_EMAIL inválido');
  const policy = passwordPolicyError(password, email);
  if (policy) throw new Error(policy);
  await dataSource.initialize();
  try {
    const repo = dataSource.getRepository(UserEntity);
    if (await repo.findOneBy({ email }))
      throw new Error('Ya existe un usuario con ese correo');
    const now = new Date();
    await repo.insert({
      id: randomUUID(),
      email,
      displayName,
      passwordHash: await hashPassword(password),
      role: 'admin',
      status: 'active',
      failedLoginCount: 0,
      lockedUntil: null,
      mfaEnabled: false,
      mfaSecretEnc: null,
      mfaPendingSecretEnc: null,
      mfaLastUsedStep: null,
      createdAt: now,
      updatedAt: now,
    });
    console.log(
      `Administrador creado: ${email}. Activa MFA en el primer inicio de sesión.`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((e: Error) => {
  console.error(`No se creó el administrador: ${e.message}`);
  process.exitCode = 1;
});
