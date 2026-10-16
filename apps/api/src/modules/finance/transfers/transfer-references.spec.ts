import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CategoriesRepository } from '../categories/categories.repository';

import { TransferReferences } from './transfer-references';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACC_1 = '01927000-0000-7000-8000-000000000002';
const CAT_1 = '01927000-0000-7000-8000-000000000003';

describe('TransferReferences', () => {
  it('returns account when found', async () => {
    const mockAccounts = {
      findById: vi.fn().mockResolvedValue({ id: ACC_1, userId: USER_1 }),
    } as unknown as AccountsRepository;
    const mockCategories = {} as CategoriesRepository;

    const refs = new TransferReferences(mockAccounts, mockCategories);
    const acc = await refs.requireAccount(USER_1, ACC_1);
    expect(acc.id).toBe(ACC_1);
  });

  it('throws DomainError NOT_FOUND when account is not found', async () => {
    const mockAccounts = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as AccountsRepository;
    const mockCategories = {} as CategoriesRepository;

    const refs = new TransferReferences(mockAccounts, mockCategories);
    await expect(refs.requireAccount(USER_1, ACC_1)).rejects.toThrow(DomainError);
  });

  it('returns fee category id when found', async () => {
    const mockAccounts = {} as AccountsRepository;
    const mockCategories = {
      findBySystemKey: vi.fn().mockResolvedValue({ id: CAT_1, userId: USER_1 }),
    } as unknown as CategoriesRepository;

    const refs = new TransferReferences(mockAccounts, mockCategories);
    const feeCatId = await refs.findFeeCategoryId(USER_1);
    expect(feeCatId).toBe(CAT_1);
  });

  it('returns null when fee category is not found', async () => {
    const mockAccounts = {} as AccountsRepository;
    const mockCategories = {
      findBySystemKey: vi.fn().mockResolvedValue(null),
    } as unknown as CategoriesRepository;

    const refs = new TransferReferences(mockAccounts, mockCategories);
    const feeCatId = await refs.findFeeCategoryId(USER_1);
    expect(feeCatId).toBeNull();
  });
});
