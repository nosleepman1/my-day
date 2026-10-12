-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_DELETION');

-- CreateEnum
CREATE TYPE "session_revoke_reason" AS ENUM ('LOGOUT', 'LOGOUT_ALL', 'PASSWORD_CHANGED', 'EMAIL_CHANGED', 'ADMIN_ACTION', 'ACCOUNT_DELETION', 'SECURITY', 'LIMIT');

-- CreateEnum
CREATE TYPE "email_token_purpose" AS ENUM ('VERIFY_SIGNUP', 'CHANGE_EMAIL');

-- CreateEnum
CREATE TYPE "login_event_type" AS ENUM ('LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'SESSION_REVOKED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'EMAIL_VERIFIED', 'EMAIL_CHANGED', 'REAUTH_SUCCEEDED', 'REAUTH_FAILED', 'ACCOUNT_LOCKED', 'MFA_SUCCEEDED', 'MFA_FAILED');

-- CreateEnum
CREATE TYPE "audit_actor_type" AS ENUM ('USER', 'ADMIN', 'SYSTEM', 'AUTOMATION', 'AI', 'API_KEY', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "audit_outcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

-- CreateEnum
CREATE TYPE "ui_theme" AS ENUM ('SYSTEM', 'LIGHT', 'DARK');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "first_name" VARCHAR(80),
    "last_name" VARCHAR(80),
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMPTZ(6),
    "password_changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idle_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "reauth_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" "session_revoke_reason",
    "ip" INET,
    "user_agent_label" VARCHAR(200),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "purpose" "email_token_purpose" NOT NULL,
    "target_email" CITEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "requested_ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "user_id" UUID NOT NULL,
    "locale" VARCHAR(10) NOT NULL DEFAULT 'fr',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Dakar',
    "default_currency" CHAR(3) NOT NULL DEFAULT 'XOF',
    "date_format" VARCHAR(20) NOT NULL DEFAULT 'dd/MM/yyyy',
    "week_starts_on" SMALLINT NOT NULL DEFAULT 1,
    "theme" "ui_theme" NOT NULL DEFAULT 'SYSTEM',
    "enabled_modules" TEXT[],
    "onboarding_completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "login_events" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "email_hmac" BYTEA,
    "event_type" "login_event_type" NOT NULL,
    "failure_code" VARCHAR(40),
    "session_id" UUID,
    "ip" INET,
    "user_agent_label" VARCHAR(200),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "actor_type" "audit_actor_type" NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(60),
    "entity_id" UUID,
    "outcome" "audit_outcome" NOT NULL DEFAULT 'SUCCESS',
    "request_id" VARCHAR(64),
    "correlation_id" VARCHAR(64),
    "ip" INET,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ix_users__status_created" ON "users"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "ix_sessions__absolute_expires" ON "sessions"("absolute_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_user_id_id_key" ON "sessions"("user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_hash_key" ON "email_verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "ix_email_verification_tokens__expires" ON "email_verification_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "ix_password_reset_tokens__expires" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "ix_login_events__user_time" ON "login_events"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_audit_logs__user_time" ON "audit_logs"("user_id", "occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ix_audit_logs__entity" ON "audit_logs"("user_id", "entity_type", "entity_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- ==== MANUAL: objets non exprimables par Prisma (DATA_MODEL.md M01, §2.2) ====
-- Registre : prisma/manual-objects.md ; vérifié par test/integration/database/schema-manual-objects.int.spec.ts
-- ============================================================================

-- users
ALTER TABLE "users"
  ADD CONSTRAINT "ck_users__email_format" CHECK (position('@' in "email") > 1),
  ADD CONSTRAINT "ck_users__failed_login_count" CHECK ("failed_login_count" >= 0);
-- Un seul ADMIN : le propriétaire de la plateforme (ADR-002).
CREATE UNIQUE INDEX "ux_users__single_admin" ON "users" ((true)) WHERE "role" = 'ADMIN';

-- sessions
ALTER TABLE "sessions"
  ADD CONSTRAINT "ck_sessions__token_hash_len" CHECK (octet_length("token_hash") = 32),
  ADD CONSTRAINT "ck_sessions__expiry" CHECK ("idle_expires_at" <= "absolute_expires_at" AND "absolute_expires_at" > "created_at"),
  ADD CONSTRAINT "ck_sessions__revocation" CHECK (("revoked_at" IS NULL) = ("revoke_reason" IS NULL));
CREATE INDEX "ix_sessions__user_active" ON "sessions" ("user_id") WHERE "revoked_at" IS NULL;

-- email_verification_tokens
ALTER TABLE "email_verification_tokens"
  ADD CONSTRAINT "ck_email_verification_tokens__token_hash_len" CHECK (octet_length("token_hash") = 32),
  ADD CONSTRAINT "ck_email_verification_tokens__expiry" CHECK ("expires_at" > "created_at");
CREATE UNIQUE INDEX "ux_email_verification_tokens__active" ON "email_verification_tokens" ("user_id", "purpose") WHERE "consumed_at" IS NULL;

-- password_reset_tokens
ALTER TABLE "password_reset_tokens"
  ADD CONSTRAINT "ck_password_reset_tokens__token_hash_len" CHECK (octet_length("token_hash") = 32),
  ADD CONSTRAINT "ck_password_reset_tokens__ttl" CHECK ("expires_at" > "created_at" AND "expires_at" <= "created_at" + interval '30 minutes');
CREATE UNIQUE INDEX "ux_password_reset_tokens__active" ON "password_reset_tokens" ("user_id") WHERE "consumed_at" IS NULL;

-- user_preferences
ALTER TABLE "user_preferences" ALTER COLUMN "enabled_modules" SET NOT NULL;
ALTER TABLE "user_preferences"
  ADD CONSTRAINT "ck_user_preferences__currency_format" CHECK ("default_currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "ck_user_preferences__week_starts_on" CHECK ("week_starts_on" BETWEEN 1 AND 7);

-- login_events (ajout seul)
ALTER TABLE "login_events"
  ADD CONSTRAINT "ck_login_events__email_hmac_len" CHECK ("email_hmac" IS NULL OR octet_length("email_hmac") = 32);
CREATE INDEX "ix_login_events__email_hmac_time" ON "login_events" ("email_hmac", "occurred_at" DESC) WHERE "email_hmac" IS NOT NULL;
CREATE INDEX "ix_login_events__time_brin" ON "login_events" USING brin ("occurred_at");

-- audit_logs (ajout seul)
ALTER TABLE "audit_logs"
  ADD CONSTRAINT "ck_audit_logs__metadata_size" CHECK (pg_column_size("metadata") <= 8192),
  ADD CONSTRAINT "ck_audit_logs__entity" CHECK (("entity_type" IS NULL) = ("entity_id" IS NULL));
CREATE INDEX "ix_audit_logs__time_brin" ON "audit_logs" USING brin ("occurred_at");

-- Journaux en ajout seul : toute modification ou suppression est refusée, sauf au rôle de purge
-- orbit_maintenance (créé avec les jobs de rétention, PHASE-08). Double barrière : droits + déclencheurs.
CREATE OR REPLACE FUNCTION "orbit_forbid_log_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'orbit_maintenance' THEN
    RETURN COALESCE(OLD, NEW);
  END IF;
  RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege';
END;
$$;

CREATE TRIGGER "trg_login_events__append_only" BEFORE UPDATE OR DELETE ON "login_events"
  FOR EACH ROW EXECUTE FUNCTION "orbit_forbid_log_mutation"();
CREATE TRIGGER "trg_login_events__no_truncate" BEFORE TRUNCATE ON "login_events"
  FOR EACH STATEMENT EXECUTE FUNCTION "orbit_forbid_log_mutation"();
CREATE TRIGGER "trg_audit_logs__append_only" BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "orbit_forbid_log_mutation"();
CREATE TRIGGER "trg_audit_logs__no_truncate" BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "orbit_forbid_log_mutation"();

REVOKE UPDATE, DELETE, TRUNCATE ON "login_events", "audit_logs" FROM orbit_app;
