import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransactionResponse } from '@orbit/contracts';

import type { TenantContext } from '../../../platform/tenant/tenant-context';

import { TransactionsController } from './transactions.controller';
import type { TransactionsService } from './transactions.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const TX_1 = '01927000-0000-7000-8000-000000000020';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    updateDetails: ReturnType<typeof vi.fn>;
    validate: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockTenant: {
    requireUserId: ReturnType<typeof vi.fn>;
  };

  const sampleResponse: TransactionResponse = {
    id: TX_1,
    type: 'INCOME',
    status: 'VALIDATED',
    economicClass: 'INCOME_OPERATING',
    amountMinor: '25000',
    currency: 'XOF',
    occurredAt: '2026-02-01T10:00:00.000Z',
    valueDate: '2026-02-01',
    source: 'MANUAL',
    description: 'Vente',
    notes: null,
    categoryId: null,
    counterpartyId: null,
    transferId: null,
    cancelReason: null,
    cancelledAt: null,
    ledgerEntries: [],
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-01T10:00:00.000Z',
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleResponse),
      list: vi.fn().mockResolvedValue({ items: [sampleResponse], hasMore: false, nextCursor: null }),
      getById: vi.fn().mockResolvedValue(sampleResponse),
      updateDetails: vi.fn().mockResolvedValue(sampleResponse),
      validate: vi.fn().mockResolvedValue(sampleResponse),
      cancel: vi.fn().mockResolvedValue(sampleResponse),
      delete: vi.fn().mockResolvedValue(undefined),
    };

    mockTenant = {
      requireUserId: vi.fn().mockReturnValue(USER_1),
    };

    controller = new TransactionsController(
      mockService as unknown as TransactionsService,
      mockTenant as unknown as TenantContext,
    );
  });

  it('create delegates to service with user_id and returns data envelope', async () => {
    const body = {
      type: 'INCOME' as const,
      status: 'VALIDATED' as const,
      accountId: '01927000-0000-7000-8000-000000000010',
      amountMinor: '25000',
      currency: 'XOF' as const,
      occurredAt: '2026-02-01T10:00:00.000Z',
      valueDate: '2026-02-01',
    };

    const result = await controller.create(body, 'idem-key-1');
    expect(mockService.create).toHaveBeenCalledWith(USER_1, body, 'idem-key-1');
    expect(result).toEqual({ data: sampleResponse });
  });

  it('list delegates to service and returns paginated list envelope', async () => {
    const result = await controller.list({ limit: 10 });
    expect(mockService.list).toHaveBeenCalledWith(USER_1, { limit: 10 });
    expect(result).toEqual({ data: [sampleResponse], meta: { limit: 10, hasMore: false, nextCursor: null } });
  });

  it('getById delegates to service with user_id and param id', async () => {
    const result = await controller.getById({ id: TX_1 });
    expect(mockService.getById).toHaveBeenCalledWith(USER_1, TX_1);
    expect(result).toEqual({ data: sampleResponse });
  });

  it('update delegates to service with user_id, param id and body', async () => {
    const body = { description: 'Updated' };
    const result = await controller.update({ id: TX_1 }, body);
    expect(mockService.updateDetails).toHaveBeenCalledWith(USER_1, TX_1, body);
    expect(result).toEqual({ data: sampleResponse });
  });

  it('validate delegates to service with user_id and param id', async () => {
    const result = await controller.validate({ id: TX_1 });
    expect(mockService.validate).toHaveBeenCalledWith(USER_1, TX_1);
    expect(result).toEqual({ data: sampleResponse });
  });

  it('cancel delegates to service with user_id, param id and body', async () => {
    const body = { reason: 'Erreur de saisie' };
    const result = await controller.cancel({ id: TX_1 }, body);
    expect(mockService.cancel).toHaveBeenCalledWith(USER_1, TX_1, body);
    expect(result).toEqual({ data: sampleResponse });
  });

  it('delete delegates to service with user_id and param id', async () => {
    await controller.delete({ id: TX_1 });
    expect(mockService.delete).toHaveBeenCalledWith(USER_1, TX_1);
  });
});
