import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

/** Doit refléter prisma/manual-objects.md (DATA_MODEL.md §2.2) : un objet manquant fait échouer la CI. */
const CONSTRAINTS = [
  'ck_users__email_format',
  'ck_users__failed_login_count',
  'ck_sessions__token_hash_len',
  'ck_sessions__expiry',
  'ck_sessions__revocation',
  'ck_email_verification_tokens__token_hash_len',
  'ck_email_verification_tokens__expiry',
  'ck_password_reset_tokens__token_hash_len',
  'ck_password_reset_tokens__ttl',
  'ck_user_preferences__currency_format',
  'ck_user_preferences__week_starts_on',
  'ck_login_events__email_hmac_len',
  'ck_audit_logs__metadata_size',
  'ck_audit_logs__entity',
  // PHASE-04 (M03)
  'ck_ideas__potential_score',
  'ck_ideas__description_len',
  'ck_ideas__title_not_blank',
  'ck_ideas__version',
  'ck_projects__slug_format',
  'ck_projects__dates',
  'ck_projects__completed',
  'ck_projects__color',
  'ck_projects__version',
  'ck_tasks__done',
  'ck_tasks__due',
  'ck_tasks__not_own_parent',
  'ck_tasks__series',
  'ck_tasks__minutes',
  'ck_tasks__recurrence_complete',
  'ck_tasks__recurrence_syntax',
  'ck_tasks__description_len',
  'ck_tasks__title_not_blank',
  'ck_tasks__version',
  'ck_task_dependencies__not_self',
  'ck_tags__name_len',
  'ck_tags__color',
  'ck_notes__content_len',
  'ck_notes__version',
  'ck_note_links__one_target',
  // PHASE-05 (M04)
  'ck_currencies__code',
  'ck_currencies__exponent',
  'ck_financial_accounts__opening',
  'ck_financial_accounts__overdraft',
  'ck_transaction_categories__system',
  'ck_transaction_categories__not_own_parent',
  'ck_transaction_categories__class',
  'ck_transactions__amount_positive',
  'ck_transactions__validated',
  'ck_transactions__cancelled',
  'ck_transactions__fee',
  'ck_transactions__refund',
  'ck_transactions__rate',
  'ck_transactions__economic_class',
  'ck_ledger_entries__amount_positive',
  'ck_idempotency_keys__completed',
  'ck_projects__budget',
  // PHASE-06 (M05)
  'ck_debts__principal_positive',
  'ck_debts__due',
  'ck_debts__closing',
  'ck_debt_repayments__amount_positive',
  'ck_recurring_transactions__type',
  'ck_recurring_transactions__amount_positive',
  'ck_recurring_transactions__transfer',
  'ck_recurring_transactions__reminder_days',
  'ck_recurring_transactions__economic_class',
  'ck_recurring_transactions__recurrence_syntax',
  'ck_recurring_occurrences__amount_positive',
  'ck_recurring_occurrences__confirmed',
  'ck_recurring_occurrences__skipped',
  'ck_transactions__debt_link',
];
const INDEXES = [
  'ux_users__single_admin',
  'ix_sessions__user_active',
  'ux_email_verification_tokens__active',
  'ux_password_reset_tokens__active',
  'ix_login_events__email_hmac_time',
  'ix_login_events__time_brin',
  'ix_audit_logs__time_brin',
  // PHASE-04 (M03)
  'ux_ideas__client_capture',
  'ix_ideas__user_captured',
  'ix_ideas__user_status',
  'ix_ideas__title_trgm',
  'ix_ideas__converted_project',
  'ux_projects__slug',
  'ix_projects__user_status',
  'ux_tasks__client_capture',
  'ux_tasks__series_occurrence',
  'ix_tasks__project',
  'ix_tasks__parent',
  'ix_tasks__next_occurrence',
  'ix_tasks__open_due',
  'ix_tasks__idea',
  'ix_tasks__project_fk',
  'ux_notes__client_capture',
  'ix_notes__user_updated',
  'ix_notes__pinned',
  'ux_note_links__idea',
  'ux_note_links__project',
  'ux_note_links__task',
  // PHASE-05 (M04)
  'ux_financial_accounts__name',
  'ux_transaction_categories__name',
  'ix_counterparties__name_trgm',
  'ux_transactions__idempotency',
  'ix_transactions__description_trgm',
  'ux_note_links__transaction',
  'ux_note_links__counterparty',
  // PHASE-06 (M05)
  'ix_debts__open',
  'ix_recurring_transactions__next',
  'ux_recurring_occurrences__transaction',
  'ix_recurring_occurrences__expected',
  'ux_note_links__debt',
];
const TRIGGERS = [
  'trg_task_dependencies__no_cycle',
  'trg_login_events__append_only',
  'trg_login_events__no_truncate',
  'trg_audit_logs__append_only',
  'trg_audit_logs__no_truncate',
  // PHASE-05 (M04)
  'trg_financial_accounts__guard',
  'trg_transactions__guard',
  'trg_ledger_entries__guard',
  'trg_transactions__entries_shape',
  'trg_ledger_entries__entries_shape',
  // PHASE-06 (M05)
  'trg_debts__guard',
  'trg_debt_repayments__guard',
];

