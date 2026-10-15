import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const CAT_1 = '01927000-0000-7000-8000-000000000002';
const CAT_PARENT = '01927000-0000-7000-8000-000000000003';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let mockCtx: { userId: ReturnType<typeof vi.fn>; newId: ReturnType<typeof vi.fn> };
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    createMany: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByNameAndParent: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    countTransactions: ReturnType<typeof vi.fn>;
    hasChildren: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
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

  const parentCategory = {
    ...sampleCategory,
    id: CAT_PARENT,
    name: 'Maison',
    parentId: null,
  };

  beforeEach(() => {
    mockCtx = {
      userId: vi.fn().mockReturnValue(USER_1),
      newId: vi.fn().mockReturnValue(CAT_1),
    };

    mockRepo = {
      create: vi.fn().mockResolvedValue(sampleCategory),
      createMany: vi.fn().mockResolvedValue(30),
      findById: vi.fn().mockResolvedValue(sampleCategory),
      findByNameAndParent: vi.fn().mockResolvedValue(null),
      list: vi.fn().mockResolvedValue([sampleCategory]),
      update: vi.fn().mockResolvedValue(sampleCategory),
      delete: vi.fn().mockResolvedValue(sampleCategory),
      countTransactions: vi.fn().mockResolvedValue(0),
      hasChildren: vi.fn().mockResolvedValue(false),
      count: vi.fn().mockResolvedValue(10),
    };

    service = new CategoriesService(
      mockCtx as unknown as FinanceContext,
      mockRepo as unknown as CategoriesRepository,
    );
  });

  describe('ensureDefaultCategories', () => {
    it('seeds default categories when user category count is 0', async () => {
      mockRepo.count.mockResolvedValueOnce(0);

      await service.ensureDefaultCategories(USER_1);

      expect(mockRepo.createMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Salaire', kind: 'INCOME' }),
          expect.objectContaining({ name: 'Alimentation et marché', kind: 'EXPENSE' }),
        ]),
      );
    });

    it('does nothing when categories already exist', async () => {
      mockRepo.count.mockResolvedValueOnce(15);

      await service.ensureDefaultCategories(USER_1);

      expect(mockRepo.createMany).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('creates a custom category successfully', async () => {
      const res = await service.create({
        name: 'Alimentation',
        kind: 'EXPENSE',
        defaultEconomicClass: 'EXPENSE_OPERATING',
      });

      expect(res.name).toBe('Alimentation');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_1,
          name: 'Alimentation',
          kind: 'EXPENSE',
        }),
      );
    });

    it('rejects duplicate name at same hierarchy level with 409 CONFLICT', async () => {
      mockRepo.findByNameAndParent.mockResolvedValueOnce(sampleCategory);

      await expect(
        service.create({
          name: 'Alimentation',
          kind: 'EXPENSE',
          defaultEconomicClass: 'EXPENSE_OPERATING',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects parent with different kind (CATEGORY_KIND_MISMATCH)', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...parentCategory,
        kind: 'INCOME',
      });

      await expect(
        service.create({
          name: 'Courses',
          kind: 'EXPENSE',
          defaultEconomicClass: 'EXPENSE_OPERATING',
          parentId: CAT_PARENT,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects parent that already has a parent (CATEGORY_MAX_DEPTH_EXCEEDED)', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...parentCategory,
        parentId: 'grand-parent-id',
      });

      await expect(
        service.create({
          name: 'Sous-sous-catégorie',
          kind: 'EXPENSE',
          defaultEconomicClass: 'EXPENSE_OPERATING',
          parentId: CAT_PARENT,
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('getById', () => {
    it('returns category if found', async () => {
      const res = await service.getById(CAT_1);
      expect(res.id).toBe(CAT_1);
    });

    it('throws 404 NOT_FOUND if category does not exist', async () => {
      mockRepo.findById.mockResolvedValueOnce(null);
      await expect(service.getById(CAT_1)).rejects.toThrow(DomainError);
    });
  });

  describe('list', () => {
    it('seeds defaults if empty and returns list', async () => {
      mockRepo.count.mockResolvedValueOnce(0);
      const res = await service.list({ kind: 'EXPENSE' });

      expect(res).toHaveLength(1);
      expect(mockRepo.list).toHaveBeenCalledWith(USER_1, { kind: 'EXPENSE' });
    });
  });

  describe('update', () => {
    it('updates name and color', async () => {
      const res = await service.update(CAT_1, { name: 'Supermarché', color: '#112233' });
      expect(res.name).toBe('Alimentation');
      expect(mockRepo.update).toHaveBeenCalledWith(
        USER_1,
        CAT_1,
        expect.objectContaining({ name: 'Supermarché', color: '#112233' }),
      );
    });

    it('rejects renaming a system category', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleCategory,
        isSystem: true,
      });

      await expect(service.update(CAT_1, { name: 'Nouveau nom' })).rejects.toThrow(DomainError);
    });

    it('rejects setting a parent if category has children', async () => {
      mockRepo.hasChildren.mockResolvedValueOnce(true);

      await expect(service.update(CAT_1, { parentId: CAT_PARENT })).rejects.toThrow(DomainError);
    });
  });

  describe('delete', () => {
    it('deletes an unused category', async () => {
      await service.delete(CAT_1);
      expect(mockRepo.delete).toHaveBeenCalledWith(USER_1, CAT_1);
    });

    it('rejects deleting a system category', async () => {
      mockRepo.findById.mockResolvedValueOnce({
        ...sampleCategory,
        isSystem: true,
      });

      await expect(service.delete(CAT_1)).rejects.toThrow(DomainError);
    });

    it('rejects deleting a category with children', async () => {
      mockRepo.hasChildren.mockResolvedValueOnce(true);

      await expect(service.delete(CAT_1)).rejects.toThrow(DomainError);
    });

    it('rejects deleting a category used in transactions', async () => {
      mockRepo.countTransactions.mockResolvedValueOnce(5);

      await expect(service.delete(CAT_1)).rejects.toThrow(DomainError);
    });
  });
});
