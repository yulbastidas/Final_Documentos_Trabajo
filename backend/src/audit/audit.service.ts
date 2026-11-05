import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { AuditEventEntity, AuditOutcome } from '../database/entities';

export const AUDIT_ACTIONS = [
  'auth.register',
  'auth.login',
  'auth.login.locked',
  'auth.mfa.challenge',
  'auth.mfa.verify',
  'auth.mfa.recovery_used',
  'auth.mfa.enroll',
  'auth.mfa.confirm',
  'auth.mfa.disable',
  'auth.mfa.recovery_regenerate',
  'auth.logout',
  'auth.session.expired',
  'access.denied',
  'user.create',
  'user.update',
  'document.upload',
  'document.download',
  'document.delete',
  'document.integrity_failed',
  'audit.read',
  'report.read',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditInput {
  action: AuditAction;
  outcome: AuditOutcome;
  actorId?: string | null;
  actorEmail?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  ip?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown>;
}

// Claves cuyo valor nunca debe persistirse, aunque un llamador las pase.
const SENSITIVE_KEY =
  /pass|secret|token|code|otp|key|cookie|authorization|hash|content|nonce|tag/i;

/** Reduce details a valores primitivos cortos y elimina claves sensibles. */
export function sanitizeDetails(
  details: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (!details) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(details).slice(0, 20)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (typeof v === 'string') out[k] = v.slice(0, 200);
    else if (typeof v === 'number' || typeof v === 'boolean' || v === null)
      out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');
  constructor(
    @InjectRepository(AuditEventEntity)
    private readonly repo: Repository<AuditEventEntity>,
  ) {}

  /** Registra el evento. Un fallo de auditoría se informa, no tumba la operación. */
  async record(input: AuditInput): Promise<void> {
    try {
      await this.repo.insert({
        id: randomUUID(),
        occurredAt: new Date(),
        action: input.action,
        outcome: input.outcome,
        actorId: input.actorId ?? null,
        actorEmail: input.actorEmail?.slice(0, 254) ?? null,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        ip: input.ip ?? null,
        requestId: input.requestId ?? null,
        // TypeORM no tipa columnas JSON genéricas en insert().
        details: sanitizeDetails(input.details) as any,
      });
    } catch (e) {
      this.logger.error(
        `No se pudo registrar ${input.action}: ${(e as Error).name}`,
      );
    }
  }
}
