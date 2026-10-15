import type { FinancialAccount, LedgerEntry, Transaction } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import { TransfersRepository } from './transfers.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_FROM = '01927000-0000-7000-8000-000000000010';
const ACCOUNT_TO = '01927000-0000-7000-8000-000000000020';
const TRANSFER_ID = '01927000-0000-7000-8000-000000000030';
const FEE_ID = '01927000-0000-7000-8000-000000000040';

describe('TransfersRepository', () => {
  let repository: TransfersRepository;
  let mockCtx: {
    db: {
      $transaction: ReturnType<typeof vi.fn>;
      transaction: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
    newId: ReturnType<typeof vi.fn>;
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
    };
    transaction: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  const sampleFromAccount: FinancialAccount = {
    id: ACCOUNT_FROM,
    userId: USER_1,
    name: 'Compte Wave',
    type: 'MOBILE_MONEY',
    provider: 'Wave',
    currency: 'XOF',
    openingBalanceMinor: 100000n,
    openedOn: new Date('2026-01-01T00:00:00.000Z'),
    allowOverdraft: false,
    overdraftLimitMinor: 0n,
    includeInNetWorth: true,
    color: '#000000',
    icon: 'phone',
    sortOrder: 0,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleToAccount: FinancialAccount = {
    id: ACCOUNT_TO,
    userId: USER_1,
    name: 'Compte Espèces',
    type: 'CASH',
    provider: null,
    currency: 'XOF',
    openingBalanceMinor: 20000n,
    openedOn: new Date('2026-01-01T00:00:00.000Z'),
    allowOverdraft: false,
    overdraftLimitMinor: 0n,
    includeInNetWorth: true,
    color: '#000000',
    icon: 'cash',
    sortOrder: 1,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  beforeEach(() => {
    const createdTxs = new Map<string, Transaction>();
    mockTx = {
      financialAccount: {
        findMany: vi.fn().mockResolvedValue([sampleFromAccount, sampleToAccount]),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: LedgerEntry }) => ({
          ...data,
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        })),
      },
      transaction: {
        create: vi.fn().mockImplementation(({ data }: { data: Transaction }) => {
          const row = {
            ...data,
            createdAt: new Date('2026-02-01T00:00:00.000Z'),
            updatedAt: new Date('2026-02-01T00:00:00.000Z'),
          };
          createdTxs.set(data.id, row);
          return row;
        }),
        update: vi
          .fn()
          .mockImplementation(
            ({ where, data }: { where?: { userId_id?: { id: string } }; data: Partial<Transaction> }) => {
              const txId = where?.userId_id?.id ?? '';
              const existing = createdTxs.get(txId);
              const updated = {
                ...existing,
                ...data,
                updatedAt: new Date('2026-02-01T00:00:00.000Z'),
              };
              createdTxs.set(txId, updated as Transaction);
              return updated;
            },
          ),
        findFirst: vi.fn(),
      },
    };

    let idCount = 1;
    mockCtx = {
      db: {
        $transaction: vi
          .fn()
          .mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback(mockTx)),
        transaction: {
          findFirst: vi.fn(),
        },
      },
      newId: vi.fn().mockImplementation(() => `entry-${idCount++}`),
      now: vi.fn().mockReturnValue(new Date('2026-02-01T10:00:00.000Z')),
    };

    mockAccountLocking = {
      lockAccounts: vi.fn().mockResolvedValue(undefined),
    };

    repository = new TransfersRepository(
      mockCtx as unknown as FinanceContext,
      mockAccountLocking as unknown as AccountLockingQueries,
    );
  });

  it('creates same-currency transfer with 2 ledger entries and locks accounts', async () => {
    const result = await repository.createTransfer({
      id: TRANSFER_ID,
      userId: USER_1,
      fromAccountId: ACCOUNT_FROM,
      toAccountId: ACCOUNT_TO,
      fromAmountMinor: 50000n,
      toAmountMinor: 50000n,
      fromCurrency: 'XOF',
      toCurrency: 'XOF',
      occurredAt: new Date('2026-02-01T10:00:00.000Z'),
      valueDate: new Date('2026-02-01T00:00:00.000Z'),
    });

    expect(result.id).toBe(TRANSFER_ID);
    expect(result.type).toBe('TRANSFER');
    expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_FROM, ACCOUNT_TO]);
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledTimes(2);
  });

  it('creates transfer with linked fee transaction and fee ledger entry', async () => {
    const result = await repository.createTransfer({
      id: TRANSFER_ID,
      userId: USER_1,
      fromAccountId: ACCOUNT_FROM,
      toAccountId: ACCOUNT_TO,
      fromAmountMinor: 50000n,
      toAmountMinor: 50000n,
      fromCurrency: 'XOF',
      toCurrency: 'XOF',
      occurredAt: new Date('2026-02-01T10:00:00.000Z'),
      valueDate: new Date('2026-02-01T00:00:00.000Z'),
      fee: {
        id: FEE_ID,
        amountMinor: 500n,
      },
    });

    expect(result.feeTransaction).toBeDefined();
    expect(result.feeTransaction?.id).toBe(FEE_ID);
    expect(mockTx.transaction.create).toHaveBeenCalledTimes(2);
    expect(mockTx.ledgerEntry.create).toHaveBeenCalledTimes(3);
  });

  it('rejects transfer when source account has insufficient funds (overdraft violation)', async () => {
    mockTx.ledgerEntry.findMany.mockResolvedValue([{ direction: 'DEBIT', amountMinor: 95000n }]);

    await expect(
      repository.createTransfer({
        id: TRANSFER_ID,
        userId: USER_1,
        fromAccountId: ACCOUNT_FROM,
        toAccountId: ACCOUNT_TO,
        fromAmountMinor: 50000n,
        toAmountMinor: 50000n,
        fromCurrency: 'XOF',
        toCurrency: 'XOF',
        occurredAt: new Date('2026-02-01T10:00:00.000Z'),
        valueDate: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects transfer when account is archived', async () => {
    mockTx.financialAccount.findMany.mockResolvedValue([
      { ...sampleFromAccount, archivedAt: new Date('2026-02-01T00:00:00.000Z') },
      sampleToAccount,
    ]);

    await expect(
      repository.createTransfer({
        id: TRANSFER_ID,
        userId: USER_1,
        fromAccountId: ACCOUNT_FROM,
        toAccountId: ACCOUNT_TO,
        fromAmountMinor: 10000n,
        toAmountMinor: 10000n,
        fromCurrency: 'XOF',
        toCurrency: 'XOF',
        occurredAt: new Date('2026-02-01T10:00:00.000Z'),
        valueDate: new Date('2026-02-01T00:00:00.000Z'),
      }),
    ).rejects.toThrow(DomainError);
  });
});
