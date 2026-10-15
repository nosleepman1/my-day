import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryResponse } from '@orbit/contracts';

import { CategoriesController } from './categories.controller';
import type { CategoriesService } from './categories.service';

const CAT_ID = '01927000-0000-7000-8000-000000000001';

const sampleCategory: CategoryResponse = {
  id: CAT_ID,
  name: 'Alimentation',
  kind: 'EXPENSE',
  defaultEconomicClass: 'EXPENSE_OPERATING',
  parentId: null,
  icon: 'shopping-cart',
  color: '#DC2626',
  isSystem: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('CategoriesController', () => {
  let controller: CategoriesController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleCategory),
      list: vi.fn().mockResolvedValue([sampleCategory]),
      getById: vi.fn().mockResolvedValue(sampleCategory),
      update: vi.fn().mockResolvedValue({ ...sampleCategory, name: 'Courses' }),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    controller = new CategoriesController(mockService as unknown as CategoriesService);
  });

  it('delegates creation to service and returns data envelope', async () => {
    const res = await controller.create({
      name: 'Alimentation',
      kind: 'EXPENSE',
      defaultEconomicClass: 'EXPENSE_OPERATING',
    });

    expect(res).toEqual({ data: sampleCategory });
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alimentation', kind: 'EXPENSE' }),
    );
  });

  it('delegates list to service with query params', async () => {
    const res = await controller.list({ kind: 'EXPENSE' });
    expect(res).toEqual({ data: [sampleCategory] });
    expect(mockService.list).toHaveBeenCalledWith({ kind: 'EXPENSE' });
  });

  it('delegates getById to service', async () => {
    const res = await controller.getById({ id: CAT_ID });
    expect(res).toEqual({ data: sampleCategory });
    expect(mockService.getById).toHaveBeenCalledWith(CAT_ID);
  });

  it('delegates update to service', async () => {
    const res = await controller.update({ id: CAT_ID }, { name: 'Courses' });
    expect(res.data.name).toBe('Courses');
    expect(mockService.update).toHaveBeenCalledWith(CAT_ID, { name: 'Courses' });
  });

  it('delegates remove to service', async () => {
    await controller.remove({ id: CAT_ID });
    expect(mockService.delete).toHaveBeenCalledWith(CAT_ID);
  });
});
