import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type {
  OccurrenceWithRelations,
  RecurringRepository,
  RecurringTransactionWithRelations,
} from './recurring.repository';
import { RecurringService } from './recurring.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const RECURRING_1 = '01927000-0000-7000-8000-000000000010';
const OCCURRENCE_1 = '01927000-0000-7000-8000-000000000050';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000020';
const TX_1 = '01927000-0000-7000-8000-000000000060';

describe('RecurringService - Occurrences (Task 8)', () => {
  let service: RecurringService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    createOccurrencesBatch: ReturnType<typeof vi.fn>;
    findOccurrenceById: ReturnType<typeof vi.fn>;
    listOccurrences: ReturnType<typeof vi.fn>;
    confirmOccurrenceWithTransaction: ReturnType<typeof vi.fn>;
    attachOccurrenceTransaction: ReturnType<typeof vi.fn>;
    skipOccurrence: ReturnType<typeof vi.fn>;
  };
  let mockCtx: {
    newId: ReturnType<typeof vi.fn>;
    now: ReturnType<typeof vi.fn>;
    db: {
      financialAccount: { findFirst: ReturnType<typeof vi.fn> };
      transactionCategory: { findFirst: ReturnType<typeof vi.fn> };
      counterparty: { findFirst: ReturnType<typeof vi.fn> };
      transaction: { findFirst: ReturnType<typeof vi.fn> };
      debtRepayment: { findFirst: ReturnType<typeof vi.fn> };
    };
  };
  let mockAudit: {
    record: ReturnType<typeof vi.fn>;
  };

  const sampleRecurring: RecurringTransactionWithRelations = {
    id: RECURRING_1,
    userId: USER_1,
    name: 'Abonnement Internet',
    type: 'EXPENSE',
    economicClass: 'EXPENSE_OPERATING',
    amountMinor: 25_000n,
    currency: 'XOF',
    accountId: ACCOUNT_1,
    destinationAccountId: null,
    categoryId: null,
    counterpartyId: null,
    projectId: null,
    generationMode: 'CONFIRM',
    reminderDaysBefore: 2,
    status: 'ACTIVE',
    recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5',
    recurrenceAnchorOn: new Date('2026-10-01T00:00:00.000Z'),
    recurrenceTimezone: 'Africa/Dakar',
    recurrenceLocalTime: null,
    nextOccurrenceAt: new Date('2026-10-05T00:00:00.000Z'),
    generatedUntil: null,
    notes: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
  };

  const sampleOccurrence: OccurrenceWithRelations = {
    id: OCCURRENCE_1,
    userId: USER_1,
    recurringTransactionId: RECURRING_1,
    dueOn: new Date('2026-10-05T00:00:00.000Z'),
    expectedAmountMinor: 25_000n,
    currency: 'XOF',
    status: 'EXPECTED',
    transactionId: null,
    confirmedAt: null,
    skippedAt: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    recurringTransaction: {
      id: RECURRING_1,
      name: 'Abonnement Internet',
      type: 'EXPENSE',
      economicClass: 'EXPENSE_OPERATING',
      accountId: ACCOUNT_1,
    },
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      createOccurrencesBatch: vi.fn(),
      findOccurrenceById: vi.fn(),
      listOccurrences: vi.fn(),
      confirmOccurrenceWithTransaction: vi.fn(),
      attachOccurrenceTransaction: vi.fn(),
      skipOccurrence: vi.fn(),
    };
    mockCtx = {
      newId: vi.fn(() => OCCURRENCE_1),
      now: vi.fn(() => new Date('2026-10-15T12:00:00.000Z')),
      db: {
        financialAccount: { findFirst: vi.fn().mockResolvedValue({ id: ACCOUNT_1, currency: 'XOF' }) },
        transactionCategory: { findFirst: vi.fn().mockResolvedValue(null) },
        counterparty: { findFirst: vi.fn().mockResolvedValue(null) },
        transaction: { findFirst: vi.fn() },
        debtRepayment: { findFirst: vi.fn().mockResolvedValue(null) },
      },
    };
    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };

    service = new RecurringService(
      mockRepo as unknown as RecurringRepository,
      mockCtx as unknown as FinanceContext,
      mockAudit as unknown as AuditService,
    );
  });

  describe('materializeOccurrences', () => {
    it('materializes occurrences up to specified horizon date', async () => {
      mockRepo.findById.mockResolvedValue(sampleRecurring);
      mockRepo.createOccurrencesBatch.mockResolvedValue(2);

      const count = await service.materializeOccurrences(USER_1, RECURRING_1, '2026-12-01');

      expect(count).toBe(2);
      expect(mockRepo.createOccurrencesBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            userId: USER_1,
            recurringTransactionId: RECURRING_1,
            expectedAmountMinor: 25_000n,
            currency: 'XOF',
            status: 'EXPECTED',
          }),
        ]),
      );
    });
  });

  describe('confirmOccurrence', () => {
    it('confirms occurrence by creating transaction when no transactionId provided', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockRepo.confirmOccurrenceWithTransaction.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
        transactionId: TX_1,
        confirmedAt: new Date('2026-10-15T12:00:00.000Z'),
      });

      const result = await service.confirmOccurrence(USER_1, OCCURRENCE_1, {});

      expect(result.status).toBe('CONFIRMED');
      expect(mockRepo.confirmOccurrenceWithTransaction).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.recurring.occurrence_confirm',
          userId: USER_1,
          entityId: OCCURRENCE_1,
        }),
      );
    });

    it('confirms occurrence by attaching an existing transaction', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockCtx.db.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        currency: 'XOF',
      });
      mockRepo.attachOccurrenceTransaction.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
        transactionId: TX_1,
        confirmedAt: new Date('2026-10-15T12:00:00.000Z'),
      });

      const result = await service.confirmOccurrence(USER_1, OCCURRENCE_1, {
        transactionId: TX_1,
      });

      expect(result.status).toBe('CONFIRMED');
      expect(mockRepo.attachOccurrenceTransaction).toHaveBeenCalledWith(
        USER_1,
        OCCURRENCE_1,
        TX_1,
        expect.any(Date),
      );
    });

    it('refuses confirmation if occurrence is already SKIPPED', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue({
        ...sampleOccurrence,
        status: 'SKIPPED',
      });

      await expect(service.confirmOccurrence(USER_1, OCCURRENCE_1, {})).rejects.toThrow(DomainError);
    });
  });

  describe('skipOccurrence', () => {
    it('marks occurrence as SKIPPED and records audit log', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockRepo.skipOccurrence.mockResolvedValue({
        ...sampleOccurrence,
        status: 'SKIPPED',
        skippedAt: new Date('2026-10-15T12:00:00.000Z'),
      });

      const result = await service.skipOccurrence(USER_1, OCCURRENCE_1, {
        reason: 'Congés payés',
      });

      expect(result.status).toBe('SKIPPED');
      expect(mockRepo.skipOccurrence).toHaveBeenCalledWith(USER_1, OCCURRENCE_1, expect.any(Date));
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.recurring.occurrence_skip',
          userId: USER_1,
          entityId: OCCURRENCE_1,
        }),
      );
    });

    it('refuses skip if occurrence is already CONFIRMED', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
      });

      await expect(service.skipOccurrence(USER_1, OCCURRENCE_1, {})).rejects.toThrow(DomainError);
    });
  });
});
