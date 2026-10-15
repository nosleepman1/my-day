import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountResponse } from '@orbit/contracts';

import { AccountsController } from './accounts.controller';
import type { AccountsService } from './accounts.service';

const ACCOUNT_ID = '01927000-0000-7000-8000-000000000001';

const sampleAccount: AccountResponse = {
  id: ACCOUNT_ID,
  name: 'Compte Principal',
  type: 'BANK',
  provider: 'SGBS',
  currency: 'XOF',
  currentBalanceMinor: '100000',
  openingBalanceMinor: '100000',
  openedOn: '2026-01-01',
  allowOverdraft: false,
  overdraftLimitMinor: null,
  includeInNetWorth: true,
  color: '#00AA00',
  icon: 'bank',
  notes: 'Compte principal',
  archivedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('AccountsController', () => {
  let controller: AccountsController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    reopen: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleAccount),
      list: vi.fn().mockResolvedValue([sampleAccount]),
      getById: vi.fn().mockResolvedValue(sampleAccount),
      update: vi.fn().mockResolvedValue({ ...sampleAccount, name: 'Compte Modifié' }),
      close: vi.fn().mockResolvedValue({ ...sampleAccount, archivedAt: '2026-06-01T00:00:00.000Z' }),
      reopen: vi.fn().mockResolvedValue({ ...sampleAccount, archivedAt: null }),
    };

    controller = new AccountsController(mockService as unknown as AccountsService);
  });

  it('delegates creation to service and wraps in data envelope', async () => {
    const res = await controller.create({
      name: 'Compte Principal',
      type: 'BANK',
      currency: 'XOF',
      openingBalanceMinor: '100000',
      openedOn: '2026-01-01',
      allowOverdraft: false,
      includeInNetWorth: true,
    });

    expect(res).toEqual({ data: sampleAccount });
    expect(mockService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Compte Principal', currency: 'XOF' }),
    );
  });

  it('delegates listing with query params and wraps in list envelope', async () => {
    const res = await controller.list({ type: 'BANK', currency: 'XOF' });
    expect(res).toEqual({ data: [sampleAccount] });
    expect(mockService.list).toHaveBeenCalledWith({ type: 'BANK', currency: 'XOF' });
  });

  it('delegates getById to service', async () => {
    const res = await controller.getById({ id: ACCOUNT_ID });
    expect(res).toEqual({ data: sampleAccount });
    expect(mockService.getById).toHaveBeenCalledWith(ACCOUNT_ID);
  });

  it('delegates update to service', async () => {
    const res = await controller.update({ id: ACCOUNT_ID }, { name: 'Compte Modifié' });
    expect(res.data.name).toBe('Compte Modifié');
    expect(mockService.update).toHaveBeenCalledWith(ACCOUNT_ID, { name: 'Compte Modifié' });
  });

  it('delegates close to service', async () => {
    const res = await controller.close({ id: ACCOUNT_ID }, { notes: 'Clôturé' });
    expect(res.data.archivedAt).toBe('2026-06-01T00:00:00.000Z');
    expect(mockService.close).toHaveBeenCalledWith(ACCOUNT_ID, { notes: 'Clôturé' });
  });

  it('delegates reopen to service', async () => {
    const res = await controller.reopen({ id: ACCOUNT_ID }, {});
    expect(res.data.archivedAt).toBeNull();
    expect(mockService.reopen).toHaveBeenCalledWith(ACCOUNT_ID, {});
  });
});
