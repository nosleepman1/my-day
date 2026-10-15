import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FinanceContext } from '../shared/finance-context';

import { CategoriesRepository } from './categories.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const CAT_1 = '01927000-0000-7000-8000-000000000002';

describe('CategoriesRepository', () => {
  let repo: CategoriesRepository;
  let mockPrisma: {
    transactionCategory: {
      create: ReturnType<typeof vi.fn>;
      createMany: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
    };
    transaction: {
      count: ReturnType<typeof vi.fn>;
    };
  };

  const sampleCategory = {
    id: CAT_1,
    userId: USER_1,
    name: 'Alimentation',
    kind: 'EXPENSE' as const,
    defaultEconomicClass: 'EXPENSE_OPERATING' as const,
    parentId: null,
    icon: 'shopping-cart',
    color: '#DC2626',
    isSystem: false,
    systemKey: null,
    sortOrder: 10,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      transactionCategory: {
        create: vi.fn().mockResolvedValue(sampleCategory),
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue(sampleCategory),
        findMany: vi.fn().mockResolvedValue([sampleCategory]),
        update: vi.fn().mockResolvedValue(sampleCategory),
        delete: vi.fn().mockResolvedValue(sampleCategory),
        count: vi.fn().mockResolvedValue(1),
      },
      transaction: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    const mockCtx = {
      db: mockPrisma,
    } as unknown as FinanceContext;

    repo = new CategoriesRepository(mockCtx);
  });

  it('creates category with tenant isolation', async () => {
    const res = await repo.create({
      id: CAT_1,
      userId: USER_1,
      name: 'Alimentation',
      kind: 'EXPENSE',
      defaultEconomicClass: 'EXPENSE_OPERATING',
    });

    expect(res.id).toBe(CAT_1);
    expect(mockPrisma.transactionCategory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: CAT_1,
        userId: USER_1,
        name: 'Alimentation',
      }),
    });
  });

  it('finds category by composite tenant key using findFirst', async () => {
    const res = await repo.findById(USER_1, CAT_1);
    expect(res?.id).toBe(CAT_1);
    expect(mockPrisma.transactionCategory.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_1, id: CAT_1 },
    });
  });

  it('finds category by name and parent', async () => {
    await repo.findByNameAndParent(USER_1, 'alimentation', null);
    expect(mockPrisma.transactionCategory.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        name: { equals: 'alimentation', mode: 'insensitive' },
        parentId: null,
      },
    });
  });

  it('lists categories filtered by kind', async () => {
    await repo.list(USER_1, { kind: 'EXPENSE' });
    expect(mockPrisma.transactionCategory.findMany).toHaveBeenCalledWith({
      where: { userId: USER_1, kind: 'EXPENSE' },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('deletes category by composite key', async () => {
    await repo.delete(USER_1, CAT_1);
    expect(mockPrisma.transactionCategory.delete).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CAT_1 } },
    });
  });

  it('counts transactions referencing category', async () => {
    const count = await repo.countTransactions(USER_1, CAT_1);
    expect(count).toBe(0);
    expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
      where: { userId: USER_1, categoryId: CAT_1 },
    });
  });
});
