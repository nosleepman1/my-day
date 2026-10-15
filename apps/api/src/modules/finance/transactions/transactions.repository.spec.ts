import type { FinancialAccount, LedgerEntry, Transaction } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import { encodeCursor } from '../../../platform/http/cursor';
import type { FinanceContext } from '../shared/finance-context';

import { TransactionsRepository } from './transactions.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000010';
const TX_1 = '01927000-0000-7000-8000-000000000020';
const ENTRY_1 = '01927000-0000-7000-8000-000000000030';

describe('TransactionsRepository', () => {
  let repository: TransactionsRepository;
  let mockCtx: {
    db: {
      $transaction: ReturnType<typeof vi.fn>;
      transaction: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
      };
    };
    now: ReturnType<typeof vi.fn>;
  };
  let mockAccountLocking: {
    lockAccounts: ReturnType<typeof vi.fn>;
  };
  let mockTx: {
    financialAccount: {
      findMany: ReturnType<typeof vi.fn>;
    };
    ledgerEntry: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
    transaction: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
  };

  const sampleAccount: FinancialAccount = {
    id: ACCOUNT_1,
    userId: USER_1,
    name: 'Compte Principal',
    type: 'BANK',
    provider: 'SGBS',
    currency: 'XOF',
    openingBalanceMinor: 100000n,
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

  beforeEach(() => {
    mockTx = {
      financialAccount: {
        findMany: vi.fn().mockResolvedValue([sampleAccount]),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: LedgerEntry }) => ({
          ...data,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        })),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }: { data: Transaction }) => ({
          ...data,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
          updatedAt: new Date('2026-02-01T00:00:00.000Z'),
        })),
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(({ data }: { data: Partial<Transaction> }) => ({
          id: TX_1,
          userId: USER_1,
          ...data,
          ledgerEntries: [],
        })),
        delete: vi.fn().mockResolvedValue({ id: TX_1 }),
      },
    };

    mockCtx = {
      db: {
        $transaction: vi
          .fn()
          .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockTx)),
        transaction: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
          update: vi.fn(),
        },
      },
      now: vi.fn().mockReturnValue(new Date('2026-02-01T12:00:00.000Z')),
    };

    mockAccountLocking = {
      lockAccounts: vi.fn().mockResolvedValue(undefined),
    };

    repository = new TransactionsRepository(
      mockCtx as unknown as FinanceContext,
      mockAccountLocking as unknown as AccountLockingQueries,
    );
  });

  describe('create', () => {
    it('creates a standard INCOME transaction with CREDIT ledger entry', async () => {
      const result = await repository.create({
        id: TX_1,
        userId: USER_1,
        type: 'INCOME',
        status: 'VALIDATED',
        economicClass: 'INCOME_OPERATING',
        amountMinor: 25000n,
        currency: 'XOF',
        occurredAt: new Date('2026-02-01T10:00:00.000Z'),
        valueDate: new Date('2026-02-01T00:00:00.000Z'),
        description: 'Vente de services',
        ledgerEntries: [
          {
            id: ENTRY_1,
            accountId: ACCOUNT_1,
            direction: 'CREDIT',
            amountMinor: 25000n,
            currency: 'XOF',
          },
        ],
      });

      expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_1]);
      expect(mockTx.transaction.create).toHaveBeenCalled();
      expect(mockTx.ledgerEntry.create).toHaveBeenCalled();
      expect(result.id).toBe(TX_1);
      expect(result.ledgerEntries).toHaveLength(1);
    });

    it('creates an EXPENSE transaction when sufficient funds exist', async () => {
      const result = await repository.create({
        id: TX_1,
        userId: USER_1,
        type: 'EXPENSE',
        status: 'VALIDATED',
        economicClass: 'EXPENSE_OPERATING',
        amountMinor: 50000n,
        currency: 'XOF',
        occurredAt: new Date('2026-02-01T10:00:00.000Z'),
        valueDate: new Date('2026-02-01T00:00:00.000Z'),
        ledgerEntries: [
          {
            id: ENTRY_1,
            accountId: ACCOUNT_1,
            direction: 'DEBIT',
            amountMinor: 50000n,
            currency: 'XOF',
          },
        ],
      });

      expect(result.status).toBe('VALIDATED');
    });

    it('rejects EXPENSE with INSUFFICIENT_FUNDS when balance would be negative without overdraft', async () => {
      await expect(
        repository.create({
          id: TX_1,
          userId: USER_1,
          type: 'EXPENSE',
          status: 'VALIDATED',
          economicClass: 'EXPENSE_OPERATING',
          amountMinor: 150000n,
          currency: 'XOF',
          occurredAt: new Date('2026-02-01T10:00:00.000Z'),
          valueDate: new Date('2026-02-01T00:00:00.000Z'),
          ledgerEntries: [
            {
              id: ENTRY_1,
              accountId: ACCOUNT_1,
              direction: 'DEBIT',
              amountMinor: 150000n,
              currency: 'XOF',
            },
          ],
        }),
      ).rejects.toThrow(DomainError);
    });

    it('allows EXPENSE with negative balance if overdraft limit covers it', async () => {
      mockTx.financialAccount.findMany.mockResolvedValue([
        {
          ...sampleAccount,
          allowOverdraft: true,
          overdraftLimitMinor: 100000n,
        },
      ]);

      const result = await repository.create({
        id: TX_1,
        userId: USER_1,
        type: 'EXPENSE',
        status: 'VALIDATED',
        economicClass: 'EXPENSE_OPERATING',
        amountMinor: 150000n,
        currency: 'XOF',
        occurredAt: new Date('2026-02-01T10:00:00.000Z'),
        valueDate: new Date('2026-02-01T00:00:00.000Z'),
        ledgerEntries: [
          {
            id: ENTRY_1,
            accountId: ACCOUNT_1,
            direction: 'DEBIT',
            amountMinor: 150000n,
            currency: 'XOF',
          },
        ],
      });

      expect(result.status).toBe('VALIDATED');
    });

    it('rejects transaction on archived account with BUSINESS_RULE_VIOLATION', async () => {
      mockTx.financialAccount.findMany.mockResolvedValue([
        {
          ...sampleAccount,
          archivedAt: new Date('2026-01-15T00:00:00.000Z'),
        },
      ]);

      await expect(
        repository.create({
          id: TX_1,
          userId: USER_1,
          type: 'INCOME',
          status: 'VALIDATED',
          economicClass: 'INCOME_OPERATING',
          amountMinor: 10000n,
          currency: 'XOF',
          occurredAt: new Date('2026-02-01T10:00:00.000Z'),
          valueDate: new Date('2026-02-01T00:00:00.000Z'),
          ledgerEntries: [
            {
              id: ENTRY_1,
              accountId: ACCOUNT_1,
              direction: 'CREDIT',
              amountMinor: 10000n,
              currency: 'XOF',
            },
          ],
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects transaction with valueDate before account opening date', async () => {
      await expect(
        repository.create({
          id: TX_1,
          userId: USER_1,
          type: 'INCOME',
          status: 'VALIDATED',
          economicClass: 'INCOME_OPERATING',
          amountMinor: 10000n,
          currency: 'XOF',
          occurredAt: new Date('2026-02-01T10:00:00.000Z'),
          valueDate: new Date('2025-12-31T00:00:00.000Z'),
          ledgerEntries: [
            {
              id: ENTRY_1,
              accountId: ACCOUNT_1,
              direction: 'CREDIT',
              amountMinor: 10000n,
              currency: 'XOF',
            },
          ],
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects currency mismatch between transaction and account', async () => {
      await expect(
        repository.create({
          id: TX_1,
          userId: USER_1,
          type: 'INCOME',
          status: 'VALIDATED',
          economicClass: 'INCOME_OPERATING',
          amountMinor: 10000n,
          currency: 'EUR',
          occurredAt: new Date('2026-02-01T10:00:00.000Z'),
          valueDate: new Date('2026-02-01T00:00:00.000Z'),
          ledgerEntries: [
            {
              id: ENTRY_1,
              accountId: ACCOUNT_1,
              direction: 'CREDIT',
              amountMinor: 10000n,
              currency: 'EUR',
            },
          ],
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('findById', () => {
    it('returns transaction with entries when owned by user', async () => {
      mockCtx.db.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        ledgerEntries: [],
      });

      const result = await repository.findById(USER_1, TX_1);
      expect(result).not.toBeNull();
      expect(result?.id).toBe(TX_1);
    });

    it('returns null when transaction not found', async () => {
      mockCtx.db.transaction.findFirst.mockResolvedValue(null);

      const result = await repository.findById(USER_1, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('returns paginated transactions list with cursor', async () => {
      mockCtx.db.transaction.findMany.mockResolvedValue([
        {
          id: TX_1,
          userId: USER_1,
          valueDate: new Date('2026-02-01T00:00:00.000Z'),
          ledgerEntries: [],
        },
      ]);

      const result = await repository.list(USER_1, { limit: 10 });
      expect(result.rows).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('throws INVALID_CURSOR when cursor prefix is not valueDate', async () => {
      const badCursor = encodeCursor(['name', 'Foo', TX_1]);

      await expect(repository.list(USER_1, { limit: 10, cursor: badCursor })).rejects.toThrow(DomainError);
    });
  });

  describe('validate', () => {
    it('transitions PENDING transaction to VALIDATED under lock', async () => {
      mockTx.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'PENDING',
        ledgerEntries: [
          {
            id: ENTRY_1,
            accountId: ACCOUNT_1,
            direction: 'DEBIT',
            amountMinor: 20000n,
          },
        ],
      });

      const result = await repository.validate(USER_1, TX_1);
      expect(result.status).toBe('VALIDATED');
      expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_1]);
    });

    it('rejects validation when already VALIDATED', async () => {
      mockTx.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        ledgerEntries: [],
      });

      await expect(repository.validate(USER_1, TX_1)).rejects.toThrow(DomainError);
    });

    it('rejects validation when CANCELLED', async () => {
      mockTx.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'CANCELLED',
        ledgerEntries: [],
      });

      await expect(repository.validate(USER_1, TX_1)).rejects.toThrow(DomainError);
    });
  });

  describe('deletePending', () => {
    it('deletes PENDING transaction and its ledger entries', async () => {
      mockTx.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'PENDING',
      });

      await repository.deletePending(USER_1, TX_1);
      expect(mockTx.ledgerEntry.deleteMany).toHaveBeenCalledWith({
        where: { userId: USER_1, transactionId: TX_1 },
      });
      expect(mockTx.transaction.delete).toHaveBeenCalledWith({
        where: { userId_id: { userId: USER_1, id: TX_1 } },
      });
    });

    it('rejects deletion of VALIDATED transaction with BUSINESS_RULE_VIOLATION', async () => {
      mockTx.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
      });

      await expect(repository.deletePending(USER_1, TX_1)).rejects.toThrow(DomainError);
    });
  });
});
