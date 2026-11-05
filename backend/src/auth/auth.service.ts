import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Errors } from '../common/api-error';
import { KeyService } from '../crypto/key.service';
import { SessionEntity, UserEntity } from '../database/entities';
import { toUserDto } from '../users/dto';
import { UsersService } from '../users/users.service';
import { LoginDto, MfaVerifyDto, RegisterDto } from './dto';
import { MfaService } from './mfa.service';
import { dummyVerify, verifyPassword } from './password';
import { SessionService } from './session.service';

type Meta = {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
};

export type LoginResult =
  | { kind: 'session'; token: string; session: SessionEntity; user: UserEntity }
  | { kind: 'mfa'; challengeId: string; expiresAt: Date };

@Injectable()
export class AuthService {
  private readonly maxFailures: number;
  private readonly lockMs: number;
  private readonly registrationOpen: boolean;

  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly sessions: SessionService,
    private readonly mfa: MfaService,
    private readonly audit: AuditService,
    private readonly keys: KeyService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    this.maxFailures = config.getOrThrow<number>('LOGIN_MAX_FAILURES');
    this.lockMs = config.getOrThrow<number>('LOGIN_LOCK_MINUTES') * 60_000;
    this.registrationOpen =
      config.getOrThrow<string>('REGISTRATION_MODE') === 'open';
  }

  /** Alta pública: siempre rol reader. El cliente no puede elegir rol. */
  async register(dto: RegisterDto, meta: Meta) {
    if (!this.registrationOpen) {
      await this.audit.record({
        action: 'auth.register',
        outcome: 'denied',
        ...meta,
        details: { reason: 'closed' },
      });
      throw Errors.registrationClosed();
    }
    try {
      const user = await this.users.create({ ...dto, role: 'reader' });
      await this.audit.record({
        action: 'auth.register',
        outcome: 'success',
        actorId: user.id,
        actorEmail: user.email,
        resourceType: 'user',
        resourceId: user.id,
        ...meta,
      });
      return user;
    } catch (e) {
      await this.audit.record({
        action: 'auth.register',
        outcome: 'failure',
        actorEmail: dto.email,
        ...meta,
        details: { reason: (e as { code?: string }).code ?? 'error' },
      });
      throw e;
    }
  }

  async login(dto: LoginDto, meta: Meta): Promise<LoginResult> {
    const user = await this.users.findByEmail(dto.email);
    const fail = async (reason: string, actorId?: string) => {
      await this.audit.record({
        action: reason === 'locked' ? 'auth.login.locked' : 'auth.login',
        outcome: 'failure',
        actorId: actorId ?? null,
        actorEmail: dto.email,
        ...meta,
        details: { reason },
      });
      return Errors.invalidCredentials();
    };

    if (!user) {
      await dummyVerify(dto.password);
      throw await fail('unknown_user');
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      await dummyVerify(dto.password);
      throw await fail('locked', user.id);
    }
    const valid = await verifyPassword(user.passwordHash, dto.password);
    if (!valid) {
      const count = user.failedLoginCount + 1;
      const lock = count >= this.maxFailures;
      await this.userRepo.update(user.id, {
        failedLoginCount: lock ? 0 : count,
        lockedUntil: lock
          ? new Date(Date.now() + this.lockMs)
          : user.lockedUntil,
      });
      throw await fail(lock ? 'bad_password_locked' : 'bad_password', user.id);
    }
    if (user.status !== 'active') throw await fail('disabled', user.id);
    if (user.failedLoginCount || user.lockedUntil)
      await this.userRepo.update(user.id, {
        failedLoginCount: 0,
        lockedUntil: null,
      });

    if (user.mfaEnabled) {
      const challenge = await this.mfa.createChallenge(user.id);
      await this.audit.record({
        action: 'auth.mfa.challenge',
        outcome: 'success',
        actorId: user.id,
        actorEmail: user.email,
        ...meta,
      });
      return { kind: 'mfa', ...challenge };
    }
    const { token, session } = await this.sessions.create(user.id, meta);
    await this.audit.record({
      action: 'auth.login',
      outcome: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ...meta,
      details: { mfa: false },
    });
    return { kind: 'session', token, session, user };
  }

  async verifyMfa(dto: MfaVerifyDto, meta: Meta) {
    const challenge = await this.mfa.takeChallenge(dto.challengeId);
    const user = challenge ? await this.users.findById(challenge.userId) : null;
    const failure = async (reason: string) => {
      await this.audit.record({
        action: 'auth.mfa.verify',
        outcome: 'failure',
        actorId: user?.id ?? null,
        actorEmail: user?.email ?? null,
        ...meta,
        details: { reason },
      });
      return Errors.mfaInvalid();
    };
    if (!challenge || !user) throw await failure('invalid_challenge');
    if (user.status !== 'active' || !user.mfaEnabled)
      throw await failure('user_not_eligible');

    let method: 'totp' | 'recovery';
    if (dto.code !== undefined) {
      method = 'totp';
      if (!(await this.mfa.verifyUserTotp(user, dto.code)))
        throw await failure('bad_code');
    } else if (dto.recoveryCode !== undefined) {
      method = 'recovery';
      if (!(await this.mfa.useRecoveryCode(user.id, dto.recoveryCode)))
        throw await failure('bad_recovery_code');
    } else {
      throw await failure('missing_code');
    }
    if (!(await this.mfa.consumeChallenge(challenge.id)))
      throw await failure('challenge_reused');

    const { token, session } = await this.sessions.create(user.id, meta);
    await this.audit.record({
      action:
        method === 'recovery' ? 'auth.mfa.recovery_used' : 'auth.mfa.verify',
      outcome: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ...meta,
    });
    await this.audit.record({
      action: 'auth.login',
      outcome: 'success',
      actorId: user.id,
      actorEmail: user.email,
      ...meta,
      details: { mfa: true, method },
    });
    return { token, session, user };
  }

  sessionInfo(
    user: UserEntity,
    session: Pick<SessionEntity, 'idleExpiresAt' | 'absoluteExpiresAt'>,
    token: string,
  ) {
    return {
      status: 'authenticated' as const,
      user: toUserDto(user),
      csrfToken: this.keys.csrfTokenFor(token),
      idleExpiresAt: session.idleExpiresAt.toISOString(),
      absoluteExpiresAt: session.absoluteExpiresAt.toISOString(),
    };
  }
}