const AUDIT_ID = '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f81';

describe('manual SQL objects (prisma/manual-objects.md)', () => {
  let owner: PrismaClient;
  let app: PrismaClient;

  beforeAll(() => {
    owner = new PrismaClient({ datasourceUrl: inject('ownerDatabaseUrl') });
    app = new PrismaClient({ datasourceUrl: inject('databaseUrl') });
  });

  afterAll(async () => {
    await Promise.all([owner.$disconnect(), app.$disconnect()]);
  });

  it('has every registered constraint, index and trigger', async () => {
    const constraints = await owner.$queryRaw<{ conname: string }[]>`SELECT conname FROM pg_constraint`;
    const indexes = await owner.$queryRaw<{ indexname: string }[]>`SELECT indexname FROM pg_indexes`;
    const triggers = await owner.$queryRaw<{ tgname: string }[]>`SELECT tgname FROM pg_trigger`;
    expect(constraints.map((row) => row.conname)).toEqual(expect.arrayContaining(CONSTRAINTS));
    expect(indexes.map((row) => row.indexname)).toEqual(expect.arrayContaining(INDEXES));
    expect(triggers.map((row) => row.tgname)).toEqual(expect.arrayContaining(TRIGGERS));
  });

  it('lets orbit_app append to audit_logs but never rewrite or delete it', async () => {
    await app.$executeRaw`INSERT INTO audit_logs (id, actor_type, action) VALUES (${AUDIT_ID}::uuid, 'SYSTEM', 'test.audit.appended')`;
    await expect(
      app.$executeRaw`UPDATE audit_logs SET action = 'tampered' WHERE id = ${AUDIT_ID}::uuid`,
    ).rejects.toThrow(/permission denied/i);
    await expect(app.$executeRaw`DELETE FROM audit_logs WHERE id = ${AUDIT_ID}::uuid`).rejects.toThrow(
      /permission denied/i,
    );
  });

  it('refuses log mutations even for the owner (append-only trigger)', async () => {
    await expect(owner.$executeRaw`DELETE FROM audit_logs WHERE id = ${AUDIT_ID}::uuid`).rejects.toThrow(
      /append-only/,
    );
    await expect(owner.$executeRaw`TRUNCATE login_events`).rejects.toThrow(/append-only/);
  });

  it('enforces a single ADMIN account', async () => {
    await owner.$executeRaw`DELETE FROM users WHERE role = 'ADMIN'`;
    const insertAdmin = (id: string, email: string) =>
      owner.$executeRaw`INSERT INTO users (id, email, password_hash, display_name, role) VALUES (${id}::uuid, ${email}, 'x', 'Admin', 'ADMIN')`;
    await insertAdmin('0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f90', 'admin-one@example.test');
    await expect(
      insertAdmin('0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f91', 'admin-two@example.test'),
    ).rejects.toThrow(/23505|unique constraint/i);
    await owner.$executeRaw`DELETE FROM users WHERE id = '0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f90'::uuid`;
  });
});
