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
];
const INDEXES = [
  'ux_users__single_admin',
  'ix_sessions__user_active',
  'ux_email_verification_tokens__active',
  'ux_password_reset_tokens__active',
  'ix_login_events__email_hmac_time',
  'ix_login_events__time_brin',
  'ix_audit_logs__time_brin',
];
const TRIGGERS = [
  'trg_login_events__append_only',
  'trg_login_events__no_truncate',
  'trg_audit_logs__append_only',
  'trg_audit_logs__no_truncate',
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
    const insertAdmin = (id: string, email: string) =>
      owner.$executeRaw`INSERT INTO users (id, email, password_hash, display_name, role) VALUES (${id}::uuid, ${email}, 'x', 'Admin', 'ADMIN')`;
    await insertAdmin('0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f90', 'admin-one@example.test');
    await expect(
      insertAdmin('0192f1c3-7a2b-7c1e-9d0f-3b4c5d6e7f91', 'admin-two@example.test'),
    ).rejects.toThrow(/23505|unique constraint/i);
  });
});
