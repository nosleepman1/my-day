-- PHASE-05 : Finance, cœur (DATA_MODEL.md M04).
-- Schéma relationnel, données de référence (currencies) et objets manuels.

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE "account_type" AS ENUM ('CASH', 'MOBILE_MONEY', 'BANK', 'PAYMENT_ACCOUNT', 'OTHER');
CREATE TYPE "category_kind" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "counterparty_kind" AS ENUM ('PERSON', 'ORGANIZATION');
CREATE TYPE "transaction_type" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'BORROWING', 'LOAN', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "transaction_status" AS ENUM ('PENDING', 'VALIDATED', 'CANCELLED');
CREATE TYPE "economic_class" AS ENUM (
    'INCOME_OPERATING', 'INCOME_OTHER', 'GIFT_RECEIVED', 'LOAN_COLLECTION',
    'EXPENSE_OPERATING', 'EXPENSE_FEE', 'GIFT_GIVEN', 'DEBT_REPAYMENT',
    'INTERNAL_TRANSFER', 'DEBT_DRAWDOWN', 'LOAN_DISBURSEMENT',
    'REFUND_RECEIVED', 'REFUND_ISSUED', 'BALANCE_ADJUSTMENT'
);
CREATE TYPE "transaction_source" AS ENUM ('MANUAL', 'RECURRENCE', 'AUTOMATION', 'AI', 'IMPORT', 'INTEGRATION');
CREATE TYPE "fx_rate_source" AS ENUM ('MANUAL', 'PROVIDER_STATEMENT', 'FIXED_PEG');
CREATE TYPE "entry_direction" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "idempotency_status" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- CreateTable: currencies (globale, sans user_id)
CREATE TABLE "currencies" (
    "code" CHAR(3) NOT NULL,
    "numeric_code" SMALLINT NOT NULL,
    "exponent" SMALLINT NOT NULL,
    "symbol" VARCHAR(8) NOT NULL,
    "name_fr" VARCHAR(60) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- Seed de référence des 16 devises de départ (DATA_MODEL §2.4.1)
INSERT INTO "currencies" ("code", "numeric_code", "exponent", "symbol", "name_fr") VALUES
  ('XOF', 952, 0, 'FCFA', 'Franc CFA (BCEAO)'),
  ('XAF', 950, 0, 'FCFA', 'Franc CFA (BEAC)'),
  ('EUR', 978, 2, '€', 'Euro'),
  ('USD', 840, 2, '$', 'Dollar américain'),
  ('GBP', 826, 2, '£', 'Livre sterling'),
  ('CAD', 124, 2, '$ CA', 'Dollar canadien'),
  ('CHF', 756, 2, 'CHF', 'Franc suisse'),
  ('MAD', 504, 2, 'DH', 'Dirham marocain'),
  ('GMD', 270, 2, 'D', 'Dalasi gambien'),
  ('GNF', 324, 0, 'FG', 'Franc guinéen'),
  ('MRU', 929, 2, 'UM', 'Ouguiya mauritanien'),
  ('NGN', 566, 2, '₦', 'Naira nigérian'),
  ('GHS', 936, 2, 'GH₵', 'Cedi ghanéen'),
  ('CNY', 156, 2, '¥', 'Yuan chinois'),
  ('AED', 784, 2, 'AED', 'Dirham des Émirats'),
  ('SAR', 682, 2, 'SAR', 'Riyal saoudien')
ON CONFLICT ("code") DO UPDATE SET
  "numeric_code" = EXCLUDED."numeric_code",
  "exponent" = EXCLUDED."exponent",
  "symbol" = EXCLUDED."symbol",
  "name_fr" = EXCLUDED."name_fr";

-- CreateTable: financial_accounts
CREATE TABLE "financial_accounts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "type" "account_type" NOT NULL,
    "provider" VARCHAR(60),
    "currency" CHAR(3) NOT NULL,
    "opening_balance_minor" BIGINT NOT NULL DEFAULT 0,
    "opened_on" DATE NOT NULL,
    "allow_overdraft" BOOLEAN NOT NULL DEFAULT false,
    "overdraft_limit_minor" BIGINT,
    "include_in_net_worth" BOOLEAN NOT NULL DEFAULT true,
    "color" VARCHAR(7),
    "icon" VARCHAR(40),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transaction_categories
CREATE TABLE "transaction_categories" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" "category_kind" NOT NULL,
    "parent_id" UUID,
    "default_economic_class" "economic_class" NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "system_key" VARCHAR(80),
    "color" VARCHAR(7),
    "icon" VARCHAR(40),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: counterparties
CREATE TABLE "counterparties" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "kind" "counterparty_kind" NOT NULL DEFAULT 'PERSON',
    "phone" VARCHAR(20),
    "email" CITEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counterparties_pkey" PRIMARY KEY ("id")
);

