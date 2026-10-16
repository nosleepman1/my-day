import { randomUUID } from 'node:crypto';

import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

/**
 * Tests des invariants garantis au niveau de la base de données pour la PHASE-05 (Finance cœur).
 * Conforme à DATA_MODEL.md §3.4 (M04).
 */
describe('finance schema invariants (PHASE-05)', () => {
  let app: PrismaClient;
  let userId: string;
  let otherUserId: string;

  const insertUser = async (id: string) => {
    await app.$executeRaw`INSERT INTO users (id, email, password_hash, display_name) VALUES (${id}::uuid, ${`${id}@example.test`}, 'x', 'Finance')`;
  };

  interface AccountOptions {
    currency?: string;
    name?: string;
    allowOverdraft?: boolean;
    id?: string;
  }
  const insertAccount = async (owner: string, opts: AccountOptions = {}) => {
    const id = opts.id ?? randomUUID();
    const currency = opts.currency ?? 'XOF';
    const name = opts.name ?? `Compte-${Date.now()}-${Math.random()}`;
    const allowOverdraft = opts.allowOverdraft ?? false;
    await app.$executeRaw`
      INSERT INTO financial_accounts (id, user_id, name, type, currency, opening_balance_minor, opened_on, allow_overdraft)
      VALUES (${id}::uuid, ${owner}::uuid, ${name}, 'CASH'::account_type, ${currency}, 0, '2026-10-15', ${allowOverdraft})
    `;
    return id;
  };

  interface CategoryOptions {
    name?: string;
    kind?: string;
    economicClass?: string;
    id?: string;
  }
  const insertCategory = async (owner: string, opts: CategoryOptions = {}) => {
    const id = opts.id ?? randomUUID();
    const name = opts.name ?? `Cat-${Date.now()}-${Math.random()}`;
    const kind = opts.kind ?? 'EXPENSE';
    const economicClass = opts.economicClass ?? 'EXPENSE_OPERATING';
    await app.$executeRaw`
      INSERT INTO transaction_categories (id, user_id, name, kind, default_economic_class)
      VALUES (${id}::uuid, ${owner}::uuid, ${name}, ${kind}::category_kind, ${economicClass}::economic_class)
    `;
    return id;
  };

  interface TransactionOptions {
    currency?: string;
    type?: string;
    status?: string;
    economicClass?: string;
    id?: string;
  }
  const insertTransaction = async (owner: string, amountMinor: bigint, opts: TransactionOptions = {}) => {
    const id = opts.id ?? randomUUID();
    const currency = opts.currency ?? 'XOF';
    const type = opts.type ?? 'EXPENSE';
    const status = opts.status ?? 'PENDING';
    const economicClass = opts.economicClass ?? 'EXPENSE_OPERATING';
    await app.$executeRaw`
      INSERT INTO transactions (id, user_id, type, status, economic_class, amount_minor, currency, occurred_at, value_date, source)
      VALUES (${id}::uuid, ${owner}::uuid, ${type}::transaction_type, ${status}::transaction_status, ${economicClass}::economic_class, ${amountMinor}, ${currency}, now(), '2026-10-15', 'MANUAL'::transaction_source)
    `;
    return id;
  };

  interface LedgerEntryOptions {
    direction: 'DEBIT' | 'CREDIT';
    amountMinor: bigint;
    currency?: string;
  }

  const insertTransactionWithEntry = async (
    owner: string,
    amountMinor: bigint,
    accountId: string,
    opts: TransactionOptions & Partial<LedgerEntryOptions> = {},
  ) => {
    const id = opts.id ?? randomUUID();
    const currency = opts.currency ?? 'XOF';
    const type = opts.type ?? 'EXPENSE';
    const status = opts.status ?? 'PENDING';
    const economicClass = opts.economicClass ?? 'EXPENSE_OPERATING';
    const direction = opts.direction ?? (type === 'INCOME' ? 'CREDIT' : 'DEBIT');
    const entryId = randomUUID();
    await app.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO transactions (id, user_id, type, status, economic_class, amount_minor, currency, occurred_at, value_date, source)
        VALUES (${id}::uuid, ${owner}::uuid, ${type}::transaction_type, ${status}::transaction_status, ${economicClass}::economic_class, ${amountMinor}, ${currency}, now(), '2026-10-15', 'MANUAL'::transaction_source)
      `;
      await tx.$executeRaw`
        INSERT INTO ledger_entries (id, user_id, transaction_id, account_id, direction, amount_minor, currency)
        VALUES (${entryId}::uuid, ${owner}::uuid, ${id}::uuid, ${accountId}::uuid, ${direction}::entry_direction, ${amountMinor}, ${currency})
      `;
    });
    return id;
  };

  beforeAll(async () => {
    app = new PrismaClient({ datasourceUrl: inject('databaseUrl') });
    userId = randomUUID();
    otherUserId = randomUUID();
    await insertUser(userId);
    await insertUser(otherUserId);
  });

  afterAll(async () => {
    await app.$disconnect();
  });

  describe('currencies table', () => {
    it('contains the reference currencies including XOF, XAF, EUR, USD, GBP', async () => {
      const currencies = await app.$queryRaw<{ code: string; exponent: number }[]>`
        SELECT code, exponent FROM currencies WHERE code IN ('XOF', 'XAF', 'EUR', 'USD', 'GBP') ORDER BY code
      `;
      expect(currencies).toEqual([
        { code: 'EUR', exponent: 2 },
        { code: 'GBP', exponent: 2 },
        { code: 'USD', exponent: 2 },
        { code: 'XAF', exponent: 0 },
        { code: 'XOF', exponent: 0 },
      ]);
    });

    it('rejects an invalid currency code format', async () => {
      await expect(
        app.$executeRaw`INSERT INTO currencies (code, numeric_code, exponent, symbol, name_fr) VALUES ('xof', 999, 0, 'F', 'Test')`,
      ).rejects.toThrow(/ck_currencies__code/);
    });

    it('rejects an exponent outside 0-4', async () => {
      await expect(
        app.$executeRaw`INSERT INTO currencies (code, numeric_code, exponent, symbol, name_fr) VALUES ('ZZZ', 999, 5, 'Z', 'Test')`,
      ).rejects.toThrow(/ck_currencies__exponent/);
    });
  });

  describe('financial_accounts table', () => {
    it('enforces composite foreign keys preventing linking across users', async () => {
      const foreignAccount = await insertAccount(otherUserId);
      await expect(
        app.$transaction(async (tx) => {
          const txId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO transactions (id, user_id, type, status, economic_class, amount_minor, currency, occurred_at, value_date, source)
            VALUES (${txId}::uuid, ${userId}::uuid, 'EXPENSE'::transaction_type, 'PENDING'::transaction_status, 'EXPENSE_OPERATING'::economic_class, 1000, 'XOF', now(), '2026-10-15', 'MANUAL'::transaction_source)
          `;
          await tx.$executeRaw`
            INSERT INTO ledger_entries (id, user_id, transaction_id, account_id, direction, amount_minor, currency)
            VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${txId}::uuid, ${foreignAccount}::uuid, 'DEBIT'::entry_direction, 1000, 'XOF')
          `;
        }),
      ).rejects.toThrow(/foreign key|23503/i);
    });

    it('enforces currency match between account and ledger entry at the database level', async () => {
      const xofAccount = await insertAccount(userId, { currency: 'XOF' });
      await expect(
        app.$transaction(async (tx) => {
          const txId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO transactions (id, user_id, type, status, economic_class, amount_minor, currency, occurred_at, value_date, source)
            VALUES (${txId}::uuid, ${userId}::uuid, 'EXPENSE'::transaction_type, 'PENDING'::transaction_status, 'EXPENSE_OPERATING'::economic_class, 100, 'EUR', now(), '2026-10-15', 'MANUAL'::transaction_source)
          `;
          await tx.$executeRaw`
            INSERT INTO ledger_entries (id, user_id, transaction_id, account_id, direction, amount_minor, currency)
            VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${txId}::uuid, ${xofAccount}::uuid, 'DEBIT'::entry_direction, 100, 'EUR')
          `;
        }),
      ).rejects.toThrow(/foreign key|23503/i);
    });

    it('forbids negative opening balance when allow_overdraft is false', async () => {
      await expect(
        app.$executeRaw`
          INSERT INTO financial_accounts (id, user_id, name, type, currency, opening_balance_minor, opened_on, allow_overdraft)
          VALUES (${randomUUID()}::uuid, ${userId}::uuid, 'Neg', 'CASH'::account_type, 'XOF', -100, '2026-10-15', false)
        `,
      ).rejects.toThrow(/ck_financial_accounts__opening/);
    });

    it('protects currency immutability via trigger', async () => {
      const accountId = await insertAccount(userId, { currency: 'XOF' });
      await expect(
        app.$executeRaw`UPDATE financial_accounts SET currency = 'EUR' WHERE id = ${accountId}::uuid`,
      ).rejects.toThrow(/currency is immutable/i);
    });

    it('protects opening_balance_minor immutability once ledger entries exist', async () => {
      const accountId = await insertAccount(userId, { currency: 'XOF' });
      await insertTransactionWithEntry(userId, 1000n, accountId);
      await expect(
        app.$executeRaw`UPDATE financial_accounts SET opening_balance_minor = 500 WHERE id = ${accountId}::uuid`,
      ).rejects.toThrow(/opening_balance_minor is immutable once ledger entries exist/i);
    });
  });

  describe('transaction_categories table', () => {
    it('prevents duplicate active category names for the same parent', async () => {
      const name = `DupCat-${Date.now()}`;
      await insertCategory(userId, { name });
      await expect(insertCategory(userId, { name })).rejects.toThrow(/ux_transaction_categories__name|23505/);
    });

    it('enforces economic class coherence with kind', async () => {
      await expect(
        app.$executeRaw`
          INSERT INTO transaction_categories (id, user_id, name, kind, default_economic_class)
          VALUES (${randomUUID()}::uuid, ${userId}::uuid, 'Bad', 'INCOME'::category_kind, 'EXPENSE_OPERATING'::economic_class)
        `,
      ).rejects.toThrow(/ck_transaction_categories__class/);
    });
  });

  describe('transactions and ledger_entries tables', () => {
    it('rejects a non-positive amount on transactions and ledger entries', async () => {
      await expect(insertTransaction(userId, 0n)).rejects.toThrow(/ck_transactions__amount_positive/);

      const accountId = await insertAccount(userId);
      await expect(
        app.$transaction(async (tx) => {
          const txId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO transactions (id, user_id, type, status, economic_class, amount_minor, currency, occurred_at, value_date, source)
            VALUES (${txId}::uuid, ${userId}::uuid, 'EXPENSE'::transaction_type, 'PENDING'::transaction_status, 'EXPENSE_OPERATING'::economic_class, 1000, 'XOF', now(), '2026-10-15', 'MANUAL'::transaction_source)
          `;
          await tx.$executeRaw`
            INSERT INTO ledger_entries (id, user_id, transaction_id, account_id, direction, amount_minor, currency)
            VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${txId}::uuid, ${accountId}::uuid, 'DEBIT'::entry_direction, 0, 'XOF')
          `;
        }),
      ).rejects.toThrow(/ck_ledger_entries__amount_positive/);
    });

    it('forbids updating ledger_entries and only allows INSERT/DELETE when transaction is PENDING', async () => {
      const accountId = await insertAccount(userId);
      const txId = await insertTransactionWithEntry(userId, 1000n, accountId, {
        currency: 'XOF',
        type: 'EXPENSE',
        status: 'PENDING',
      });

      // UPDATE always forbidden on ledger_entries
      await expect(
        app.$executeRaw`UPDATE ledger_entries SET amount_minor = 2000 WHERE transaction_id = ${txId}::uuid`,
      ).rejects.toThrow(/ledger_entries is append-only|immutable/i);

      // Validate transaction
      await app.$executeRaw`UPDATE transactions SET status = 'VALIDATED'::transaction_status, validated_at = now() WHERE id = ${txId}::uuid`;

      // DELETE forbidden when transaction is VALIDATED
      await expect(
        app.$executeRaw`DELETE FROM ledger_entries WHERE transaction_id = ${txId}::uuid`,
      ).rejects.toThrow(/cannot mutate ledger entries for non-pending transaction/i);
    });

    it('forbids hard DELETE of transactions in production', async () => {
      const accountId = await insertAccount(userId);
      const txId = await insertTransactionWithEntry(userId, 1000n, accountId);
      await expect(app.$executeRaw`DELETE FROM transactions WHERE id = ${txId}::uuid`).rejects.toThrow(
        /hard delete of transactions is forbidden/i,
      );
    });

    it('enforces shape of entries per transaction type via deferrable constraint trigger', async () => {
      // EXPENSE requires exactly 1 DEBIT
      await expect(
        app.$transaction(async (tx) => {
          const txId = randomUUID();
          await tx.$executeRaw`
            INSERT INTO transactions (id, user_id, type, status, economic_class, amount_minor, currency, occurred_at, value_date, source)
            VALUES (${txId}::uuid, ${userId}::uuid, 'EXPENSE'::transaction_type, 'PENDING'::transaction_status, 'EXPENSE_OPERATING'::economic_class, 1000, 'XOF', now(), '2026-10-15', 'MANUAL'::transaction_source)
          `;
          // No ledger entry added -> should fail at commit!
        }),
      ).rejects.toThrow(/trg_transactions__entries_shape|requires exactly 1 DEBIT ledger entry/i);
    });
  });

  describe('note_links extension for finance', () => {
    it('accepts transaction_id and counterparty_id as valid single targets', async () => {
      const noteId = randomUUID();
      await app.$executeRaw`INSERT INTO notes (id, user_id, content) VALUES (${noteId}::uuid, ${userId}::uuid, 'Note test')`;

      const accountId = await insertAccount(userId);
      const txId = await insertTransactionWithEntry(userId, 1000n, accountId);
      const linkId = randomUUID();
      await app.$executeRaw`
        INSERT INTO note_links (id, user_id, note_id, transaction_id)
        VALUES (${linkId}::uuid, ${userId}::uuid, ${noteId}::uuid, ${txId}::uuid)
      `;

      const found = await app.$queryRaw<
        { id: string }[]
      >`SELECT id::text FROM note_links WHERE id = ${linkId}::uuid`;
      expect(found).toHaveLength(1);
    });
  });

  describe('projects budget extension for finance', () => {
    it('enforces that budget_minor and budget_currency are set together with non-negative minor', async () => {
      const projectId = randomUUID();
      await expect(
        app.$executeRaw`
          INSERT INTO projects (id, user_id, name, slug, budget_minor)
          VALUES (${projectId}::uuid, ${userId}::uuid, 'Proj', ${`proj-${Date.now()}`}, 1000)
        `,
      ).rejects.toThrow(/ck_projects__budget/);

      await expect(
        app.$executeRaw`
          INSERT INTO projects (id, user_id, name, slug, budget_minor, budget_currency)
          VALUES (${projectId}::uuid, ${userId}::uuid, 'Proj', ${`proj-${Date.now()}`}, -50, 'XOF')
        `,
      ).rejects.toThrow(/ck_projects__budget/);
    });
  });
});
