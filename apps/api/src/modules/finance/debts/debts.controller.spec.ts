import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DebtResponse } from '@orbit/contracts';

import type { TenantContext } from '../../../platform/tenant/tenant-context';

import { DebtsController } from './debts.controller';
import type { DebtsService } from './debts.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const DEBT_1 = '01927000-0000-7000-8000-000000000020';
const COUNTERPARTY_1 = '01927000-0000-7000-8000-000000000030';

describe('DebtsController', () => {
  let controller: DebtsController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createRepayment: ReturnType<typeof vi.fn>;
    listRepayments: ReturnType<typeof vi.fn>;
    deleteRepayment: ReturnType<typeof vi.fn>;
  };
  let mockTenant: {
    requireUserId: ReturnType<typeof vi.fn>;
  };

  const sampleDebtResponse: DebtResponse = {
    id: DEBT_1,
    userId: USER_1,
    type: 'PAYABLE',
    counterpartyId: COUNTERPARTY_1,
    title: 'Prêt matériel',
    description: null,
    principalMinor: '250000',
    currency: 'XOF',
    openedOn: '2026-10-01',
    dueDate: '2026-11-01',
    status: 'OPEN',
    cancelledAt: null,
    writtenOffAt: null,
    closingReason: null,
    notes: null,
    totalRepaidMinor: '0',
    remainingMinor: '250000',
    settlementStatus: 'UNPAID',
    isOverdue: false,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleDebtResponse),
      list: vi.fn().mockResolvedValue({ items: [sampleDebtResponse], nextCursor: null }),
      getById: vi.fn().mockResolvedValue(sampleDebtResponse),
      update: vi.fn().mockResolvedValue(sampleDebtResponse),
      createRepayment: vi.fn(),
      listRepayments: vi.fn(),
      deleteRepayment: vi.fn(),
    };

    mockTenant = {
      requireUserId: vi.fn().mockReturnValue(USER_1),
    };

    controller = new DebtsController(
      mockService as unknown as DebtsService,
      mockTenant as unknown as TenantContext,
    );
  });

  it('create delegates to service with tenant user id and returns data envelope', async () => {
    const input = {
      type: 'PAYABLE' as const,
      counterpartyId: COUNTERPARTY_1,
      title: 'Prêt matériel',
      principalMinor: '250000',
      currency: 'XOF' as const,
      openedOn: '2026-10-01',
    };

    const result = await controller.create(input);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.create).toHaveBeenCalledWith(USER_1, input);
    expect(result).toEqual({ data: sampleDebtResponse });
  });

  it('list delegates to service with pagination and returns list envelope', async () => {
    const query = { limit: 20 };
    const result = await controller.list(query);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.list).toHaveBeenCalledWith(USER_1, query);
    expect(result).toEqual({
      data: [sampleDebtResponse],
      meta: {
        limit: 20,
        hasMore: false,
        nextCursor: null,
      },
    });
  });

  it('getById delegates to service and returns data envelope', async () => {
    const result = await controller.getById({ id: DEBT_1 });

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.getById).toHaveBeenCalledWith(USER_1, DEBT_1);
    expect(result).toEqual({ data: sampleDebtResponse });
  });

  it('update delegates to service and returns data envelope', async () => {
    const updateInput = { title: 'Titre modifié' };
    const result = await controller.update({ id: DEBT_1 }, updateInput);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.update).toHaveBeenCalledWith(USER_1, DEBT_1, updateInput);
    expect(result).toEqual({ data: sampleDebtResponse });
  });

  it('createRepayment delegates to service and returns data envelope', async () => {
    const repaymentResponse = {
      id: '01927000-0000-7000-8000-000000000050',
      debtId: DEBT_1,
      transactionId: '01927000-0000-7000-8000-000000000040',
      amountMinor: '50000',
      currency: 'XOF' as const,
      notes: null,
      createdAt: '2026-10-15T12:00:00.000Z',
    };
    mockService.createRepayment.mockResolvedValue(repaymentResponse);

    const result = await controller.createRepayment(
      { id: DEBT_1 },
      { amountMinor: '50000', accountId: '01927000-0000-7000-8000-000000000030' },
    );

    expect(mockService.createRepayment).toHaveBeenCalledWith(USER_1, DEBT_1, {
      amountMinor: '50000',
      accountId: '01927000-0000-7000-8000-000000000030',
    });
    expect(result).toEqual({ data: repaymentResponse });
  });

  it('listRepayments delegates to service and returns list envelope', async () => {
    const repayments = [
      {
        id: '01927000-0000-7000-8000-000000000050',
        debtId: DEBT_1,
        transactionId: '01927000-0000-7000-8000-000000000040',
        amountMinor: '50000',
        currency: 'XOF' as const,
        notes: null,
        createdAt: '2026-10-15T12:00:00.000Z',
      },
    ];
    mockService.listRepayments.mockResolvedValue(repayments);

    const result = await controller.listRepayments({ id: DEBT_1 });

    expect(mockService.listRepayments).toHaveBeenCalledWith(USER_1, DEBT_1);
    expect(result).toEqual({
      data: repayments,
      meta: {
        limit: 1,
        hasMore: false,
        nextCursor: null,
      },
    });
  });

  it('deleteRepayment delegates to service with userId, debtId, repaymentId', async () => {
    mockService.deleteRepayment.mockResolvedValue(undefined);

    await controller.deleteRepayment({
      id: DEBT_1,
      repaymentId: '01927000-0000-7000-8000-000000000050',
    });

    expect(mockService.deleteRepayment).toHaveBeenCalledWith(
      USER_1,
      DEBT_1,
      '01927000-0000-7000-8000-000000000050',
    );
  });
});
