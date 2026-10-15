-- PHASE-06 : Dettes, créances, récurrences et prévisions (DATA_MODEL.md M05).
-- Schéma relationnel, index, clés étrangères composites, déclencheurs et permissions.

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE "debt_type" AS ENUM ('PAYABLE', 'RECEIVABLE');
CREATE TYPE "debt_status" AS ENUM ('OPEN', 'CANCELLED', 'WRITTEN_OFF');
CREATE TYPE "recurring_status" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');
CREATE TYPE "recurring_generation_mode" AS ENUM ('CONFIRM', 'AUTO_PENDING');
CREATE TYPE "occurrence_status" AS ENUM ('EXPECTED', 'CONFIRMED', 'SKIPPED');

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- CreateTable: debts
CREATE TABLE "debts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "debt_type" NOT NULL,
    "counterparty_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "principal_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "opened_on" DATE NOT NULL,
    "due_date" DATE,
    "status" "debt_status" NOT NULL DEFAULT 'OPEN',
    "cancelled_at" TIMESTAMPTZ(6),
    "written_off_at" TIMESTAMPTZ(6),
    "closing_reason" VARCHAR(500),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: debt_repayments
CREATE TABLE "debt_repayments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "debt_id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "notes" VARCHAR(500),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_repayments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recurring_transactions
CREATE TABLE "recurring_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "type" "transaction_type" NOT NULL,
    "economic_class" "economic_class" NOT NULL,
    "amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "account_id" UUID NOT NULL,
    "destination_account_id" UUID,
    "category_id" UUID,
    "counterparty_id" UUID,
    "project_id" UUID,
    "generation_mode" "recurring_generation_mode" NOT NULL DEFAULT 'CONFIRM',
    "reminder_days_before" SMALLINT NOT NULL DEFAULT 1,
    "status" "recurring_status" NOT NULL DEFAULT 'ACTIVE',
    "recurrence_rule" VARCHAR(500) NOT NULL,
    "recurrence_anchor_on" DATE NOT NULL,
    "recurrence_timezone" VARCHAR(60) NOT NULL,
    "recurrence_local_time" TIME(6),
    "next_occurrence_at" TIMESTAMPTZ(6),
    "generated_until" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: recurring_occurrences
CREATE TABLE "recurring_occurrences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "recurring_transaction_id" UUID NOT NULL,
    "due_on" DATE NOT NULL,
    "expected_amount_minor" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "occurrence_status" NOT NULL DEFAULT 'EXPECTED',
    "transaction_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "skipped_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id")
);

-- =============================================================================
-- 3. MODIFICATIONS DES TABLES EXISTANTES
-- =============================================================================

-- transactions : ajout debt_id
ALTER TABLE "transactions"
    ADD COLUMN "debt_id" UUID;

-- note_links : ajout debt_id
ALTER TABLE "note_links"
    ADD COLUMN "debt_id" UUID;

-- =============================================================================
-- 4. INDEX DE BASE ET UNICITÉS PRISMA
-- =============================================================================

CREATE UNIQUE INDEX "debts_user_id_id_key" ON "debts"("user_id", "id");
CREATE UNIQUE INDEX "debts_user_id_id_currency_key" ON "debts"("user_id", "id", "currency");
CREATE INDEX "ix_debts__counterparty" ON "debts"("user_id", "counterparty_id");

CREATE UNIQUE INDEX "debt_repayments_user_id_id_key" ON "debt_repayments"("user_id", "id");
CREATE UNIQUE INDEX "debt_repayments_user_id_debt_id_transaction_id_key" ON "debt_repayments"("user_id", "debt_id", "transaction_id");
CREATE UNIQUE INDEX "debt_repayments_user_id_transaction_id_key" ON "debt_repayments"("user_id", "transaction_id");
CREATE INDEX "ix_debt_repayments__debt" ON "debt_repayments"("user_id", "debt_id");

CREATE UNIQUE INDEX "recurring_transactions_user_id_id_key" ON "recurring_transactions"("user_id", "id");
CREATE INDEX "ix_recurring_transactions__status" ON "recurring_transactions"("user_id", "status");

CREATE UNIQUE INDEX "recurring_occurrences_user_id_id_key" ON "recurring_occurrences"("user_id", "id");
CREATE UNIQUE INDEX "recurring_occurrences_user_id_recurring_transaction_id_due_key" ON "recurring_occurrences"("user_id", "recurring_transaction_id", "due_on");

CREATE INDEX "ix_transactions__debt" ON "transactions"("user_id", "debt_id");

-- =============================================================================
-- 5. CLÉS ÉTRANGÈRES COMPOSITES (ADR-007)
-- =============================================================================

