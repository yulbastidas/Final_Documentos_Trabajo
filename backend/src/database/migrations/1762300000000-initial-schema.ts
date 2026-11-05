import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLE =
  'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci';

export class InitialSchema1762300000000 implements MigrationInterface {
  name = 'InitialSchema1762300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE users (
      id CHAR(36) NOT NULL,
      email VARCHAR(254) NOT NULL,
      display_name VARCHAR(80) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin','editor','reader') NOT NULL DEFAULT 'reader',
      status ENUM('active','disabled') NOT NULL DEFAULT 'active',
      failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
      locked_until DATETIME(3) NULL,
      mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
      mfa_secret_enc VARBINARY(128) NULL,
      mfa_pending_secret_enc VARBINARY(128) NULL,
      mfa_last_used_step BIGINT NULL,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_email (email)
    ) ${TABLE}`);

    await q.query(`CREATE TABLE sessions (
      id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      last_seen_at DATETIME(3) NOT NULL,
      idle_expires_at DATETIME(3) NOT NULL,
      absolute_expires_at DATETIME(3) NOT NULL,
      revoked_at DATETIME(3) NULL,
      ip VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sessions_token_hash (token_hash),
      KEY idx_sessions_user (user_id),
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE}`);

    await q.query(`CREATE TABLE mfa_challenges (
      id CHAR(36) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      user_id CHAR(36) NOT NULL,
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      expires_at DATETIME(3) NOT NULL,
      consumed_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_mfa_challenges_token_hash (token_hash),
      KEY idx_mfa_challenges_user (user_id),
      CONSTRAINT fk_mfa_challenges_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE}`);

    await q.query(`CREATE TABLE mfa_recovery_codes (
      id CHAR(36) NOT NULL,
      user_id CHAR(36) NOT NULL,
      code_hash CHAR(64) NOT NULL,
      used_at DATETIME(3) NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_mfa_recovery_user (user_id),
      CONSTRAINT fk_mfa_recovery_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE}`);

    await q.query(`CREATE TABLE documents (
      id CHAR(36) NOT NULL,
      owner_id CHAR(36) NOT NULL,
      title VARCHAR(120) NOT NULL,
      original_filename VARCHAR(255) NOT NULL,
      mime_type VARCHAR(100) NOT NULL,
      size_bytes INT UNSIGNED NOT NULL,
      classification ENUM('internal','confidential','restricted') NOT NULL,
      sha256 CHAR(64) NOT NULL,
      nonce BINARY(12) NOT NULL,
      auth_tag BINARY(16) NOT NULL,
      wrapped_key VARBINARY(128) NOT NULL,
      key_id VARCHAR(32) NOT NULL,
      encryption_version TINYINT UNSIGNED NOT NULL DEFAULT 1,
      created_at DATETIME(3) NOT NULL,
      updated_at DATETIME(3) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_documents_owner (owner_id),
      KEY idx_documents_classification (classification),
      KEY idx_documents_created (created_at),
      CONSTRAINT fk_documents_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE RESTRICT
    ) ${TABLE}`);

    await q.query(`CREATE TABLE document_favorites (
      user_id CHAR(36) NOT NULL,
      document_id CHAR(36) NOT NULL,
      created_at DATETIME(3) NOT NULL,
      PRIMARY KEY (user_id, document_id),
      KEY idx_favorites_document (document_id),
      CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT fk_favorites_document FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
    ) ${TABLE}`);

    await q.query(`CREATE TABLE audit_events (
      seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      id CHAR(36) NOT NULL,
      occurred_at DATETIME(3) NOT NULL,
      actor_id CHAR(36) NULL,
      actor_email VARCHAR(254) NULL,
      action VARCHAR(64) NOT NULL,
      outcome ENUM('success','denied','failure') NOT NULL,
      resource_type VARCHAR(32) NULL,
      resource_id VARCHAR(64) NULL,
      ip VARCHAR(45) NULL,
      request_id VARCHAR(64) NULL,
      details JSON NULL,
      PRIMARY KEY (seq),
      UNIQUE KEY uq_audit_events_id (id),
      KEY idx_audit_occurred (occurred_at),
      KEY idx_audit_action (action, occurred_at),
      KEY idx_audit_actor (actor_id, occurred_at)
    ) ${TABLE}`);
  }

  async down(q: QueryRunner): Promise<void> {
    for (const t of [
      'audit_events',
      'document_favorites',
      'documents',
      'mfa_recovery_codes',
      'mfa_challenges',
      'sessions',
      'users',
    ])
      await q.query(`DROP TABLE ${t}`);
  }
}
