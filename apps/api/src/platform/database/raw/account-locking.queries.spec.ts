import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { AccountLockingQueries, type LockedAccountRow } from './account-locking.queries';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACC_1 = '01927000-0000-7000-8000-000000000002';
const ACC_2 = '01927000-0000-7000-8000-000000000003';

describe('AccountLockingQueries', () => {
  const queries = new AccountLockingQueries();

  const sampleRow: LockedAccountRow = {
    id: ACC_1,
    user_id: USER_1,
    name: 'Compte Principal',
    type: 'BANK',
    currency: 'XOF',
    opening_balance_minor: 100000n,
    allow_overdraft: false,
    overdraft_limit_minor: null,
    archived_at: null,
  };

  it('locks a single account using SELECT FOR UPDATE with user_id filter', async () => {
    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([sampleRow]),
    } as unknown as Prisma.TransactionClient;

    const row = await queries.lockAccount(mockTx, USER_1, ACC_1);
    expect(mockTx.$queryRaw).toHaveBeenCalled();
    expect(row).toEqual(sampleRow);
  });

  it('returns null if account not found during lock', async () => {
    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([]),
    } as unknown as Prisma.TransactionClient;

    const row = await queries.lockAccount(mockTx, USER_1, ACC_1);
    expect(row).toBeNull();
  });

  it('locks multiple accounts in deterministic sorted order to prevent deadlocks', async () => {
    const mockTx = {
      $executeRaw: vi.fn().mockResolvedValue(1),
      $queryRaw: vi.fn().mockResolvedValue([sampleRow]),
    } as unknown as Prisma.TransactionClient;

    const rows = await queries.lockAccounts(mockTx, USER_1, [ACC_2, ACC_1]);
    expect(mockTx.$queryRaw).toHaveBeenCalled();
    expect(rows).toEqual([sampleRow]);
  });

  it('returns empty array if locking empty list of accounts', async () => {
    const mockTx = {
      $queryRaw: vi.fn(),
    } as unknown as Prisma.TransactionClient;

    const rows = await queries.lockAccounts(mockTx, USER_1, []);
    expect(mockTx.$queryRaw).not.toHaveBeenCalled();
    expect(rows).toEqual([]);
  });
});
