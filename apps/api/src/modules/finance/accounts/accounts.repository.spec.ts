import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FinanceContext } from '../shared/finance-context';

import { AccountsRepository } from './accounts.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000002';

describe('AccountsRepository', () => {
  let repo: AccountsRepository;
  let mockPrisma: {
    financialAccount: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    ledgerEntry: {
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  const sampleAccount = {
    id: ACCOUNT_1,
    userId: USER_1,
    name: 'Compte SGBS',
    type: 'BANK' as const,
    provider: 'SGBS',
    currency: 'XOF',
    openingBalanceMinor: 50_000n,
    openedOn: new Date('2026-01-01'),
    allowOverdraft: false,
    overdraftLimitMinor: null,
    includeInNetWorth: true,
    color: '#00AA00',
    icon: 'bank',
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      financialAccount: {
        create: vi.fn().mockResolvedValue(sampleAccount),
        findFirst: vi.fn().mockResolvedValue(sampleAccount),
        findMany: vi.fn().mockResolvedValue([sampleAccount]),
        update: vi.fn().mockResolvedValue(sampleAccount),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const mockCtx = {
      db: mockPrisma,
    } as unknown as FinanceContext;

    repo = new AccountsRepository(mockCtx);
  });

  it('creates an account in database', async () => {
    const res = await repo.create({
      id: ACCOUNT_1,
      userId: USER_1,
      name: 'Compte SGBS',
      type: 'BANK',
      currency: 'XOF',
      openingBalanceMinor: 50_000n,
      openedOn: new Date('2026-01-01'),
      allowOverdraft: false,
    });

    expect(res.id).toBe(ACCOUNT_1);
    expect(mockPrisma.financialAccount.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: ACCOUNT_1,
        userId: USER_1,
        name: 'Compte SGBS',
      }),
    });
  });

  it('finds an account by id and composite tenant key', async () => {
    const res = await repo.findById(USER_1, ACCOUNT_1);
    expect(res?.id).toBe(ACCOUNT_1);
    expect(mockPrisma.financialAccount.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_1, id: ACCOUNT_1 },
    });
  });

  it('finds an account by name (case-insensitive)', async () => {
    const res = await repo.findByName(USER_1, 'compte sgbs');
    expect(res?.name).toBe('Compte SGBS');
    expect(mockPrisma.financialAccount.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        name: { equals: 'compte sgbs', mode: 'insensitive' },
      },
    });
  });

  it('lists accounts with type, currency and archived filters', async () => {
    await repo.list(USER_1, { type: 'BANK', currency: 'XOF', archived: false });
    expect(mockPrisma.financialAccount.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        type: 'BANK',
        currency: 'XOF',
        archivedAt: null,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    await repo.list(USER_1, { archived: true });
    expect(mockPrisma.financialAccount.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          archivedAt: { not: null },
        }),
      }),
    );
  });

  it('updates an account by composite tenant key', async () => {
    await repo.update(USER_1, ACCOUNT_1, { name: 'Nouveau nom' });
    expect(mockPrisma.financialAccount.update).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: ACCOUNT_1 } },
      data: { name: 'Nouveau nom' },
    });
  });

  it('calculates balance with ledger entries', async () => {
    mockPrisma.financialAccount.findFirst.mockResolvedValueOnce({
      openingBalanceMinor: 20_000n,
    });
    mockPrisma.ledgerEntry.findMany.mockResolvedValueOnce([
      { direction: 'CREDIT', amountMinor: 30_000n, transaction: { status: 'VALIDATED' } },
      { direction: 'DEBIT', amountMinor: 10_000n, transaction: { status: 'VALIDATED' } },
      { direction: 'CREDIT', amountMinor: 5_000n, transaction: { status: 'PENDING' } },
    ]);

    const balance = await repo.getBalance(USER_1, ACCOUNT_1);
    expect(balance).toEqual({
      realisedMinor: 40_000n,
      projectedMinor: 45_000n,
    });
  });

  it('returns null if account is not found in getBalance', async () => {
    mockPrisma.financialAccount.findFirst.mockResolvedValueOnce(null);
    const balance = await repo.getBalance(USER_1, 'non-existent');
    expect(balance).toBeNull();
  });
});
