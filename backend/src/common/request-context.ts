import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../authz/permissions';

export interface AuthContext {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  sessionId: string;
  sessionToken: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
}

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
    auth?: AuthContext;
  }
}

const VALID_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Asigna un requestId (aceptando uno entrante válido) y lo expone en la respuesta. */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function clientMeta(req: Request) {
  return {
    ip: (req.ip ?? '').slice(0, 45) || null,
    userAgent: (req.header('user-agent') ?? '').slice(0, 255) || null,
    requestId: req.requestId ?? null,
  };
}
