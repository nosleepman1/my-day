import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TransferResponse } from '@orbit/contracts';

import type { TenantContext } from '../../../platform/tenant/tenant-context';

import { TransfersController } from './transfers.controller';
import type { TransfersService } from './transfers.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const TRANSFER_ID = '01927000-0000-7000-8000-000000000030';
const ACCOUNT_FROM = '01927000-0000-7000-8000-000000000010';
const ACCOUNT_TO = '01927000-0000-7000-8000-000000000020';

describe('TransfersController', () => {
  let controller: TransfersController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };
  let mockTenant: {
    requireUserId: ReturnType<typeof vi.fn>;
  };

  const sampleResponse: TransferResponse = {
    id: TRANSFER_ID,
    fromAccountId: ACCOUNT_FROM,
    toAccountId: ACCOUNT_TO,
    fromAmountMinor: '50000',
    toAmountMinor: '50000',
    fromCurrency: 'XOF',
    toCurrency: 'XOF',
    exchangeRate: null,
    rateDate: null,
    transaction: {
      id: TRANSFER_ID,
      type: 'TRANSFER',
      status: 'VALIDATED',
      economicClass: 'INTERNAL_TRANSFER',
      amountMinor: '50000',
      currency: 'XOF',
      occurredAt: '2026-02-01T10:00:00.000Z',
      valueDate: '2026-02-01',
      source: 'MANUAL',
      description: 'Virement',
      notes: null,
      categoryId: null,
      counterpartyId: null,
      transferId: null,
      cancelReason: null,
      cancelledAt: null,
      ledgerEntries: [],
      createdAt: '2026-02-01T10:00:00.000Z',
      updatedAt: '2026-02-01T10:00:00.000Z',
    },
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleResponse),
      getById: vi.fn().mockResolvedValue(sampleResponse),
    };

    mockTenant = {
      requireUserId: vi.fn().mockReturnValue(USER_1),
    };

    controller = new TransfersController(
      mockService as unknown as TransfersService,
      mockTenant as unknown as TenantContext,
    );
  });

  it('create delegates to service with user_id and returns data envelope', async () => {
    const body = {
      fromAccountId: ACCOUNT_FROM,
      toAccountId: ACCOUNT_TO,
      fromAmountMinor: '50000',
      occurredAt: '2026-02-01T10:00:00.000Z',
      valueDate: '2026-02-01',
    };

    const result = await controller.create(body, 'idem-key-transfer');
    expect(mockService.create).toHaveBeenCalledWith(USER_1, body, 'idem-key-transfer');
    expect(result).toEqual({ data: sampleResponse });
  });

  it('getById delegates to service with user_id and param id', async () => {
    const result = await controller.getById({ id: TRANSFER_ID });
    expect(mockService.getById).toHaveBeenCalledWith(USER_1, TRANSFER_ID);
    expect(result).toEqual({ data: sampleResponse });
  });
});
