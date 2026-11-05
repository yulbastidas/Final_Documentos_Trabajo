import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Classification, Role } from '../authz/permissions';

// Los esquemas reales se crean mediante migraciones (src/database/migrations).
// synchronize y dropSchema permanecen desactivados.
const uuid = () => ({ type: 'char' as const, length: 36 });
const ts = (name: string, nullable = false) => ({
  name,
  type: 'datetime' as const,
  precision: 3,
  nullable,
});

@Entity('users')
export class UserEntity {
  @PrimaryColumn(uuid()) id!: string;
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email!: string;
  @Column({ name: 'display_name', type: 'varchar', length: 80 })
  displayName!: string;
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;
  @Column({
    type: 'enum',
    enum: ['admin', 'editor', 'reader'],
    default: 'reader',
  })
  role!: Role;
  @Column({ type: 'enum', enum: ['active', 'disabled'], default: 'active' })
  status!: 'active' | 'disabled';
  @Column({
    name: 'failed_login_count',
    type: 'int',
    unsigned: true,
    default: 0,
  })
  failedLoginCount!: number;
  @Column(ts('locked_until', true)) lockedUntil!: Date | null;
  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;
  @Column({
    name: 'mfa_secret_enc',
    type: 'varbinary',
    length: 128,
    nullable: true,
  })
  mfaSecretEnc!: Buffer | null;
  @Column({
    name: 'mfa_pending_secret_enc',
    type: 'varbinary',
    length: 128,
    nullable: true,
  })
  mfaPendingSecretEnc!: Buffer | null;
  @Column({
    name: 'mfa_last_used_step',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  mfaLastUsedStep!: number | null;
  @Column(ts('created_at')) createdAt!: Date;
  @Column(ts('updated_at')) updatedAt!: Date;
}

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn(uuid()) id!: string;
  @Index('idx_sessions_user')
  @Column({ name: 'user_id', ...uuid() })
  userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_sessions_user' })
  user?: UserEntity;
  @Index('uq_sessions_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;
  @Column(ts('created_at')) createdAt!: Date;
  @Column(ts('last_seen_at')) lastSeenAt!: Date;
  @Column(ts('idle_expires_at')) idleExpiresAt!: Date;
  @Column(ts('absolute_expires_at')) absoluteExpiresAt!: Date;
  @Column(ts('revoked_at', true)) revokedAt!: Date | null;
  @Column({ type: 'varchar', length: 45, nullable: true }) ip!: string | null;
  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent!: string | null;
}

@Entity('mfa_challenges')
export class MfaChallengeEntity {
  @PrimaryColumn(uuid()) id!: string;
  @Index('uq_mfa_challenges_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'char', length: 64 })
  tokenHash!: string;
  @Index('idx_mfa_challenges_user')
  @Column({ name: 'user_id', ...uuid() })
  userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_mfa_challenges_user',
  })
  user?: UserEntity;
  @Column({ type: 'int', unsigned: true, default: 0 }) attempts!: number;
  @Column(ts('expires_at')) expiresAt!: Date;
  @Column(ts('consumed_at', true)) consumedAt!: Date | null;
  @Column(ts('created_at')) createdAt!: Date;
}

@Entity('mfa_recovery_codes')
export class MfaRecoveryCodeEntity {
  @PrimaryColumn(uuid()) id!: string;
  @Index('idx_mfa_recovery_user')
  @Column({ name: 'user_id', ...uuid() })
  userId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_mfa_recovery_user',
  })
  user?: UserEntity;
  @Column({ name: 'code_hash', type: 'char', length: 64 }) codeHash!: string;
  @Column(ts('used_at', true)) usedAt!: Date | null;
  @Column(ts('created_at')) createdAt!: Date;
}

@Entity('documents')
export class DocumentEntity {
  @PrimaryColumn(uuid()) id!: string;
  @Index('idx_documents_owner')
  @Column({ name: 'owner_id', ...uuid() })
  ownerId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'owner_id',
    foreignKeyConstraintName: 'fk_documents_owner',
  })
  owner?: UserEntity;
  @Column({ type: 'varchar', length: 120 }) title!: string;
  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename!: string;
  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType!: string;
  @Column({ name: 'size_bytes', type: 'int', unsigned: true })
  sizeBytes!: number;
  @Index('idx_documents_classification')
  @Column({ type: 'enum', enum: ['internal', 'confidential', 'restricted'] })
  classification!: Classification;
  @Column({ type: 'char', length: 64 }) sha256!: string;
  @Column({ type: 'binary', length: 12 }) nonce!: Buffer;
  @Column({ name: 'auth_tag', type: 'binary', length: 16 }) authTag!: Buffer;
  @Column({ name: 'wrapped_key', type: 'varbinary', length: 128 })
  wrappedKey!: Buffer;
  @Column({ name: 'key_id', type: 'varchar', length: 32 }) keyId!: string;
  @Column({
    name: 'encryption_version',
    type: 'tinyint',
    unsigned: true,
    default: 1,
  })
  encryptionVersion!: number;
  @Index('idx_documents_created')
  @Column(ts('created_at'))
  createdAt!: Date;
  @Column(ts('updated_at')) updatedAt!: Date;
}

@Entity('document_favorites')
export class DocumentFavoriteEntity {
  @PrimaryColumn({ name: 'user_id', ...uuid() }) userId!: string;
  @Index('idx_favorites_document')
  @PrimaryColumn({ name: 'document_id', ...uuid() })
  documentId!: string;
  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_favorites_user',
  })
  user?: UserEntity;
  @ManyToOne(() => DocumentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'document_id',
    foreignKeyConstraintName: 'fk_favorites_document',
  })
  document?: DocumentEntity;
  @Column(ts('created_at')) createdAt!: Date;
}

export type AuditOutcome = 'success' | 'denied' | 'failure';

@Entity('audit_events')
@Index('idx_audit_occurred', ['occurredAt'])
@Index('idx_audit_action', ['action', 'occurredAt'])
@Index('idx_audit_actor', ['actorId', 'occurredAt'])
export class AuditEventEntity {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  seq!: string;
  @Index('uq_audit_events_id', { unique: true })
  @Column(uuid())
  id!: string;
  @Column(ts('occurred_at')) occurredAt!: Date;
  // Sin FK: el evento debe sobrevivir a cambios en usuarios o documentos.
  @Column({ name: 'actor_id', ...uuid(), nullable: true }) actorId!:
    string | null;
  @Column({ name: 'actor_email', type: 'varchar', length: 254, nullable: true })
  actorEmail!: string | null;
  @Column({ type: 'varchar', length: 64 }) action!: string;
  @Column({ type: 'enum', enum: ['success', 'denied', 'failure'] })
  outcome!: AuditOutcome;
  @Column({
    name: 'resource_type',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  resourceType!: string | null;
  @Column({ name: 'resource_id', type: 'varchar', length: 64, nullable: true })
  resourceId!: string | null;
  @Column({ type: 'varchar', length: 45, nullable: true }) ip!: string | null;
  @Column({ name: 'request_id', type: 'varchar', length: 64, nullable: true })
  requestId!: string | null;
  @Column({ type: 'json', nullable: true }) details!: Record<
    string,
    unknown
  > | null;
}

export const ENTITIES = [
  UserEntity,
  SessionEntity,
  MfaChallengeEntity,
  MfaRecoveryCodeEntity,
  DocumentEntity,
  DocumentFavoriteEntity,
  AuditEventEntity,
];
