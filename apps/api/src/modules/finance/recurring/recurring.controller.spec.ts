import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RecurringOccurrenceResponse, RecurringTransactionResponse } from '@orbit/contracts';

import type { TenantContext } from '../../../platform/tenant/tenant-context';

import { RecurringController } from './recurring.controller';
import type { RecurringService } from './recurring.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const RECURRING_1 = '01927000-0000-7000-8000-000000000010';
const OCCURRENCE_1 = '01927000-0000-7000-8000-000000000050';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000020';

describe('RecurringController', () => {
  let controller: RecurringController;
  let mockService: {
    create: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
    listOccurrences: ReturnType<typeof vi.fn>;
    confirmOccurrence: ReturnType<typeof vi.fn>;
    skipOccurrence: ReturnType<typeof vi.fn>;
    materializeOccurrences: ReturnType<typeof vi.fn>;
  };
  let mockTenant: {
    requireUserId: ReturnType<typeof vi.fn>;
  };

  const sampleRecurringResponse: RecurringTransactionResponse = {
    id: RECURRING_1,
    userId: USER_1,
    name: 'Abonnement Internet',
    type: 'EXPENSE',
    economicClass: 'EXPENSE_OPERATING',
    amountMinor: '25000',
    currency: 'XOF',
    accountId: ACCOUNT_1,
    destinationAccountId: null,
    categoryId: null,
    counterpartyId: null,
    projectId: null,
    generationMode: 'CONFIRM',
    reminderDaysBefore: 1,
    status: 'ACTIVE',
    recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1',
    recurrenceAnchorOn: '2026-10-01',
    recurrenceTimezone: 'Africa/Dakar',
    recurrenceLocalTime: null,
    nextOccurrenceAt: '2026-11-01T00:00:00.000Z',
    generatedUntil: null,
    notes: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  const sampleOccurrenceResponse: RecurringOccurrenceResponse = {
    id: OCCURRENCE_1,
    userId: USER_1,
    recurringTransactionId: RECURRING_1,
    dueOn: '2026-10-05',
    expectedAmountMinor: '25000',
    currency: 'XOF',
    status: 'EXPECTED',
    transactionId: null,
    confirmedAt: null,
    skippedAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    isOverdue: false,
  };

  beforeEach(() => {
    mockService = {
      create: vi.fn().mockResolvedValue(sampleRecurringResponse),
      list: vi.fn().mockResolvedValue({ items: [sampleRecurringResponse], nextCursor: null }),
      getById: vi.fn().mockResolvedValue(sampleRecurringResponse),
      update: vi.fn().mockResolvedValue(sampleRecurringResponse),
      pause: vi.fn().mockResolvedValue({ ...sampleRecurringResponse, status: 'PAUSED' }),
      resume: vi.fn().mockResolvedValue({ ...sampleRecurringResponse, status: 'ACTIVE' }),
      terminate: vi.fn().mockResolvedValue({ ...sampleRecurringResponse, status: 'ENDED' }),
      listOccurrences: vi.fn().mockResolvedValue({ items: [sampleOccurrenceResponse], nextCursor: null }),
      confirmOccurrence: vi.fn().mockResolvedValue({ ...sampleOccurrenceResponse, status: 'CONFIRMED' }),
      skipOccurrence: vi.fn().mockResolvedValue({ ...sampleOccurrenceResponse, status: 'SKIPPED' }),
      materializeOccurrences: vi.fn().mockResolvedValue(2),
    };

    mockTenant = {
      requireUserId: vi.fn().mockReturnValue(USER_1),
    };

    controller = new RecurringController(
      mockService as unknown as RecurringService,
      mockTenant as unknown as TenantContext,
    );
  });

  it('create delegates to service and returns data envelope', async () => {
    const input = {
      name: 'Abonnement Internet',
      type: 'EXPENSE' as const,
      economicClass: 'EXPENSE_OPERATING' as const,
      amountMinor: '25000',
      currency: 'XOF' as const,
      accountId: ACCOUNT_1,
      generationMode: 'CONFIRM' as const,
      reminderDaysBefore: 1,
      recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1',
      recurrenceAnchorOn: '2026-10-01',
      recurrenceTimezone: 'Africa/Dakar',
    };

    const result = await controller.create(input);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.create).toHaveBeenCalledWith(USER_1, input);
    expect(result).toEqual({ data: sampleRecurringResponse });
  });

  it('list delegates to service with pagination and returns list envelope', async () => {
    const query = { limit: 10 };
    const result = await controller.list(query);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.list).toHaveBeenCalledWith(USER_1, query);
    expect(result).toEqual({
      data: [sampleRecurringResponse],
      meta: {
        limit: 10,
        hasMore: false,
        nextCursor: null,
      },
    });
  });

  it('getById delegates to service and returns data envelope', async () => {
    const result = await controller.getById({ id: RECURRING_1 });

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.getById).toHaveBeenCalledWith(USER_1, RECURRING_1);
    expect(result).toEqual({ data: sampleRecurringResponse });
  });

  it('update delegates to service and returns data envelope', async () => {
    const updateInput = { name: 'Abonnement Fibre' };
    const result = await controller.update({ id: RECURRING_1 }, updateInput);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.update).toHaveBeenCalledWith(USER_1, RECURRING_1, updateInput);
    expect(result).toEqual({ data: sampleRecurringResponse });
  });

  it('pause delegates to service', async () => {
    const result = await controller.pause({ id: RECURRING_1 });

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.pause).toHaveBeenCalledWith(USER_1, RECURRING_1);
    expect(result.data.status).toBe('PAUSED');
  });

  it('resume delegates to service', async () => {
    const result = await controller.resume({ id: RECURRING_1 });

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.resume).toHaveBeenCalledWith(USER_1, RECURRING_1);
    expect(result.data.status).toBe('ACTIVE');
  });

  it('terminate delegates to service', async () => {
    const result = await controller.terminate({ id: RECURRING_1 });

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.terminate).toHaveBeenCalledWith(USER_1, RECURRING_1);
    expect(result.data.status).toBe('ENDED');
  });

  it('listOccurrences delegates to service and returns list envelope', async () => {
    const query = { limit: 20 };
    const result = await controller.listOccurrences(query);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.listOccurrences).toHaveBeenCalledWith(USER_1, query);
    expect(result).toEqual({
      data: [sampleOccurrenceResponse],
      meta: {
        limit: 20,
        hasMore: false,
        nextCursor: null,
      },
    });
  });

  it('confirmOccurrence delegates to service and returns envelope', async () => {
    const result = await controller.confirmOccurrence({ id: OCCURRENCE_1 }, {});

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.confirmOccurrence).toHaveBeenCalledWith(USER_1, OCCURRENCE_1, {});
    expect(result.data.status).toBe('CONFIRMED');
  });

  it('skipOccurrence delegates to service and returns envelope', async () => {
    const result = await controller.skipOccurrence({ id: OCCURRENCE_1 }, { reason: 'Skip this' });

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.skipOccurrence).toHaveBeenCalledWith(USER_1, OCCURRENCE_1, {
      reason: 'Skip this',
    });
    expect(result.data.status).toBe('SKIPPED');
  });

  it('listOccurrencesForRecurrence materializes if to is present and returns list envelope', async () => {
    const query = { limit: 10, to: '2026-12-31' };
    const result = await controller.listOccurrencesForRecurrence({ id: RECURRING_1 }, query);

    expect(mockTenant.requireUserId).toHaveBeenCalled();
    expect(mockService.materializeOccurrences).toHaveBeenCalledWith(USER_1, RECURRING_1, '2026-12-31');
    expect(mockService.listOccurrences).toHaveBeenCalledWith(USER_1, {
      ...query,
      recurringTransactionId: RECURRING_1,
    });
    expect(result.data).toEqual([sampleOccurrenceResponse]);
  });
});
