import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type { RecurringRepository, RecurringTransactionWithRelations } from './recurring.repository';
import { RecurringService } from './recurring.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const RECURRING_1 = '01927000-0000-7000-8000-000000000010';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000020';
const CATEGORY_1 = '01927000-0000-7000-8000-000000000030';
const COUNTERPARTY_1 = '01927000-0000-7000-8000-000000000040';

describe('RecurringService (Task 7)', () => {
  let service: RecurringService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    findOccurrenceById: ReturnType<typeof vi.fn>;
    listOccurrences: ReturnType<typeof vi.fn>;
    createOccurrencesBatch: ReturnType<typeof vi.fn>;
    attachOccurrenceTransaction: ReturnType<typeof vi.fn>;
    skipOccurrence: ReturnType<typeof vi.fn>;
    confirmOccurrenceWithTransaction: ReturnType<typeof vi.fn>;
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

  const sampleAccount = {
    id: ACCOUNT_1,
    userId: USER_1,
    name: 'Compte Courant',
    currency: 'XOF',
    status: 'ACTIVE',
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
    categoryId: CATEGORY_1,
    counterpartyId: COUNTERPARTY_1,
    projectId: null,
    generationMode: 'CONFIRM',
    reminderDaysBefore: 2,
    status: 'ACTIVE',
    recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5',
    recurrenceAnchorOn: new Date('2026-10-01T00:00:00.000Z'),
    recurrenceTimezone: 'Africa/Dakar',
    recurrenceLocalTime: null,
    nextOccurrenceAt: new Date('2026-11-05T00:00:00.000Z'),
    generatedUntil: null,
    notes: 'Fibre Orange',
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    account: { id: ACCOUNT_1, name: 'Compte Courant', currency: 'XOF' },
    destinationAccount: null,
    category: { id: CATEGORY_1, name: 'Services' },
    counterparty: { id: COUNTERPARTY_1, name: 'Orange', kind: 'ORGANIZATION' },
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      updateStatus: vi.fn(),
      findOccurrenceById: vi.fn(),
      listOccurrences: vi.fn(),
      createOccurrencesBatch: vi.fn(),
      attachOccurrenceTransaction: vi.fn(),
      skipOccurrence: vi.fn(),
      confirmOccurrenceWithTransaction: vi.fn(),
    };
    mockCtx = {
      newId: vi.fn(() => RECURRING_1),
      now: vi.fn(() => new Date('2026-10-15T12:00:00.000Z')),
      db: {
        financialAccount: { findFirst: vi.fn().mockResolvedValue(sampleAccount) },
        transactionCategory: { findFirst: vi.fn().mockResolvedValue({ id: CATEGORY_1, userId: USER_1 }) },
        counterparty: { findFirst: vi.fn().mockResolvedValue({ id: COUNTERPARTY_1, userId: USER_1 }) },
        transaction: { findFirst: vi.fn().mockResolvedValue(null) },
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

  describe('create', () => {
    it('creates a recurring transaction and computes nextOccurrenceAt', async () => {
      mockRepo.create.mockResolvedValue(sampleRecurring);

      const result = await service.create(USER_1, {
        name: 'Abonnement Internet',
        type: 'EXPENSE',
        economicClass: 'EXPENSE_OPERATING',
        amountMinor: '25000',
        currency: 'XOF',
        accountId: ACCOUNT_1,
        categoryId: CATEGORY_1,
        counterpartyId: COUNTERPARTY_1,
        generationMode: 'CONFIRM',
        reminderDaysBefore: 2,
        recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5',
        recurrenceAnchorOn: '2026-10-01',
        recurrenceTimezone: 'Africa/Dakar',
        notes: 'Fibre Orange',
      });

      expect(result.id).toBe(RECURRING_1);
      expect(result.amountMinor).toBe('25000');
      expect(result.status).toBe('ACTIVE');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_1,
          accountId: ACCOUNT_1,
          currency: 'XOF',
          recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1;BYMONTHDAY=5',
          nextOccurrenceAt: expect.any(Date),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.recurring.create',
          userId: USER_1,
          entityId: RECURRING_1,
        }),
      );
    });

    it('refuses creation if recurrence rule is invalid', async () => {
      await expect(
        service.create(USER_1, {
          name: 'Abonnement',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          amountMinor: '25000',
          currency: 'XOF',
          accountId: ACCOUNT_1,
          recurrenceRule: 'INVALID_RULE_SYNTAX',
          recurrenceAnchorOn: '2026-10-01',
          recurrenceTimezone: 'Africa/Dakar',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('refuses creation if currency does not match account currency', async () => {
      await expect(
        service.create(USER_1, {
          name: 'Abonnement EUR',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          amountMinor: '5000',
          currency: 'EUR', // Account is XOF
          accountId: ACCOUNT_1,
          recurrenceRule: 'FREQ=MONTHLY;INTERVAL=1',
          recurrenceAnchorOn: '2026-10-01',
          recurrenceTimezone: 'Africa/Dakar',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('pause and resume', () => {
    it('pauses active recurrence and sets nextOccurrenceAt to null', async () => {
      mockRepo.findById.mockResolvedValue(sampleRecurring);
      mockRepo.updateStatus.mockResolvedValue({
        ...sampleRecurring,
        status: 'PAUSED',
        nextOccurrenceAt: null,
      });

      const result = await service.pause(USER_1, RECURRING_1);

      expect(result.status).toBe('PAUSED');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(USER_1, RECURRING_1, 'PAUSED', null);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.recurring.pause',
          userId: USER_1,
          entityId: RECURRING_1,
        }),
      );
    });

    it('resumes paused recurrence and recalculates nextOccurrenceAt', async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleRecurring,
        status: 'PAUSED',
        nextOccurrenceAt: null,
      });
      mockRepo.updateStatus.mockResolvedValue({
        ...sampleRecurring,
        status: 'ACTIVE',
        nextOccurrenceAt: new Date('2026-11-05T00:00:00.000Z'),
      });

      const result = await service.resume(USER_1, RECURRING_1);

      expect(result.status).toBe('ACTIVE');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(USER_1, RECURRING_1, 'ACTIVE', expect.any(Date));
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.recurring.resume',
          userId: USER_1,
          entityId: RECURRING_1,
        }),
      );
    });

    it('refuses pause or resume if recurrence is ENDED', async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleRecurring,
        status: 'ENDED',
      });

      await expect(service.pause(USER_1, RECURRING_1)).rejects.toThrow(DomainError);
      await expect(service.resume(USER_1, RECURRING_1)).rejects.toThrow(DomainError);
    });
  });

  describe('terminate', () => {
    it('terminates recurrence and sets nextOccurrenceAt to null', async () => {
      mockRepo.findById.mockResolvedValue(sampleRecurring);
      mockRepo.updateStatus.mockResolvedValue({
        ...sampleRecurring,
        status: 'ENDED',
        nextOccurrenceAt: null,
      });

      const result = await service.terminate(USER_1, RECURRING_1);

      expect(result.status).toBe('ENDED');
      expect(mockRepo.updateStatus).toHaveBeenCalledWith(USER_1, RECURRING_1, 'ENDED', null);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.recurring.terminate',
          userId: USER_1,
          entityId: RECURRING_1,
        }),
      );
    });
  });

  describe('occurrences', () => {
    const OCCURRENCE_1 = '01927000-0000-7000-8000-000000000050';
    const TX_1 = '01927000-0000-7000-8000-000000000060';

    const sampleOccurrence = {
      id: OCCURRENCE_1,
      userId: USER_1,
      recurringTransactionId: RECURRING_1,
      dueOn: new Date('2026-11-05T00:00:00.000Z'),
      expectedAmountMinor: 25_000n,
      currency: 'XOF',
      status: 'PLANNED' as const,
      transactionId: null,
      confirmedAt: null,
      skippedAt: null,
      createdAt: new Date('2026-10-01T10:00:00.000Z'),
      recurringTransaction: {
        id: RECURRING_1,
        name: 'Abonnement Internet',
        type: 'EXPENSE' as const,
        economicClass: 'EXPENSE_OPERATING' as const,
        accountId: ACCOUNT_1,
      },
    };

    it('lists occurrences via repo', async () => {
      mockRepo.listOccurrences.mockResolvedValue({ items: [sampleOccurrence] });
      const res = await service.listOccurrences(USER_1, { limit: 10 });
      expect(res.items).toHaveLength(1);
    });

    it('confirms occurrence by generating new transaction', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockRepo.confirmOccurrenceWithTransaction.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
        transactionId: TX_1,
        confirmedAt: new Date('2026-02-01T10:00:00.000Z'),
      });

      const res = await service.confirmOccurrence(USER_1, OCCURRENCE_1, {});
      expect(res.status).toBe('CONFIRMED');
      expect(mockRepo.confirmOccurrenceWithTransaction).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'finance.recurring.occurrence_confirm' }),
      );
    });

    it('confirms occurrence by attaching an existing transaction', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockCtx.db.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        currency: 'XOF',
        amountMinor: 25_000n,
      });
      mockRepo.attachOccurrenceTransaction.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
        transactionId: TX_1,
        confirmedAt: new Date('2026-02-01T10:00:00.000Z'),
      });

      const res = await service.confirmOccurrence(USER_1, OCCURRENCE_1, { transactionId: TX_1 });
      expect(res.status).toBe('CONFIRMED');
      expect(mockRepo.attachOccurrenceTransaction).toHaveBeenCalled();
    });

    it('throws NOT_FOUND if attached transaction does not exist', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockCtx.db.transaction.findFirst.mockResolvedValue(null);

      await expect(service.confirmOccurrence(USER_1, OCCURRENCE_1, { transactionId: TX_1 })).rejects.toThrow(
        DomainError,
      );
    });

    it('throws BUSINESS_RULE_VIOLATION if attached transaction is not VALIDATED', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockCtx.db.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'PENDING',
        currency: 'XOF',
        amountMinor: 25_000n,
      });

      await expect(service.confirmOccurrence(USER_1, OCCURRENCE_1, { transactionId: TX_1 })).rejects.toThrow(
        DomainError,
      );
    });

    it('throws CURRENCY_MISMATCH if transaction currency differs', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockCtx.db.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        currency: 'EUR',
        amountMinor: 25_000n,
      });

      await expect(service.confirmOccurrence(USER_1, OCCURRENCE_1, { transactionId: TX_1 })).rejects.toThrow(
        DomainError,
      );
    });

    it('throws BUSINESS_RULE_VIOLATION if transaction already attached to a repayment', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockCtx.db.transaction.findFirst.mockResolvedValue({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        currency: 'XOF',
        amountMinor: 25_000n,
      });
      mockCtx.db.debtRepayment.findFirst.mockResolvedValue({ id: 'repayment_id' });

      await expect(service.confirmOccurrence(USER_1, OCCURRENCE_1, { transactionId: TX_1 })).rejects.toThrow(
        DomainError,
      );
    });

    it('returns idempotently if occurrence already confirmed', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
      });

      const res = await service.confirmOccurrence(USER_1, OCCURRENCE_1, {});
      expect(res.status).toBe('CONFIRMED');
      expect(mockRepo.confirmOccurrenceWithTransaction).not.toHaveBeenCalled();
    });

    it('throws INVALID_STATE_TRANSITION if confirming SKIPPED occurrence', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue({
        ...sampleOccurrence,
        status: 'SKIPPED',
      });

      await expect(service.confirmOccurrence(USER_1, OCCURRENCE_1, {})).rejects.toThrow(DomainError);
    });

    it('skips planned occurrence', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue(sampleOccurrence);
      mockRepo.skipOccurrence.mockResolvedValue({
        ...sampleOccurrence,
        status: 'SKIPPED',
        skippedAt: new Date('2026-02-01T10:00:00.000Z'),
      });

      const res = await service.skipOccurrence(USER_1, OCCURRENCE_1, { reason: 'Vacances' });
      expect(res.status).toBe('SKIPPED');
      expect(mockRepo.skipOccurrence).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'finance.recurring.occurrence_skip' }),
      );
    });

    it('returns idempotently if occurrence already skipped', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue({
        ...sampleOccurrence,
        status: 'SKIPPED',
      });

      const res = await service.skipOccurrence(USER_1, OCCURRENCE_1, {});
      expect(res.status).toBe('SKIPPED');
      expect(mockRepo.skipOccurrence).not.toHaveBeenCalled();
    });

    it('throws INVALID_STATE_TRANSITION if skipping confirmed occurrence', async () => {
      mockRepo.findOccurrenceById.mockResolvedValue({
        ...sampleOccurrence,
        status: 'CONFIRMED',
      });

      await expect(service.skipOccurrence(USER_1, OCCURRENCE_1, {})).rejects.toThrow(DomainError);
    });
  });
});
