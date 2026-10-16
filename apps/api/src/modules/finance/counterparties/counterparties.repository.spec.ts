import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import { encodeCursor } from '../../../platform/http/cursor';
import type { FinanceContext } from '../shared/finance-context';

import { CounterpartiesRepository } from './counterparties.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const CP_1 = '01927000-0000-7000-8000-000000000002';
const CP_2 = '01927000-0000-7000-8000-000000000003';

describe('CounterpartiesRepository', () => {
  let repo: CounterpartiesRepository;
  let mockPrisma: {
    counterparty: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    transaction: {
      count: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
    noteLink: {
      updateMany: ReturnType<typeof vi.fn>;
    };
    $transaction: ReturnType<typeof vi.fn>;
  };

  const sampleCounterparty = {
    id: CP_1,
    userId: USER_1,
    name: 'Boulangerie du Coin',
    kind: 'PERSON' as const,
    phone: '+221770000000',
    email: 'contact@boulangerie.sn',
    notes: 'Fournisseur pain',
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { transactions: 5 },
  };

  beforeEach(() => {
    mockPrisma = {
      counterparty: {
        create: vi.fn().mockResolvedValue(sampleCounterparty),
        findFirst: vi.fn().mockResolvedValue(sampleCounterparty),
        findMany: vi.fn().mockResolvedValue([sampleCounterparty]),
        update: vi.fn().mockResolvedValue(sampleCounterparty),
        delete: vi.fn().mockResolvedValue(sampleCounterparty),
      },
      transaction: {
        count: vi.fn().mockResolvedValue(5),
        updateMany: vi.fn().mockResolvedValue({ count: 5 }),
      },
      noteLink: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback(mockPrisma);
      }),
    };

    const mockCtx = {
      db: mockPrisma,
    } as unknown as FinanceContext;

    repo = new CounterpartiesRepository(mockCtx);
  });

  it('creates counterparty with tenant isolation', async () => {
    const res = await repo.create({
      id: CP_1,
      userId: USER_1,
      name: 'Boulangerie du Coin',
      kind: 'PERSON',
      phone: '+221770000000',
      email: 'contact@boulangerie.sn',
      notes: 'Fournisseur pain',
    });

    expect(mockPrisma.counterparty.create).toHaveBeenCalledWith({
      data: {
        id: CP_1,
        userId: USER_1,
        name: 'Boulangerie du Coin',
        kind: 'PERSON',
        phone: '+221770000000',
        email: 'contact@boulangerie.sn',
        notes: 'Fournisseur pain',
      },
      include: { _count: { select: { transactions: true } } },
    });
    expect(res.name).toBe('Boulangerie du Coin');
  });

  it('finds counterparty by id with tenant isolation and transactions count', async () => {
    const res = await repo.findById(USER_1, CP_1);
    expect(mockPrisma.counterparty.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_1, id: CP_1 },
      include: { _count: { select: { transactions: true } } },
    });
    expect(res?.id).toBe(CP_1);
  });

  it('finds counterparty by name case-insensitively', async () => {
    await repo.findByName(USER_1, '  Boulangerie du Coin  ');
    expect(mockPrisma.counterparty.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        name: { equals: 'Boulangerie du Coin', mode: 'insensitive' },
      },
    });
  });

  it('lists counterparties with filters and pagination', async () => {
    const page = await repo.list(USER_1, {
      kind: 'PERSON',
      search: 'Boulangerie',
      limit: 10,
    });

    expect(mockPrisma.counterparty.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_1,
        archivedAt: null,
        kind: 'PERSON',
        name: { contains: 'Boulangerie', mode: 'insensitive' },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 11,
      include: { _count: { select: { transactions: true } } },
    });
    expect(page.rows).toHaveLength(1);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('lists counterparties with cursor and includeArchived=true', async () => {
    const cursor = encodeCursor(['name', 'Alpha', CP_1]);
    mockPrisma.counterparty.findMany.mockResolvedValueOnce([
      sampleCounterparty,
      { ...sampleCounterparty, id: CP_2 },
    ]);

    const page = await repo.list(USER_1, {
      limit: 1,
      cursor,
      includeArchived: true,
    });

    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBeDefined();
    expect(mockPrisma.counterparty.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it('throws DomainError when cursor prefix is not name', async () => {
    const badCursor = encodeCursor(['id', 'bad', CP_1]);
    await expect(repo.list(USER_1, { limit: 10, cursor: badCursor })).rejects.toThrow(DomainError);
  });

  it('updates counterparty fields', async () => {
    await repo.update(USER_1, CP_1, {
      name: 'Nouvelle Boulangerie',
      kind: 'ORGANIZATION',
      phone: '+221780000000',
      email: 'new@boulangerie.sn',
      notes: 'Notes à jour',
    });

    expect(mockPrisma.counterparty.update).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CP_1 } },
      data: {
        name: 'Nouvelle Boulangerie',
        kind: 'ORGANIZATION',
        phone: '+221780000000',
        email: 'new@boulangerie.sn',
        notes: 'Notes à jour',
      },
      include: { _count: { select: { transactions: true } } },
    });
  });

  it('archives and unarchives counterparty', async () => {
    const now = new Date('2026-02-01T12:00:00.000Z');
    await repo.archive(USER_1, CP_1, now);
    expect(mockPrisma.counterparty.update).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CP_1 } },
      data: { archivedAt: now },
      include: { _count: { select: { transactions: true } } },
    });

    await repo.unarchive(USER_1, CP_1);
    expect(mockPrisma.counterparty.update).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CP_1 } },
      data: { archivedAt: null },
      include: { _count: { select: { transactions: true } } },
    });
  });

  it('counts transactions referencing counterparty', async () => {
    const count = await repo.countTransactions(USER_1, CP_1);
    expect(mockPrisma.transaction.count).toHaveBeenCalledWith({
      where: { userId: USER_1, counterpartyId: CP_1 },
    });
    expect(count).toBe(5);
  });

  it('deletes counterparty', async () => {
    await repo.delete(USER_1, CP_1);
    expect(mockPrisma.counterparty.delete).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CP_1 } },
    });
  });

  it('merges source counterparty into target in a single transaction', async () => {
    await repo.merge(USER_1, CP_1, CP_2);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_1, counterpartyId: CP_1 },
      data: { counterpartyId: CP_2 },
    });
    expect(mockPrisma.noteLink.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_1, counterpartyId: CP_1 },
      data: { counterpartyId: CP_2 },
    });
    expect(mockPrisma.counterparty.delete).toHaveBeenCalledWith({
      where: { userId_id: { userId: USER_1, id: CP_1 } },
    });
  });
});
