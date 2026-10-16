import type { FinancialAccount } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type { OccurrenceWithRelations, RecurringTransactionWithRelations } from './recurring.repository';
import { RecurringRepository } from './recurring.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const RECURRING_1 = '01927000-0000-7000-8000-000000000010';
const OCCURRENCE_1 = '01927000-0000-7000-8000-000000000020';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000030';
const ACCOUNT_DEST = '01927000-0000-7000-8000-000000000035';
const CATEGORY_1 = '01927000-0000-7000-8000-000000000040';
const TX_1 = '01927000-0000-7000-8000-000000000050';
const ENTRY_1 = '01927000-0000-7000-8000-000000000060';
const ENTRY_DEST = '01927000-0000-7000-8000-000000000065';

describe('RecurringRepository', () => {
  let repository: RecurringRepository;
  let mockAccountLocking: {
    lockAccounts: ReturnType<typeof vi.fn>;
  };
  let mockTx: {
    recurringTransaction: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    recurringOccurrence: {
      createMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    financialAccount: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    ledgerEntry: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    transaction: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  let mockCtx: {
    db: {
      $transaction: ReturnType<typeof vi.fn>;
      recurringTransaction: typeof mockTx.recurringTransaction;
      recurringOccurrence: typeof mockTx.recurringOccurrence;
      financialAccount: typeof mockTx.financialAccount;
      ledgerEntry: typeof mockTx.ledgerEntry;
      transaction: typeof mockTx.transaction;
    };
  };

  const sampleAccount: FinancialAccount = {
    id: ACCOUNT_1,
    userId: USER_1,
    name: 'Compte Principal',
    type: 'BANK',
    provider: 'Bank',
    currency: 'XOF',
    openingBalanceMinor: 500_000n,
    openedOn: new Date('2026-01-01T00:00:00.000Z'),
    allowOverdraft: false,
    overdraftLimitMinor: 0n,
    includeInNetWorth: true,
    color: '#000000',
    icon: 'bank',
    sortOrder: 0,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleRecurring: RecurringTransactionWithRelations = {
    id: RECURRING_1,
    userId: USER_1,
    name: 'Loyer',
    type: 'EXPENSE',
    economicClass: 'EXPENSE_OPERATING',
    amountMinor: 150_000n,
    currency: 'XOF',
    accountId: ACCOUNT_1,
    destinationAccountId: null,
    categoryId: CATEGORY_1,
    counterpartyId: null,
    projectId: null,
    generationMode: 'CONFIRM',
    reminderDaysBefore: 3,
    status: 'ACTIVE',
    recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=5',
    recurrenceAnchorOn: new Date('2026-02-05T00:00:00.000Z'),
    recurrenceTimezone: 'UTC',
    recurrenceLocalTime: null,
    nextOccurrenceAt: new Date('2026-03-05T00:00:00.000Z'),
    generatedUntil: null,
    notes: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };

  const sampleOccurrence: OccurrenceWithRelations = {
    id: OCCURRENCE_1,
    userId: USER_1,
    recurringTransactionId: RECURRING_1,
    dueOn: new Date('2026-03-05T00:00:00.000Z'),
    expectedAmountMinor: 150_000n,
    currency: 'XOF',
    status: 'EXPECTED',
    transactionId: null,
    confirmedAt: null,
    skippedAt: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    recurringTransaction: {
      id: RECURRING_1,
      name: 'Loyer',
      type: 'EXPENSE',
      economicClass: 'EXPENSE_OPERATING',
      accountId: ACCOUNT_1,
    },
  };

  beforeEach(() => {
    mockAccountLocking = {
      lockAccounts: vi.fn().mockResolvedValue(undefined),
    };

    mockTx = {
      recurringTransaction: {
        create: vi.fn().mockResolvedValue(sampleRecurring),
        findFirst: vi.fn().mockResolvedValue(sampleRecurring),
        findMany: vi.fn().mockResolvedValue([sampleRecurring]),
        update: vi.fn().mockResolvedValue(sampleRecurring),
      },
      recurringOccurrence: {
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findFirst: vi.fn().mockResolvedValue(sampleOccurrence),
        findMany: vi.fn().mockResolvedValue([sampleOccurrence]),
        update: vi.fn().mockResolvedValue({ ...sampleOccurrence, status: 'CONFIRMED' }),
      },
      financialAccount: {
        findFirst: vi.fn().mockResolvedValue(sampleAccount),
        findMany: vi.fn().mockResolvedValue([sampleAccount]),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: ENTRY_1 }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: TX_1 }),
        update: vi.fn().mockResolvedValue({ id: TX_1, status: 'VALIDATED' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    mockCtx = {
      db: {
        $transaction: vi.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(mockTx)),
        ...mockTx,
      },
    };

    repository = new RecurringRepository(
      mockCtx as unknown as FinanceContext,
      mockAccountLocking as unknown as AccountLockingQueries,
    );
  });

  describe('create and findById', () => {
    it('creates recurring transaction with relations', async () => {
      const res = await repository.create({
        id: RECURRING_1,
        userId: USER_1,
        name: 'Loyer',
        type: 'EXPENSE',
        economicClass: 'EXPENSE_OPERATING',
        amountMinor: 150_000n,
        currency: 'XOF',
        accountId: ACCOUNT_1,
        generationMode: 'CONFIRM',
        reminderDaysBefore: 3,
        recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=5',
        recurrenceAnchorOn: new Date('2026-02-05'),
        recurrenceTimezone: 'UTC',
      });

      expect(res).toEqual(sampleRecurring);
      expect(mockCtx.db.recurringTransaction.create).toHaveBeenCalled();
    });

    it('finds recurring transaction by id', async () => {
      const res = await repository.findById(USER_1, RECURRING_1);
      expect(res).toEqual(sampleRecurring);
      expect(mockCtx.db.recurringTransaction.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_1, id: RECURRING_1 },
        include: expect.any(Object),
      });
    });
  });

  describe('list and update', () => {
    it('lists recurring transactions with filters', async () => {
      const res = await repository.list(USER_1, {
        limit: 10,
        status: 'ACTIVE',
        type: 'EXPENSE',
        accountId: ACCOUNT_1,
      });

      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBeUndefined();
    });

    it('returns nextCursor when list exceeds limit', async () => {
      mockTx.recurringTransaction.findMany.mockResolvedValueOnce([
        sampleRecurring,
        { ...sampleRecurring, id: 'next_id' },
      ]);

      const res = await repository.list(USER_1, { limit: 1 });
      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBe(sampleRecurring.id);
    });

    it('updates recurring transaction fields', async () => {
      await repository.update(USER_1, RECURRING_1, {
        name: 'Loyer réévalué',
        amountMinor: 160_000n,
      });

      expect(mockCtx.db.recurringTransaction.update).toHaveBeenCalledWith({
        where: { userId_id: { userId: USER_1, id: RECURRING_1 } },
        data: { name: 'Loyer réévalué', amountMinor: 160_000n },
        include: expect.any(Object),
      });
    });

    it('updates recurring status and nextOccurrenceAt', async () => {
      await repository.updateStatus(USER_1, RECURRING_1, 'PAUSED', null);

      expect(mockCtx.db.recurringTransaction.update).toHaveBeenCalledWith({
        where: { userId_id: { userId: USER_1, id: RECURRING_1 } },
        data: { status: 'PAUSED', nextOccurrenceAt: null },
        include: expect.any(Object),
      });
    });
  });

  describe('occurrences operations', () => {
    it('creates occurrences batch', async () => {
      const count = await repository.createOccurrencesBatch([
        {
          id: OCCURRENCE_1,
          userId: USER_1,
          recurringTransactionId: RECURRING_1,
          dueOn: new Date('2026-03-05'),
          expectedAmountMinor: 150_000n,
          currency: 'XOF',
          status: 'EXPECTED',
        },
      ]);

      expect(count).toBe(2);
      expect(mockCtx.db.recurringOccurrence.createMany).toHaveBeenCalled();
    });

    it('returns 0 when batch is empty', async () => {
      const count = await repository.createOccurrencesBatch([]);
      expect(count).toBe(0);
      expect(mockCtx.db.recurringOccurrence.createMany).not.toHaveBeenCalled();
    });

    it('finds occurrence by id', async () => {
      const res = await repository.findOccurrenceById(USER_1, OCCURRENCE_1);
      expect(res).toEqual(sampleOccurrence);
    });

    it('lists occurrences with filters and date range', async () => {
      const res = await repository.listOccurrences(USER_1, {
        limit: 10,
        status: 'EXPECTED',
        recurringTransactionId: RECURRING_1,
        accountId: ACCOUNT_1,
        from: '2026-03-01',
        to: '2026-03-31',
      });

      expect(res.items).toHaveLength(1);
    });

    it('attaches occurrence to transaction', async () => {
      await repository.attachOccurrenceTransaction(
        USER_1,
        OCCURRENCE_1,
        TX_1,
        new Date('2026-02-01T10:00:00.000Z'),
      );
      expect(mockCtx.db.recurringOccurrence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED', transactionId: TX_1 }),
        }),
      );
    });

    it('skips occurrence', async () => {
      await repository.skipOccurrence(USER_1, OCCURRENCE_1, new Date('2026-02-01T10:00:00.000Z'));
      expect(mockCtx.db.recurringOccurrence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'SKIPPED' }),
        }),
      );
    });
  });

  describe('confirmOccurrenceWithTransaction', () => {
    it('confirms EXPENSE occurrence with new transaction', async () => {
      await repository.confirmOccurrenceWithTransaction({
        userId: USER_1,
        occurrenceId: OCCURRENCE_1,
        transactionId: TX_1,
        ledgerEntryId: ENTRY_1,
        accountId: ACCOUNT_1,
        amountMinor: 150_000n,
        currency: 'XOF',
        type: 'EXPENSE',
        economicClass: 'EXPENSE_OPERATING',
        valueDate: new Date('2026-03-05'),
        description: 'Loyer Mars',
        confirmedAt: new Date('2026-03-05'),
      });

      expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_1]);
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'EXPENSE', status: 'PENDING' }),
        }),
      );
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ direction: 'DEBIT', amountMinor: 150_000n }),
        }),
      );
      expect(mockTx.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'VALIDATED' }),
        }),
      );
      expect(mockTx.recurringOccurrence.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CONFIRMED', transactionId: TX_1 }),
        }),
      );
    });

    it('confirms TRANSFER occurrence with destination account', async () => {
      mockTx.financialAccount.findFirst
        .mockResolvedValueOnce(sampleAccount)
        .mockResolvedValueOnce({ ...sampleAccount, id: ACCOUNT_DEST });

      await repository.confirmOccurrenceWithTransaction({
        userId: USER_1,
        occurrenceId: OCCURRENCE_1,
        transactionId: TX_1,
        ledgerEntryId: ENTRY_1,
        destinationLedgerEntryId: ENTRY_DEST,
        accountId: ACCOUNT_1,
        destinationAccountId: ACCOUNT_DEST,
        amountMinor: 50_000n,
        currency: 'XOF',
        type: 'TRANSFER',
        economicClass: 'INTERNAL_TRANSFER',
        valueDate: new Date('2026-03-05'),
        description: 'Virement interne',
        confirmedAt: new Date('2026-03-05'),
      });

      expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_1, ACCOUNT_DEST]);
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledTimes(2);
    });

    it('throws NOT_FOUND if source account does not exist', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws BUSINESS_RULE_VIOLATION if account is archived', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-02-01T10:00:00.000Z'),
      });

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws CURRENCY_MISMATCH if currency does not match account', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        currency: 'EUR',
      });

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws INSUFFICIENT_FUNDS if expense exceeds overdraft limit', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        openingBalanceMinor: 10_000n,
      });

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws NOT_FOUND if occurrence does not exist', async () => {
      mockTx.recurringOccurrence.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws INVALID_STATE_TRANSITION if occurrence is not EXPECTED', async () => {
      mockTx.recurringOccurrence.findFirst.mockResolvedValueOnce({
        ...sampleOccurrence,
        status: 'CONFIRMED',
      });

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('accounts for existing DEBIT ledger entries during overdraft calculation', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        openingBalanceMinor: 200_000n,
      });
      mockTx.ledgerEntry.findMany.mockResolvedValueOnce([{ direction: 'DEBIT', amountMinor: 100_000n }]);

      await expect(
        repository.confirmOccurrenceWithTransaction({
          userId: USER_1,
          occurrenceId: OCCURRENCE_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-03-05'),
          description: 'Loyer',
          confirmedAt: new Date('2026-03-05'),
        }),
      ).rejects.toThrow(DomainError);
    });
  });
});
