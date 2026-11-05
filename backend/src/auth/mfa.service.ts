import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Errors } from '../common/api-error';
import { openFromBuffer, sealToBuffer } from '../crypto/aead';
import { KeyService } from '../crypto/key.service';
import {
  base32Encode,
  generateTotpSecret,
  otpauthUri,
  verifyTotp,
} from '../crypto/totp';
import {
  MfaChallengeEntity,
  MfaRecoveryCodeEntity,
  UserEntity,
} from '../database/entities';
import { sha256Hex } from './session.service';

export const MFA_CHALLENGE_TTL_MS = 5 * 60_000;
export const MFA_MAX_ATTEMPTS = 5;
export const RECOVERY_CODE_COUNT = 10;
const ISSUER = 'SecureDocs';

/**
 * TOTP: el secreto se guarda cifrado con AES-256-GCM (clave MFA_ENCRYPTION_KEY,
 * AAD ligada al usuario). Los códigos de recuperación se guardan como
 * HMAC-SHA256 con esa misma clave externa a la BD.
 */
@Injectable()
export class MfaService {
  constructor(
    private readonly keys: KeyService,
    private readonly dataSource: DataSource,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(MfaChallengeEntity)
    private readonly challenges: Repository<MfaChallengeEntity>,
  ) {}

  private aad(userId: string) {
    return `securedocs:mfa:v1:${userId}`;
  }
  private encryptSecret(userId: string, secret: Buffer) {
    return sealToBuffer(this.keys.mfaKey, secret, this.aad(userId));
  }
  private decryptSecret(userId: string, enc: Buffer) {
    return openFromBuffer(this.keys.mfaKey, enc, this.aad(userId));
  }
  private recoveryHash(userId: string, code: string) {
    const normalized = code.replace(/-/g, '').toUpperCase();
    return createHmac('sha256', this.keys.mfaKey)
      .update(`recovery:${userId}:${normalized}`)
      .digest('hex');
  }

  async beginEnrollment(user: UserEntity) {
    if (user.mfaEnabled)
      throw Errors.conflict(
        'MFA_ALREADY_ENABLED',
        'MFA ya está activo para esta cuenta.',
      );
    const secret = generateTotpSecret();
    await this.users.update(user.id, {
      mfaPendingSecretEnc: this.encryptSecret(user.id, secret),
      updatedAt: new Date(),
    });
    return {
      secret: base32Encode(secret),
      otpauthUri: otpauthUri(secret, user.email, ISSUER),
    };
  }

  async confirmEnrollment(user: UserEntity, code: string): Promise<string[]> {
    if (user.mfaEnabled)
      throw Errors.conflict(
        'MFA_ALREADY_ENABLED',
        'MFA ya está activo para esta cuenta.',
      );
    if (!user.mfaPendingSecretEnc)
      throw Errors.conflict(
        'MFA_SETUP_REQUIRED',
        'Inicia primero la configuración de MFA.',
      );
    const secret = this.decryptSecret(user.id, user.mfaPendingSecretEnc);
    const step = verifyTotp(secret, code, null);
    if (step === null) throw Errors.mfaInvalid();
    return this.dataSource.transaction(async (m) => {
      await m.getRepository(UserEntity).update(user.id, {
        mfaEnabled: true,
        mfaSecretEnc: user.mfaPendingSecretEnc,
        mfaPendingSecretEnc: null,
        mfaLastUsedStep: step,
        updatedAt: new Date(),
      });
      return this.replaceRecoveryCodes(
        m.getRepository(MfaRecoveryCodeEntity),
        user.id,
      );
    });
  }

  /** Verifica un TOTP de un usuario con MFA activo y registra el paso usado. */
  async verifyUserTotp(user: UserEntity, code: string): Promise<boolean> {
    if (!user.mfaEnabled || !user.mfaSecretEnc) return false;
    const step = verifyTotp(
      this.decryptSecret(user.id, user.mfaSecretEnc),
      code,
      user.mfaLastUsedStep,
    );
    if (step === null) return false;
    // Actualización condicional: dos solicitudes concurrentes no pueden usar el mismo paso.
    const result = await this.users
      .createQueryBuilder()
      .update()
      .set({ mfaLastUsedStep: step })
      .where(
        'id = :id AND (mfa_last_used_step IS NULL OR mfa_last_used_step < :step)',
        {
          id: user.id,
          step,
        },
      )
      .execute();
    if (!result.affected) return false;
    user.mfaLastUsedStep = step;
    return true;
  }

  async useRecoveryCode(userId: string, code: string): Promise<boolean> {
    const hash = this.recoveryHash(userId, code);
    const result = await this.dataSource
      .getRepository(MfaRecoveryCodeEntity)
      .update(
        { userId, codeHash: hash, usedAt: IsNull() },
        { usedAt: new Date() },
      );
    return (result.affected ?? 0) > 0;
  }

  async disable(user: UserEntity) {
    await this.dataSource.transaction(async (m) => {
      await m.getRepository(UserEntity).update(user.id, {
        mfaEnabled: false,
        mfaSecretEnc: null,
        mfaPendingSecretEnc: null,
        mfaLastUsedStep: null,
        updatedAt: new Date(),
      });
      await m.getRepository(MfaRecoveryCodeEntity).delete({ userId: user.id });
    });
  }

  regenerateRecoveryCodes(userId: string) {
    return this.dataSource.transaction((m) =>
      this.replaceRecoveryCodes(m.getRepository(MfaRecoveryCodeEntity), userId),
    );
  }

  private async replaceRecoveryCodes(
    repo: Repository<MfaRecoveryCodeEntity>,
    userId: string,
  ) {
    await repo.delete({ userId });
    const codes: string[] = [];
    const now = new Date();
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const raw = base32Encode(randomBytes(7)).slice(0, 10); // 50 bits
      codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
    }
    await repo.insert(
      codes.map((c) => ({
        id: randomUUID(),
        userId,
        codeHash: this.recoveryHash(userId, c),
        usedAt: null,
        createdAt: now,
      })),
    );
    return codes;
  }

  async createChallenge(userId: string) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + MFA_CHALLENGE_TTL_MS);
    await this.challenges.insert({
      id: randomUUID(),
      tokenHash: sha256Hex(token),
      userId,
      attempts: 0,
      expiresAt,
      consumedAt: null,
      createdAt: now,
    });
    return { challengeId: token, expiresAt };
  }

  /** Busca un desafío vigente y cuenta el intento (antes de verificar el código). */
  async takeChallenge(token: string): Promise<MfaChallengeEntity | null> {
    const challenge = await this.challenges.findOneBy({
      tokenHash: sha256Hex(token),
    });
    if (
      !challenge ||
      challenge.consumedAt ||
      challenge.expiresAt.getTime() <= Date.now() ||
      challenge.attempts >= MFA_MAX_ATTEMPTS
    )
      return null;
    const result = await this.challenges
      .createQueryBuilder()
      .update()
      .set({ attempts: () => 'attempts + 1' })
      .where('id = :id AND attempts < :max AND consumed_at IS NULL', {
        id: challenge.id,
        max: MFA_MAX_ATTEMPTS,
      })
      .execute();
    return result.affected ? challenge : null;
  }

  async consumeChallenge(id: string) {
    const r = await this.challenges.update(
      { id, consumedAt: IsNull() },
      { consumedAt: new Date() },
    );
    return (r.affected ?? 0) > 0;
  }
}
