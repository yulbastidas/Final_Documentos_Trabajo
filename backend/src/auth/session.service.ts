import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { CookieOptions, Response } from 'express';
import { IsNull, Not, Repository } from 'typeorm';
import { SessionEntity, UserEntity } from '../database/entities';

export const sha256Hex = (v: string) =>
  createHash('sha256').update(v).digest('hex');

export type SessionCheck =
  | { ok: true; session: SessionEntity; user: UserEntity }
  | { ok: false; reason: 'invalid' | 'expired'; userId?: string };

/**
 * Sesiones de servidor opacas. La cookie lleva un token aleatorio de 256 bits;
 * en la BD solo se guarda su SHA-256. Expiración por inactividad y absoluta.
 */
@Injectable()
export class SessionService {
  readonly cookieName: string;
  private readonly idleMs: number;
  private readonly absoluteMs: number;
  private readonly secure: boolean;

  constructor(
    config: ConfigService,
    @InjectRepository(SessionEntity)
    private readonly sessions: Repository<SessionEntity>,
  ) {
    this.secure = config.getOrThrow<boolean>('COOKIE_SECURE');
    // __Host- exige Secure, Path=/ y sin Domain: impide que subdominios la fijen.
    this.cookieName = this.secure ? '__Host-sd_session' : 'sd_session';
    this.idleMs = config.getOrThrow<number>('SESSION_IDLE_MINUTES') * 60_000;
    this.absoluteMs =
      config.getOrThrow<number>('SESSION_ABSOLUTE_HOURS') * 3_600_000;
  }

  async create(
    userId: string,
    meta: { ip: string | null; userAgent: string | null },
  ) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    const session = this.sessions.create({
      id: randomUUID(),
      userId,
      tokenHash: sha256Hex(token),
      createdAt: now,
      lastSeenAt: now,
      idleExpiresAt: new Date(now.getTime() + this.idleMs),
      absoluteExpiresAt: new Date(now.getTime() + this.absoluteMs),
      revokedAt: null,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    await this.sessions.insert(session);
    return { token, session };
  }

  async validate(token: string): Promise<SessionCheck> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token))
      return { ok: false, reason: 'invalid' };
    const session = await this.sessions.findOne({
      where: { tokenHash: sha256Hex(token) },
      relations: { user: true },
    });
    if (!session || !session.user) return { ok: false, reason: 'invalid' };
    const now = Date.now();
    if (session.revokedAt) return { ok: false, reason: 'invalid' };
    if (
      session.idleExpiresAt.getTime() <= now ||
      session.absoluteExpiresAt.getTime() <= now
    ) {
      await this.sessions.update(session.id, { revokedAt: new Date() });
      return { ok: false, reason: 'expired', userId: session.userId };
    }
    if (session.user.status !== 'active') {
      await this.revokeAllForUser(session.userId);
      return { ok: false, reason: 'invalid' };
    }
    // Renovar la ventana de inactividad, como máximo una vez por minuto.
    if (now - session.lastSeenAt.getTime() > 60_000) {
      const idle = new Date(
        Math.min(now + this.idleMs, session.absoluteExpiresAt.getTime()),
      );
      await this.sessions.update(session.id, {
        lastSeenAt: new Date(now),
        idleExpiresAt: idle,
      });
      session.lastSeenAt = new Date(now);
      session.idleExpiresAt = idle;
    }
    return { ok: true, session, user: session.user };
  }

  revoke(sessionId: string) {
    return this.sessions.update(
      { id: sessionId, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  revokeAllForUser(userId: string, exceptSessionId?: string) {
    return this.sessions.update(
      {
        userId,
        revokedAt: IsNull(),
        ...(exceptSessionId ? { id: Not(exceptSessionId) } : {}),
      },
      { revokedAt: new Date() },
    );
  }

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'strict',
      path: '/',
    };
  }

  setCookie(res: Response, token: string, session: SessionEntity) {
    res.cookie(this.cookieName, token, {
      ...this.cookieOptions(),
      expires: session.absoluteExpiresAt,
    });
  }

  clearCookie(res: Response) {
    res.clearCookie(this.cookieName, this.cookieOptions());
  }
}