-- CreateTable: transactions
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "transaction_type" NOT NULL,
    "status" "transaction_status" NOT NULL,
    "economic_class" "economic_class" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "value_date" DATE NOT NULL,
    "description" VARCHAR(255),
    "notes" TEXT,
    "category_id" UUID,
    "counterparty_id" UUID,
    "project_id" UUID,
    "parent_transaction_id" UUID,
    "refund_of_id" UUID,
    "rate" NUMERIC(20, 10),
    "rate_date" DATE,
    "rate_source" "fx_rate_source",
    "source" "transaction_source" NOT NULL DEFAULT 'MANUAL',
    "idempotency_key" VARCHAR(128),
    "external_reference" VARCHAR(128),
    "validated_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" UUID,
    "cancel_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ledger_entries
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "direction" "entry_direction" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable: idempotency_keys
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "scope" VARCHAR(80) NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" BYTEA NOT NULL,
    "status" "idempotency_status" NOT NULL DEFAULT 'IN_PROGRESS',
    "response_status" SMALLINT,
    "response_body" JSONB,
    "resource_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- 3. MODIFICATIONS DES TABLES EXISTANTES
-- =============================================================================

-- user_preferences : lien vers currencies
ALTER TABLE "user_preferences"
    ADD CONSTRAINT "user_preferences_default_currency_fkey"
    FOREIGN KEY ("default_currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE;

-- projects : budget prévu
ALTER TABLE "projects"
    ADD COLUMN "budget_minor" BIGINT,
    ADD COLUMN "budget_currency" CHAR(3);

ALTER TABLE "projects"
    ADD CONSTRAINT "projects_budget_currency_fkey"
    FOREIGN KEY ("budget_currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE;

-- note_links : cibles transaction_id et counterparty_id
ALTER TABLE "note_links"
    ADD COLUMN "transaction_id" UUID,
    ADD COLUMN "counterparty_id" UUID;

-- =============================================================================
-- 4. INDEX DE BASE ET CONTRAINTES D'UNICITÉ PRISMA
-- =============================================================================

CREATE UNIQUE INDEX "financial_accounts_user_id_id_key" ON "financial_accounts"("user_id", "id");
CREATE UNIQUE INDEX "financial_accounts_user_id_id_currency_key" ON "financial_accounts"("user_id", "id", "currency");
CREATE INDEX "ix_financial_accounts__active" ON "financial_accounts"("user_id", "sort_order");

CREATE UNIQUE INDEX "transaction_categories_user_id_id_key" ON "transaction_categories"("user_id", "id");
CREATE UNIQUE INDEX "transaction_categories_user_id_system_key_key" ON "transaction_categories"("user_id", "system_key");
CREATE INDEX "ix_transaction_categories__kind" ON "transaction_categories"("user_id", "kind", "sort_order");

CREATE UNIQUE INDEX "counterparties_user_id_id_key" ON "counterparties"("user_id", "id");
CREATE INDEX "ix_counterparties__active" ON "counterparties"("user_id", "name");

CREATE UNIQUE INDEX "transactions_user_id_id_key" ON "transactions"("user_id", "id");
CREATE UNIQUE INDEX "transactions_user_id_id_currency_key" ON "transactions"("user_id", "id", "currency");
CREATE INDEX "ix_transactions__journal" ON "transactions"("user_id", "value_date" DESC, "id" DESC);
CREATE INDEX "ix_transactions__status_date" ON "transactions"("user_id", "status", "value_date");
CREATE INDEX "ix_transactions__category" ON "transactions"("user_id", "category_id", "value_date");
CREATE INDEX "ix_transactions__counterparty" ON "transactions"("user_id", "counterparty_id", "value_date");
CREATE INDEX "ix_transactions__project" ON "transactions"("user_id", "project_id");
CREATE INDEX "ix_transactions__parent" ON "transactions"("user_id", "parent_transaction_id");
CREATE INDEX "ix_transactions__refund_of" ON "transactions"("user_id", "refund_of_id");
CREATE INDEX "ix_transactions__external_ref" ON "transactions"("user_id", "external_reference");

CREATE UNIQUE INDEX "ledger_entries_user_id_id_key" ON "ledger_entries"("user_id", "id");
CREATE UNIQUE INDEX "ledger_entries_user_id_transaction_id_direction_key" ON "ledger_entries"("user_id", "transaction_id", "direction");
CREATE INDEX "ix_ledger_entries__account" ON "ledger_entries"("user_id", "account_id", "transaction_id");

CREATE UNIQUE INDEX "idempotency_keys_user_id_id_key" ON "idempotency_keys"("user_id", "id");
CREATE UNIQUE INDEX "idempotency_keys_user_id_scope_key_key" ON "idempotency_keys"("user_id", "scope", "key");
CREATE INDEX "ix_idempotency_keys__expires" ON "idempotency_keys"("expires_at");

-- =============================================================================
-- 5. CLÉS ÉTRANGÈRES COMPOSITES (ADR-007)
-- =============================================================================

ALTER TABLE "financial_accounts"
    ADD CONSTRAINT "financial_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "financial_accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "transaction_categories"
    ADD CONSTRAINT "transaction_categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transaction_categories_user_id_parent_id_fkey" FOREIGN KEY ("user_id", "parent_id") REFERENCES "transaction_categories"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "counterparties"
    ADD CONSTRAINT "counterparties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_user_id_category_id_fkey" FOREIGN KEY ("user_id", "category_id") REFERENCES "transaction_categories"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_user_id_counterparty_id_fkey" FOREIGN KEY ("user_id", "counterparty_id") REFERENCES "counterparties"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_user_id_project_id_fkey" FOREIGN KEY ("user_id", "project_id") REFERENCES "projects"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_user_id_parent_transaction_id_fkey" FOREIGN KEY ("user_id", "parent_transaction_id") REFERENCES "transactions"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_user_id_refund_of_id_currency_fkey" FOREIGN KEY ("user_id", "refund_of_id", "currency") REFERENCES "transactions"("user_id", "id", "currency") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "transactions_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "ledger_entries_user_id_transaction_id_fkey" FOREIGN KEY ("user_id", "transaction_id") REFERENCES "transactions"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "ledger_entries_user_id_account_id_currency_fkey" FOREIGN KEY ("user_id", "account_id", "currency") REFERENCES "financial_accounts"("user_id", "id", "currency") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "ledger_entries_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "idempotency_keys"
    ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "note_links"
    ADD CONSTRAINT "note_links_user_id_transaction_id_fkey" FOREIGN KEY ("user_id", "transaction_id") REFERENCES "transactions"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "note_links_user_id_counterparty_id_fkey" FOREIGN KEY ("user_id", "counterparty_id") REFERENCES "counterparties"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 6. OBJETS MANUELS (DATA_MODEL.md §2.2 & §3.4). Registre : prisma/manual-objects.md
-- =============================================================================

-- ==== MANUAL: currencies ====
ALTER TABLE "currencies"
    ADD CONSTRAINT "ck_currencies__code" CHECK ("code" ~ '^[A-Z]{3}$'),
    ADD CONSTRAINT "ck_currencies__exponent" CHECK ("exponent" BETWEEN 0 AND 4);

-- ==== MANUAL: financial_accounts ====
ALTER TABLE "financial_accounts"
    ADD CONSTRAINT "ck_financial_accounts__opening" CHECK ("opening_balance_minor" >= 0 OR "allow_overdraft"),
    ADD CONSTRAINT "ck_financial_accounts__overdraft" CHECK ("overdraft_limit_minor" IS NULL OR ("allow_overdraft" AND "overdraft_limit_minor" > 0));

CREATE UNIQUE INDEX "ux_financial_accounts__name"
    ON "financial_accounts" ("user_id", "name") WHERE "archived_at" IS NULL;

CREATE OR REPLACE FUNCTION orbit_financial_accounts_guard() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.currency <> OLD.currency THEN
        RAISE EXCEPTION 'financial_accounts currency is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.opening_balance_minor <> OLD.opening_balance_minor THEN
        IF EXISTS (SELECT 1 FROM ledger_entries WHERE user_id = OLD.user_id AND account_id = OLD.id) THEN
            RAISE EXCEPTION 'financial_accounts opening_balance_minor is immutable once ledger entries exist' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.orbit_financial_accounts_guard() SET search_path = public, pg_temp;

CREATE TRIGGER "trg_financial_accounts__guard"
    BEFORE UPDATE ON "financial_accounts"
    FOR EACH ROW EXECUTE FUNCTION orbit_financial_accounts_guard();

-- ==== MANUAL: transaction_categories ====
ALTER TABLE "transaction_categories"
    ADD CONSTRAINT "ck_transaction_categories__system" CHECK ("is_system" = ("system_key" IS NOT NULL)),
    ADD CONSTRAINT "ck_transaction_categories__not_own_parent" CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),
    ADD CONSTRAINT "ck_transaction_categories__class" CHECK (
        ("kind" = 'INCOME' AND "default_economic_class" IN ('INCOME_OPERATING', 'INCOME_OTHER', 'GIFT_RECEIVED', 'LOAN_COLLECTION')) OR
        ("kind" = 'EXPENSE' AND "default_economic_class" IN ('EXPENSE_OPERATING', 'EXPENSE_FEE', 'GIFT_GIVEN', 'DEBT_REPAYMENT'))
    );

CREATE UNIQUE INDEX "ux_transaction_categories__name"
    ON "transaction_categories" ("user_id", "parent_id", "name") NULLS NOT DISTINCT;

-- ==== MANUAL: counterparties ====
CREATE INDEX "ix_counterparties__name_trgm"
    ON "counterparties" USING gin (public.f_unaccent(lower("name")) gin_trgm_ops);

-- ==== MANUAL: transactions ====
ALTER TABLE "transactions"
    ADD CONSTRAINT "ck_transactions__amount_positive" CHECK ("amount_minor" > 0),
    ADD CONSTRAINT "ck_transactions__validated" CHECK ("status" <> 'VALIDATED' OR "validated_at" IS NOT NULL),
    ADD CONSTRAINT "ck_transactions__cancelled" CHECK (
        ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL) AND
        ("cancelled_at" IS NULL OR ("cancelled_by" IS NOT NULL AND "cancel_reason" IS NOT NULL))
    ),
    ADD CONSTRAINT "ck_transactions__fee" CHECK (
        "parent_transaction_id" IS NULL OR
        ("type" = 'EXPENSE' AND "economic_class" = 'EXPENSE_FEE' AND "parent_transaction_id" <> "id")
    ),
    ADD CONSTRAINT "ck_transactions__refund" CHECK (
        ("type" = 'REFUND') = ("refund_of_id" IS NOT NULL) AND
        ("refund_of_id" IS NULL OR "refund_of_id" <> "id")
    ),
    ADD CONSTRAINT "ck_transactions__rate" CHECK (
        ("rate" IS NULL) = ("rate_date" IS NULL) AND
        ("rate" IS NULL) = ("rate_source" IS NULL) AND
        ("rate" IS NULL OR ("rate" > 0 AND "type" = 'TRANSFER'))
    ),
    ADD CONSTRAINT "ck_transactions__economic_class" CHECK (
        ("type" = 'INCOME' AND "economic_class" IN ('INCOME_OPERATING', 'INCOME_OTHER', 'GIFT_RECEIVED', 'LOAN_COLLECTION')) OR
        ("type" = 'EXPENSE' AND "economic_class" IN ('EXPENSE_OPERATING', 'EXPENSE_FEE', 'GIFT_GIVEN', 'DEBT_REPAYMENT')) OR
        ("type" = 'TRANSFER' AND "economic_class" = 'INTERNAL_TRANSFER') OR
        ("type" = 'BORROWING' AND "economic_class" = 'DEBT_DRAWDOWN') OR
        ("type" = 'LOAN' AND "economic_class" = 'LOAN_DISBURSEMENT') OR
        ("type" = 'REFUND' AND "economic_class" IN ('REFUND_RECEIVED', 'REFUND_ISSUED')) OR
        ("type" = 'ADJUSTMENT' AND "economic_class" = 'BALANCE_ADJUSTMENT')
    );

