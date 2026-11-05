import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import { PERMISSIONS_KEY, PUBLIC_KEY } from '../authz/decorators';
import { hasPermission, Permission } from '../authz/permissions';
import { Errors } from '../common/api-error';
import { clientMeta } from '../common/request-context';
import { KeyService } from '../crypto/key.service';
import { SessionService } from './session.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Guard global (APP_GUARD). Orden: origen → sesión → CSRF → permisos.
 * Denegación predeterminada: la ruta debe declarar @Public, @Authenticated
 * o @RequirePermissions; en caso contrario se rechaza con 403.
 */
@Injectable()
export class AccessGuard implements CanActivate {
  private readonly allowedOrigins: Set<string>;

  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly keys: KeyService,
    private readonly audit: AuditService,
    config: ConfigService,
  ) {
    this.allowedOrigins = new Set([
      new URL(config.getOrThrow<string>('FRONTEND_ORIGIN')).origin,
    ]);
    // Fuera de producción, Swagger UI (servido por la propia API) envía
    // Origin con el puerto de la API; se permite para "Try it out".
    if (config.get('NODE_ENV') !== 'production') {
      const port = config.getOrThrow<number>('PORT');
      this.allowedOrigins.add(`http://localhost:${port}`);
      this.allowedOrigins.add(`http://127.0.0.1:${port}`);
    }
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (ctx.getType() !== 'http') return false;
    const req = ctx.switchToHttp().getRequest<Request>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const targets = [ctx.getHandler(), ctx.getClass()];
    const unsafe = !SAFE_METHODS.has(req.method);

    // Los navegadores envían Origin en solicitudes no seguras entre orígenes;
    // un Origin distinto del frontend se rechaza también en rutas públicas
    // (mitiga CSRF de login/registro). Clientes sin navegador no lo envían.
    if (unsafe) {
      const origin = req.header('origin');
      if (origin && !this.allowedOrigins.has(origin)) throw Errors.origin();
    }

    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets))
      return true;

    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(
      PERMISSIONS_KEY,
      targets,
    );
    if (required === undefined) throw Errors.forbidden();

    const token: unknown = req.cookies?.[this.sessions.cookieName];
    if (typeof token !== 'string' || !token) throw Errors.authRequired();
    const check = await this.sessions.validate(token);
    if (!check.ok) {
      this.sessions.clearCookie(res);
      if (check.reason === 'expired') {
        await this.audit.record({
          action: 'auth.session.expired',
          outcome: 'denied',
          actorId: check.userId,
          ...clientMeta(req),
        });
        throw Errors.sessionExpired();
      }
      throw Errors.authRequired();
    }

    if (unsafe) {
      const sent = req.header(CSRF_HEADER) ?? '';
      const expected = this.keys.csrfTokenFor(token);
      const a = Buffer.from(sent);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw Errors.csrf();
    }

    const { user, session } = check;
    req.auth = {
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      sessionId: session.id,
      sessionToken: token,
      idleExpiresAt: session.idleExpiresAt,
      absoluteExpiresAt: session.absoluteExpiresAt,
    };

    const missing = required.filter((p) => !hasPermission(user.role, p));
    if (missing.length) {
      await this.audit.record({
        action: 'access.denied',
        outcome: 'denied',
        actorId: user.id,
        actorEmail: user.email,
        ...clientMeta(req),
        details: {
          route: `${req.method} ${req.route?.path ?? req.path}`,
          missing: missing.join(','),
        },
      });
      throw Errors.forbidden();
    }
    return true;
  }
}