-- debts
ALTER TABLE "debts"
    ADD CONSTRAINT "debts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "debts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "debts_user_id_counterparty_id_fkey" FOREIGN KEY ("user_id", "counterparty_id") REFERENCES "counterparties"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- debt_repayments
ALTER TABLE "debt_repayments"
    ADD CONSTRAINT "debt_repayments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "debt_repayments_user_id_debt_id_currency_fkey" FOREIGN KEY ("user_id", "debt_id", "currency") REFERENCES "debts"("user_id", "id", "currency") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "debt_repayments_user_id_transaction_id_currency_fkey" FOREIGN KEY ("user_id", "transaction_id", "currency") REFERENCES "transactions"("user_id", "id", "currency") ON DELETE NO ACTION ON UPDATE CASCADE;

-- recurring_transactions
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_transactions_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_transactions_user_id_account_id_currency_fkey" FOREIGN KEY ("user_id", "account_id", "currency") REFERENCES "financial_accounts"("user_id", "id", "currency") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_transactions_user_id_destination_account_id_fkey" FOREIGN KEY ("user_id", "destination_account_id") REFERENCES "financial_accounts"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_transactions_user_id_category_id_fkey" FOREIGN KEY ("user_id", "category_id") REFERENCES "transaction_categories"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_transactions_user_id_counterparty_id_fkey" FOREIGN KEY ("user_id", "counterparty_id") REFERENCES "counterparties"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_transactions_user_id_project_id_fkey" FOREIGN KEY ("user_id", "project_id") REFERENCES "projects"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- recurring_occurrences
ALTER TABLE "recurring_occurrences"
    ADD CONSTRAINT "recurring_occurrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_occurrences_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE NO ACTION ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_occurrences_user_id_recurring_transaction_id_fkey" FOREIGN KEY ("user_id", "recurring_transaction_id") REFERENCES "recurring_transactions"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "recurring_occurrences_user_id_transaction_id_fkey" FOREIGN KEY ("user_id", "transaction_id") REFERENCES "transactions"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- transactions -> debts
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_user_id_debt_id_fkey" FOREIGN KEY ("user_id", "debt_id") REFERENCES "debts"("user_id", "id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- note_links -> debts
ALTER TABLE "note_links"
    ADD CONSTRAINT "note_links_user_id_debt_id_fkey" FOREIGN KEY ("user_id", "debt_id") REFERENCES "debts"("user_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- =============================================================================
-- 6. OBJETS SQL MANUELS (DATA_MODEL.md §2.2)
-- =============================================================================

-- ==== MANUAL: debts ====
ALTER TABLE "debts"
    ADD CONSTRAINT "ck_debts__principal_positive" CHECK ("principal_minor" > 0),
    ADD CONSTRAINT "ck_debts__due" CHECK ("due_date" IS NULL OR "due_date" >= "opened_on"),
    ADD CONSTRAINT "ck_debts__closing" CHECK (
        ("status" = 'CANCELLED') = ("cancelled_at" IS NOT NULL) AND
        ("status" = 'WRITTEN_OFF') = ("written_off_at" IS NOT NULL) AND
        ("status" = 'OPEN' OR "closing_reason" IS NOT NULL)
    );

CREATE INDEX "ix_debts__open"
    ON "debts" ("user_id", "type", "due_date") WHERE "status" = 'OPEN';

CREATE OR REPLACE FUNCTION public.orbit_debts_guard()
RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF current_user = 'orbit_maintenance' THEN
            RETURN OLD;
        END IF;
        RAISE EXCEPTION 'DELETING_DEBTS_FORBIDDEN'
            USING ERRCODE = '55000',
                  MESSAGE = 'Physical deletion of debts is forbidden. Use status CANCELLED or WRITTEN_OFF.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Interdiction de modifier les champs clés dès que le statut n'est pas OPEN ou en cas de clôture
        IF OLD.status <> 'OPEN' OR NEW.status <> 'OPEN' THEN
            IF NEW.type <> OLD.type OR
               NEW.currency <> OLD.currency OR
               NEW.principal_minor <> OLD.principal_minor OR
               NEW.counterparty_id <> OLD.counterparty_id OR
               NEW.opened_on <> OLD.opened_on THEN
                RAISE EXCEPTION 'DEBT_IMMUTABLE'
                    USING ERRCODE = '55000',
                          MESSAGE = 'Core debt fields cannot be modified during closure or once closed.';
            END IF;
        END IF;

        IF OLD.status <> 'OPEN' AND NEW.status <> OLD.status THEN
            RAISE EXCEPTION 'DEBT_IMMUTABLE'
                USING ERRCODE = '55000',
                      MESSAGE = 'Closed debts cannot be re-opened.';
        END IF;

        -- Vérification lors du passage en CANCELLED : aucun remboursement validé
        IF NEW.status = 'CANCELLED' AND OLD.status = 'OPEN' THEN
            IF EXISTS (
                SELECT 1
                FROM debt_repayments r
                JOIN transactions t ON t.user_id = r.user_id AND t.id = r.transaction_id
                WHERE r.user_id = OLD.user_id
                  AND r.debt_id = OLD.id
                  AND t.status = 'VALIDATED'
            ) THEN
                RAISE EXCEPTION 'CANNOT_CANCEL_DEBT_WITH_REPAYMENTS'
                    USING ERRCODE = '55000',
                          MESSAGE = 'Cannot cancel a debt with validated repayments.';
            END IF;
        END IF;

        -- Radiation : réservée aux créances (RECEIVABLE)
        IF NEW.status = 'WRITTEN_OFF' AND OLD.status = 'OPEN' THEN
            IF OLD.type <> 'RECEIVABLE' THEN
                RAISE EXCEPTION 'CANNOT_WRITE_OFF_PAYABLE_DEBT'
                    USING ERRCODE = '55000',
                          MESSAGE = 'Only receivables can be written off.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.orbit_debts_guard() SET search_path = public, pg_temp;

CREATE TRIGGER "trg_debts__guard"
    BEFORE UPDATE OR DELETE ON "debts"
    FOR EACH ROW EXECUTE FUNCTION orbit_debts_guard();

-- ==== MANUAL: debt_repayments ====
ALTER TABLE "debt_repayments"
    ADD CONSTRAINT "ck_debt_repayments__amount_positive" CHECK ("amount_minor" > 0);

CREATE OR REPLACE FUNCTION public.orbit_debt_repayments_guard()
RETURNS trigger AS $$
DECLARE
    v_tx_status public.transaction_status;
    v_tx_econ_class public.economic_class;
    v_tx_amount BIGINT;
    v_debt_type public.debt_type;
    v_debt_status public.debt_status;
    v_total_imputed BIGINT;
BEGIN
    -- 1. Verrouillage et contrôle de la transaction liée
    SELECT status, economic_class, amount_minor
    INTO v_tx_status, v_tx_econ_class, v_tx_amount
    FROM transactions
    WHERE user_id = NEW.user_id AND id = NEW.transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'TRANSACTION_NOT_FOUND'
            USING ERRCODE = '55000',
                  MESSAGE = 'Transaction for repayment not found.';
    END IF;

    IF v_tx_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'CANNOT_IMPUTE_CANCELLED_TRANSACTION'
            USING ERRCODE = '55000',
                  MESSAGE = 'Cannot impute repayment to a cancelled transaction.';
    END IF;

    -- 2. Contrôle de la dette liée
    SELECT type, status
    INTO v_debt_type, v_debt_status
    FROM debts
    WHERE user_id = NEW.user_id AND id = NEW.debt_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'DEBT_NOT_FOUND'
            USING ERRCODE = '55000',
                  MESSAGE = 'Debt for repayment not found.';
    END IF;

    IF v_debt_status <> 'OPEN' THEN
        RAISE EXCEPTION 'DEBT_NOT_OPEN'
            USING ERRCODE = '55000',
                  MESSAGE = 'Repayment can only be imputed to an OPEN debt.';
    END IF;

    -- 3. Correspondance de la classe économique
    IF v_debt_type = 'PAYABLE' AND v_tx_econ_class <> 'DEBT_REPAYMENT' THEN
        RAISE EXCEPTION 'INVALID_ECONOMIC_CLASS_FOR_PAYABLE_REPAYMENT'
            USING ERRCODE = '55000',
                  MESSAGE = 'Repayment of a payable debt must have economic class DEBT_REPAYMENT.';
    END IF;

    IF v_debt_type = 'RECEIVABLE' AND v_tx_econ_class <> 'LOAN_COLLECTION' THEN
        RAISE EXCEPTION 'INVALID_ECONOMIC_CLASS_FOR_RECEIVABLE_REPAYMENT'
            USING ERRCODE = '55000',
                  MESSAGE = 'Repayment of a receivable debt must have economic class LOAN_COLLECTION.';
    END IF;

    -- 4. Somme des imputations sur la transaction <= transaction.amount_minor
    SELECT COALESCE(SUM(amount_minor), 0)
    INTO v_total_imputed
    FROM debt_repayments
    WHERE user_id = NEW.user_id
      AND transaction_id = NEW.transaction_id
      AND id <> NEW.id;

    IF (v_total_imputed + NEW.amount_minor) > v_tx_amount THEN
        RAISE EXCEPTION 'IMPUTATION_EXCEEDS_TRANSACTION_AMOUNT'
            USING ERRCODE = '55000',
                  MESSAGE = 'Total debt repayments imputed to transaction exceed transaction amount.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION public.orbit_debt_repayments_guard() SET search_path = public, pg_temp;

CREATE TRIGGER "trg_debt_repayments__guard"
    BEFORE INSERT OR UPDATE ON "debt_repayments"
    FOR EACH ROW EXECUTE FUNCTION orbit_debt_repayments_guard();

-- ==== MANUAL: recurring_transactions ====
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "ck_recurring_transactions__type" CHECK ("type" IN ('INCOME', 'EXPENSE', 'TRANSFER')),
    ADD CONSTRAINT "ck_recurring_transactions__amount_positive" CHECK ("amount_minor" > 0),
    ADD CONSTRAINT "ck_recurring_transactions__transfer" CHECK (
        ("type" = 'TRANSFER') = ("destination_account_id" IS NOT NULL) AND
        "destination_account_id" IS DISTINCT FROM "account_id"
    ),
    ADD CONSTRAINT "ck_recurring_transactions__reminder_days" CHECK ("reminder_days_before" >= 0 AND "reminder_days_before" <= 30),
    ADD CONSTRAINT "ck_recurring_transactions__economic_class" CHECK (
        ("type" = 'INCOME' AND "economic_class" IN ('INCOME_OPERATING', 'INCOME_OTHER', 'GIFT_RECEIVED', 'LOAN_COLLECTION')) OR
        ("type" = 'EXPENSE' AND "economic_class" IN ('EXPENSE_OPERATING', 'EXPENSE_FEE', 'GIFT_GIVEN', 'DEBT_REPAYMENT')) OR
        ("type" = 'TRANSFER' AND "economic_class" = 'INTERNAL_TRANSFER')
    ),
    ADD CONSTRAINT "ck_recurring_transactions__recurrence_syntax" CHECK (
        "recurrence_rule" ~ '^FREQ=(WEEKLY|MONTHLY|QUARTERLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$'
    );

CREATE INDEX "ix_recurring_transactions__next"
    ON "recurring_transactions" ("next_occurrence_at") WHERE "status" = 'ACTIVE';

-- ==== MANUAL: recurring_occurrences ====
ALTER TABLE "recurring_occurrences"
    ADD CONSTRAINT "ck_recurring_occurrences__amount_positive" CHECK ("expected_amount_minor" > 0),
    ADD CONSTRAINT "ck_recurring_occurrences__confirmed" CHECK (
        ("status" = 'CONFIRMED') = ("confirmed_at" IS NOT NULL) AND
        ("status" <> 'CONFIRMED' OR "transaction_id" IS NOT NULL)
    ),
    ADD CONSTRAINT "ck_recurring_occurrences__skipped" CHECK (
        ("status" = 'SKIPPED') = ("skipped_at" IS NOT NULL)
    );

CREATE UNIQUE INDEX "ux_recurring_occurrences__transaction"
    ON "recurring_occurrences" ("user_id", "transaction_id") WHERE "transaction_id" IS NOT NULL;

CREATE INDEX "ix_recurring_occurrences__expected"
    ON "recurring_occurrences" ("user_id", "due_on") WHERE "status" = 'EXPECTED';

-- ==== MANUAL: transactions (lien dette d'origine) ====
ALTER TABLE "transactions"
    ADD CONSTRAINT "ck_transactions__debt_link" CHECK ("debt_id" IS NULL OR "type" IN ('BORROWING', 'LOAN'));

-- ==== MANUAL: note_links (mise à jour pour cible dette) ====
ALTER TABLE "note_links"
    DROP CONSTRAINT "ck_note_links__one_target",
    ADD CONSTRAINT "ck_note_links__one_target" CHECK (
        num_nonnulls("idea_id", "project_id", "task_id", "transaction_id", "counterparty_id", "debt_id") = 1
    );

CREATE UNIQUE INDEX "ux_note_links__debt"
    ON "note_links" ("user_id", "debt_id", "note_id") WHERE "debt_id" IS NOT NULL;

-- ==== MANUAL: permissions rôle applicatif ====
GRANT SELECT, INSERT, UPDATE, DELETE ON
    "debts",
    "debt_repayments",
    "recurring_transactions",
    "recurring_occurrences"
TO orbit_app;