CREATE UNIQUE INDEX "ux_transactions__idempotency"
    ON "transactions" ("user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL;

CREATE INDEX "ix_transactions__description_trgm"
    ON "transactions" USING gin (public.f_unaccent(lower("description")) gin_trgm_ops)
    WHERE "description" IS NOT NULL;

CREATE OR REPLACE FUNCTION orbit_transactions_guard() RETURNS trigger
    LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF current_user <> 'orbit_maintenance' THEN
            RAISE EXCEPTION 'hard delete of transactions is forbidden' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    IF OLD.status = 'CANCELLED' AND NEW.status <> 'CANCELLED' THEN
        RAISE EXCEPTION 'cannot leave CANCELLED status' USING ERRCODE = '23514';
    END IF;
    IF OLD.status = 'VALIDATED' AND NEW.status = 'PENDING' THEN
        RAISE EXCEPTION 'cannot revert VALIDATED to PENDING' USING ERRCODE = '23514';
    END IF;

    IF OLD.status <> 'PENDING' THEN
        IF NEW.type <> OLD.type
           OR NEW.economic_class <> OLD.economic_class
           OR NEW.amount_minor <> OLD.amount_minor
           OR NEW.currency <> OLD.currency
           OR NEW.occurred_at <> OLD.occurred_at
           OR NEW.value_date <> OLD.value_date
           OR NEW.rate IS DISTINCT FROM OLD.rate
           OR NEW.rate_date IS DISTINCT FROM OLD.rate_date
           OR NEW.rate_source IS DISTINCT FROM OLD.rate_source
           OR NEW.parent_transaction_id IS DISTINCT FROM OLD.parent_transaction_id
           OR NEW.refund_of_id IS DISTINCT FROM OLD.refund_of_id THEN
            RAISE EXCEPTION 'cannot mutate core financial fields of non-pending transaction' USING ERRCODE = '23514';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.orbit_transactions_guard() SET search_path = public, pg_temp;

CREATE TRIGGER "trg_transactions__guard"
    BEFORE UPDATE OR DELETE ON "transactions"
    FOR EACH ROW EXECUTE FUNCTION orbit_transactions_guard();

-- ==== MANUAL: ledger_entries ====
ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ck_ledger_entries__amount_positive" CHECK ("amount_minor" > 0);

CREATE OR REPLACE FUNCTION orbit_ledger_entries_guard() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_tx_status transaction_status;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'ledger_entries is append-only: UPDATE is immutable' USING ERRCODE = '23514';
    END IF;

    IF current_user = 'orbit_maintenance' THEN
        RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    IF TG_OP = 'INSERT' THEN
        SELECT status INTO v_tx_status FROM transactions WHERE id = NEW.transaction_id;
        IF v_tx_status IS NULL OR v_tx_status <> 'PENDING' THEN
            RAISE EXCEPTION 'cannot mutate ledger entries for non-pending transaction' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        SELECT status INTO v_tx_status FROM transactions WHERE id = OLD.transaction_id;
        IF v_tx_status IS NULL OR v_tx_status <> 'PENDING' THEN
            RAISE EXCEPTION 'cannot mutate ledger entries for non-pending transaction' USING ERRCODE = '23514';
        END IF;
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

ALTER FUNCTION public.orbit_ledger_entries_guard() SET search_path = public, pg_temp;

CREATE TRIGGER "trg_ledger_entries__guard"
    BEFORE INSERT OR UPDATE OR DELETE ON "ledger_entries"
    FOR EACH ROW EXECUTE FUNCTION orbit_ledger_entries_guard();

-- ==== MANUAL: déclencheur déferrable sur transactions & ledger_entries (forme des écritures) ====
CREATE OR REPLACE FUNCTION orbit_transactions_entries_shape() RETURNS trigger
    LANGUAGE plpgsql AS $$
DECLARE
    v_tx_id UUID;
    v_tx_record RECORD;
    v_debit_count INT;
    v_credit_count INT;
    v_total_entries INT;
    v_single_entry RECORD;
    v_debit_entry RECORD;
    v_credit_entry RECORD;
BEGIN
    IF TG_TABLE_NAME = 'transactions' THEN
        IF TG_OP = 'DELETE' THEN
            v_tx_id := OLD.id;
        ELSE
            v_tx_id := NEW.id;
        END IF;
    ELSIF TG_TABLE_NAME = 'ledger_entries' THEN
        IF TG_OP = 'DELETE' THEN
            v_tx_id := OLD.transaction_id;
        ELSE
            v_tx_id := NEW.transaction_id;
        END IF;
    END IF;

    IF v_tx_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT t.id, t.type, t.amount_minor, t.currency, t.rate
      INTO v_tx_record
      FROM transactions t
     WHERE t.id = v_tx_id;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    SELECT
        COUNT(*) AS total_count,
        COUNT(*) FILTER (WHERE direction = 'DEBIT') AS debit_cnt,
        COUNT(*) FILTER (WHERE direction = 'CREDIT') AS credit_cnt
    INTO v_total_entries, v_debit_count, v_credit_count
    FROM ledger_entries
    WHERE transaction_id = v_tx_record.id;

    CASE v_tx_record.type
        WHEN 'INCOME', 'BORROWING' THEN
            IF v_total_entries <> 1 OR v_credit_count <> 1 THEN
                RAISE EXCEPTION 'transaction % requires exactly 1 CREDIT ledger entry', v_tx_record.type
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
            SELECT * INTO v_single_entry FROM ledger_entries WHERE transaction_id = v_tx_record.id;
            IF v_single_entry.amount_minor <> v_tx_record.amount_minor OR v_single_entry.currency <> v_tx_record.currency THEN
                RAISE EXCEPTION 'entry amount and currency must match transaction header'
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;

        WHEN 'EXPENSE', 'LOAN' THEN
            IF v_total_entries <> 1 OR v_debit_count <> 1 THEN
                RAISE EXCEPTION 'transaction % requires exactly 1 DEBIT ledger entry', v_tx_record.type
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
            SELECT * INTO v_single_entry FROM ledger_entries WHERE transaction_id = v_tx_record.id;
            IF v_single_entry.amount_minor <> v_tx_record.amount_minor OR v_single_entry.currency <> v_tx_record.currency THEN
                RAISE EXCEPTION 'entry amount and currency must match transaction header'
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;

        WHEN 'TRANSFER' THEN
            IF v_total_entries <> 2 OR v_debit_count <> 1 OR v_credit_count <> 1 THEN
                RAISE EXCEPTION 'TRANSFER requires exactly 1 DEBIT and 1 CREDIT entry'
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
            SELECT * INTO v_debit_entry FROM ledger_entries WHERE transaction_id = v_tx_record.id AND direction = 'DEBIT';
            SELECT * INTO v_credit_entry FROM ledger_entries WHERE transaction_id = v_tx_record.id AND direction = 'CREDIT';
            IF v_debit_entry.account_id = v_credit_entry.account_id THEN
                RAISE EXCEPTION 'TRANSFER requires two distinct accounts'
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
            IF v_debit_entry.amount_minor <> v_tx_record.amount_minor OR v_debit_entry.currency <> v_tx_record.currency THEN
                RAISE EXCEPTION 'debit entry must match transaction amount and currency'
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
            IF v_debit_entry.currency = v_credit_entry.currency THEN
                IF v_tx_record.rate IS NOT NULL THEN
                    RAISE EXCEPTION 'same-currency TRANSFER must not have rate'
                        USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
                END IF;
                IF v_debit_entry.amount_minor <> v_credit_entry.amount_minor THEN
                    RAISE EXCEPTION 'same-currency TRANSFER must have identical debit and credit amounts'
                        USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
                END IF;
            ELSE
                IF v_tx_record.rate IS NULL THEN
                    RAISE EXCEPTION 'multi-currency TRANSFER requires rate'
                        USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
                END IF;
            END IF;

        WHEN 'REFUND', 'ADJUSTMENT' THEN
            IF v_total_entries <> 1 THEN
                RAISE EXCEPTION 'transaction % requires exactly 1 ledger entry', v_tx_record.type
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
            SELECT * INTO v_single_entry FROM ledger_entries WHERE transaction_id = v_tx_record.id;
            IF v_single_entry.amount_minor <> v_tx_record.amount_minor OR v_single_entry.currency <> v_tx_record.currency THEN
                RAISE EXCEPTION 'entry amount and currency must match transaction header'
                    USING ERRCODE = '23514', CONSTRAINT = 'trg_transactions__entries_shape';
            END IF;
    END CASE;

    RETURN NULL;
END;
$$;

ALTER FUNCTION public.orbit_transactions_entries_shape() SET search_path = public, pg_temp;

CREATE CONSTRAINT TRIGGER "trg_transactions__entries_shape"
    AFTER INSERT OR UPDATE ON "transactions"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION orbit_transactions_entries_shape();

CREATE CONSTRAINT TRIGGER "trg_ledger_entries__entries_shape"
    AFTER INSERT OR DELETE ON "ledger_entries"
    DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW EXECUTE FUNCTION orbit_transactions_entries_shape();

-- ==== MANUAL: idempotency_keys ====
ALTER TABLE "idempotency_keys"
    ADD CONSTRAINT "ck_idempotency_keys__completed" CHECK (("status" = 'COMPLETED') = ("completed_at" IS NOT NULL));

-- ==== MANUAL: projects budget ====
ALTER TABLE "projects"
    ADD CONSTRAINT "ck_projects__budget" CHECK (
        ("budget_minor" IS NULL) = ("budget_currency" IS NULL) AND
        ("budget_minor" IS NULL OR "budget_minor" >= 0)
    );

-- ==== MANUAL: note_links (mise à jour pour cibles finance) ====
ALTER TABLE "note_links"
    DROP CONSTRAINT "ck_note_links__one_target",
    ADD CONSTRAINT "ck_note_links__one_target" CHECK (
        num_nonnulls("idea_id", "project_id", "task_id", "transaction_id", "counterparty_id") = 1
    );

CREATE UNIQUE INDEX "ux_note_links__transaction"
    ON "note_links" ("user_id", "transaction_id", "note_id") WHERE "transaction_id" IS NOT NULL;

CREATE UNIQUE INDEX "ux_note_links__counterparty"
    ON "note_links" ("user_id", "counterparty_id", "note_id") WHERE "counterparty_id" IS NOT NULL;

-- ==== MANUAL: durcissement orbit_forbid_log_mutation (revue DB) ====
ALTER FUNCTION public.orbit_forbid_log_mutation() SET search_path = public, pg_temp;

-- ==== MANUAL: permissions rôle applicatif ====
GRANT SELECT ON "currencies" TO orbit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    "financial_accounts",
    "transaction_categories",
    "counterparties",
    "transactions",
    "ledger_entries",
    "idempotency_keys"
TO orbit_app;
