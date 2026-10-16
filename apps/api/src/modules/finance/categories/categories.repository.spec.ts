import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FinanceContext } from '../shared/finance-context';

import { CategoriesRepository } from './categories.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const CAT_1 = '01927000-0000-7000-8000-000000000002';
const CAT_2 = '01927000-0000-7000-8000-000000000003';

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
    icon: 'utensils',
    color: '#ff0000',
    isSystem: false,
    systemKey: null,
    sortOrder: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    mockPrisma = {
      transactionCategory: {
        create: vi.fn().mockResolvedValue(sampleCategory),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
        findFirst: vi.fn().mockResolvedValue(sampleCategory),
        findMany: vi.fn().mockResolvedValue([sampleCategory]),
        update: vi.fn().mockResolvedValue(sampleCategory),
        delete: vi.fn().mockResolvedValue(sampleCategory),
        count: vi.fn().mockResolvedValue(1),
      },
      transaction: {
        count: vi.fn().mockResolvedValue(3),
      },
    };

    const mockCtx = {
      db: mockPrisma,
    } as unknown as FinanceContext;

    repo = new CategoriesRepository(mockCtx);
  });

  it('creates category with all fields provided', async () => {
    const res = await repo.create({
      id: CAT_1,
      userId: USER_1,
      name: 'Alimentation',
      kind: 'EXPENSE',
      defaultEconomicClass: 'EXPENSE_OPERATING',
      parentId: CAT_2,
      icon: 'fork',
      color: '#00ff00',
      isSystem: true,
      systemKey: 'SYS_FOOD',
      sortOrder: 5,
    });

    expect(mockPrisma.transactionCategory.create).toHaveBeenCalledWith({
      data: {
        id: CAT_1,
        userId: USER_1,
        name: 'Alimentation',
        kind: 'EXPENSE',
        defaultEconomicClass: 'EXPENSE_OPERATING',
        parentId: CAT_2,
        icon: 'fork',
        color: '#00ff00',
        isSystem: true,
        systemKey: 'SYS_FOOD',
        sortOrder: 5,
      },
    });
    expect(res.name).toBe('Alimentation');
  });

  it('creates category with default null/zero fields', async () => {
    await repo.create({
      id: CAT_1,
      userId: USER_1,
      name: 'Alimentation',
      kind: 'EXPENSE',
      defaultEconomicClass: 'EXPENSE_OPERATING',
    });

    expect(mockPrisma.transactionCategory.create).toHaveBeenCalledWith({
      data: {
        id: CAT_1,
        userId: USER_1,
        name: 'Alimentation',
        kind: 'EXPENSE',
        defaultEconomicClass: 'EXPENSE_OPERATING',
        parentId: null,
        icon: null,
        color: null,
        isSystem: false,
        systemKey: null,
        sortOrder: 0,
      },
    });
  });

  it('creates many categories with both custom and fallback defaults', async () => {
    const count = await repo.createMany([
      {
        id: CAT_1,
        userId: USER_1,
        name: 'Custom',
        kind: 'INCOME',
        defaultEconomicClass: 'INCOME_OPERATING',
        parentId: CAT_2,
        icon: 'coin',
        color: '#123456',
        isSystem: true,
        systemKey: 'SYS_REV',
        sortOrder: 10,
      },
      {
        id: CAT_2,
        userId: USER_1,
        name: 'Defaulted',
        kind: 'EXPENSE',
        defaultEconomicClass: 'EXPENSE_OPERATING',
      },
    ]);

    expect(count).toBe(2);
    expect(mockPrisma.transactionCategory.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: CAT_1,
          userId: USER_1,
          name: 'Custom',
          kind: 'INCOME',
          defaultEconomicClass: 'INCOME_OPERATING',
          parentId: CAT_2,
          icon: 'coin',
          color: '#123456',
          isSystem: true,
          systemKey: 'SYS_REV',
          sortOrder: 10,
        },
        {
          id: CAT_2,
          userId: USER_1,
          name: 'Defaulted',
          kind: 'EXPENSE',
          defaultEconomicClass: 'EXPENSE_OPERATING',
          parentId: null,
          icon: null,
          color: null,
          isSystem: false,
          systemKey: null,
          sortOrder: 0,
        },
      ],
      skipDuplicates: true,
    });
  });

  it('finds category by id and by system key', async () => {
    const byId = await repo.findById(USER_1, CAT_1);
    expect(byId?.id).toBe(CAT_1);
    expect(mockPrisma.transactionCategory.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_1, id: CAT_1 },
    });

    const bySys = await repo.findBySystemKey(USER_1, 'SYS_FOOD');
    expect(bySys?.id).toBe(CAT_1);
    expect(mockPrisma.transactionCategory.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_1, systemKey: 'SYS_FOOD' },
    });
  });

  it('finds category by name and parent', async () => {
    await repo.findByNameAndParent(USER_1, 'Alimentation', CAT_2);
    expect(mockPrisma.transactionCategory.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        name: { equals: 'Alimentation', mode: 'insensitive' },
        parentId: CAT_2,
      },
    });

    await repo.findByNameAndParent(USER_1, 'Alimentation');
    expect(mockPrisma.transactionCategory.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        name: { equals: 'Alimentation', mode: 'insensitive' },
        parentId: null,
      },
    });
  });

  it('lists categories with and without filters', async () => {
    await repo.list(USER_1);
    expect(mockPrisma.transactionCategory.findMany).toHaveBeenCalledWith({
      where: { userId: USER_1 },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    await repo.list(USER_1, { kind: 'EXPENSE', parentId: CAT_2 });
    expect(mockPrisma.transactionCategory.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        kind: 'EXPENSE',
        parentId: CAT_2,
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  });

  it('updates, deletes, and counts categories and child relations', async () => {
    await repo.update(USER_1, CAT_1, { name: 'Nouveau nom' });
    expect(mockPrisma.transactionCategory.update).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CAT_1 } },
      data: { name: 'Nouveau nom' },
    });

    await repo.delete(USER_1, CAT_1);
    expect(mockPrisma.transactionCategory.delete).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CAT_1 } },
    });

    const txCount = await repo.countTransactions(USER_1, CAT_1);
    expect(txCount).toBe(3);

    const hasKids = await repo.hasChildren(USER_1, CAT_1);
    expect(hasKids).toBe(true);

    mockPrisma.transactionCategory.count.mockResolvedValueOnce(0);
    const hasNoKids = await repo.hasChildren(USER_1, CAT_1);
    expect(hasNoKids).toBe(false);

    const totalCount = await repo.count(USER_1);
    expect(totalCount).toBe(1);
  });
});
