import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../platform/errors/domain-error';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { CounterpartiesRepository } from '../counterparties/counterparties.repository';

import { TransactionReferences } from './transaction-references';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const CAT_1 = '01927000-0000-7000-8000-000000000002';
const CP_1 = '01927000-0000-7000-8000-000000000003';

describe('TransactionReferences', () => {
  it('validates matching category and returns defaultEconomicClass', async () => {
    const mockCategories = {
      findById: vi.fn().mockResolvedValue({
        id: CAT_1,
        userId: USER_1,
        kind: 'EXPENSE',
        defaultEconomicClass: 'OPERATING_EXPENSE',
      }),
    } as unknown as CategoriesRepository;
    const mockCounterparties = {} as CounterpartiesRepository;

    const refs = new TransactionReferences(mockCategories, mockCounterparties);
    const ecoClass = await refs.validateCategory(USER_1, CAT_1, 'EXPENSE');
    expect(ecoClass).toBe('OPERATING_EXPENSE');
  });

  it('throws DomainError NOT_FOUND when category does not exist', async () => {
    const mockCategories = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as CategoriesRepository;
    const mockCounterparties = {} as CounterpartiesRepository;

    const refs = new TransactionReferences(mockCategories, mockCounterparties);
    await expect(refs.validateCategory(USER_1, CAT_1, 'EXPENSE')).rejects.toThrow(DomainError);
  });

  it('validates counterparty when found', async () => {
    const mockCategories = {} as CategoriesRepository;
    const mockCounterparties = {
      findById: vi.fn().mockResolvedValue({ id: CP_1, userId: USER_1 }),
    } as unknown as CounterpartiesRepository;

    const refs = new TransactionReferences(mockCategories, mockCounterparties);
    await expect(refs.validateCounterparty(USER_1, CP_1)).resolves.toBeUndefined();
  });

  it('throws DomainError NOT_FOUND when counterparty does not exist', async () => {
    const mockCategories = {} as CategoriesRepository;
    const mockCounterparties = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as CounterpartiesRepository;

    const refs = new TransactionReferences(mockCategories, mockCounterparties);
    await expect(refs.validateCounterparty(USER_1, CP_1)).rejects.toThrow(DomainError);
  });
});
