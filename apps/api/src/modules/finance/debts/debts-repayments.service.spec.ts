import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import type { FinanceContext } from '../shared/finance-context';

import type { DebtWithRelations, DebtsRepository } from './debts.repository';
import { DebtsService } from './debts.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const DEBT_1 = '01927000-0000-7000-8000-000000000010';
const COUNTERPARTY_1 = '01927000-0000-7000-8000-000000000020';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000030';
const TX_1 = '01927000-0000-7000-8000-000000000040';
const REPAYMENT_1 = '01927000-0000-7000-8000-000000000050';

describe('DebtsService - Repayments (Task 5)', () => {
  let service: DebtsService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    createRepaymentWithTransaction: ReturnType<typeof vi.fn>;
    attachRepayment: ReturnType<typeof vi.fn>;
    deleteRepayment: ReturnType<typeof vi.fn>;
    listRepayments: ReturnType<typeof vi.fn>;
  };
  let mockCounterpartiesRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let mockCtx: {
    newId: ReturnType<typeof vi.fn>;
    now: ReturnType<typeof vi.fn>;
  };
  let mockAudit: {
    record: ReturnType<typeof vi.fn>;
  };

  const sampleDebt: DebtWithRelations = {
    id: DEBT_1,
    userId: USER_1,
    type: 'PAYABLE',
    counterpartyId: COUNTERPARTY_1,
    title: 'Emprunt matériel',
    description: null,
    principalMinor: 100_000n,
    currency: 'XOF',
    openedOn: new Date('2026-10-01T00:00:00.000Z'),
    dueDate: new Date('2026-11-01T00:00:00.000Z'),
    status: 'OPEN',
    cancelledAt: null,
    writtenOffAt: null,
    closingReason: null,
    notes: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    counterparty: {
      id: COUNTERPARTY_1,
      name: 'Moussa Diop',
      kind: 'PERSON',
    },
    repayments: [],
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
      createRepaymentWithTransaction: vi.fn(),
      attachRepayment: vi.fn(),
      deleteRepayment: vi.fn(),
      listRepayments: vi.fn(),
    };
    mockCounterpartiesRepo = {
      findById: vi.fn(),
    };
    let idCounter = 1;
    mockCtx = {
      newId: vi.fn(() => `01927000-0000-7000-8000-0000000000${(idCounter++).toString().padStart(2, '0')}`),
      now: vi.fn(() => new Date('2026-10-15T12:00:00.000Z')),
    };
    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new DebtsService(
      mockRepo as unknown as DebtsRepository,
      mockCounterpartiesRepo as unknown as CounterpartiesRepository,
      mockCtx as unknown as FinanceContext,
      mockAudit as unknown as AuditService,
    );
  });

  describe('createRepayment', () => {
    it('creates repayment with a new transaction when accountId is provided', async () => {
      mockRepo.findById.mockResolvedValue(sampleDebt);
      mockRepo.createRepaymentWithTransaction.mockResolvedValue({
        id: REPAYMENT_1,
        debtId: DEBT_1,
        transactionId: TX_1,
        amountMinor: 30_000n,
        currency: 'XOF',
        notes: 'Premier versement',
        createdAt: new Date('2026-10-15T12:00:00.000Z'),
        transaction: {
          id: TX_1,
          occurredAt: new Date('2026-10-15T12:00:00.000Z'),
          valueDate: new Date('2026-10-15T00:00:00.000Z'),
          status: 'VALIDATED',
          amountMinor: 30_000n,
          currency: 'XOF',
        },
      });

      const result = await service.createRepayment(USER_1, DEBT_1, {
        accountId: ACCOUNT_1,
        amountMinor: '30000',
        date: '2026-10-15',
        notes: 'Premier versement',
      });

      expect(result.id).toBe(REPAYMENT_1);
      expect(result.amountMinor).toBe('30000');
      expect(mockRepo.createRepaymentWithTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_1,
          debtId: DEBT_1,
          accountId: ACCOUNT_1,
          amountMinor: 30_000n,
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.repayment_create',
          userId: USER_1,
          entityId: REPAYMENT_1,
        }),
      );
    });

    it('attaches an existing transaction when transactionId is provided', async () => {
      mockRepo.findById.mockResolvedValue(sampleDebt);
      mockRepo.attachRepayment.mockResolvedValue({
        id: REPAYMENT_1,
        debtId: DEBT_1,
        transactionId: TX_1,
        amountMinor: 30_000n,
        currency: 'XOF',
        notes: null,
        createdAt: new Date('2026-10-15T12:00:00.000Z'),
        transaction: {
          id: TX_1,
          occurredAt: new Date('2026-10-15T12:00:00.000Z'),
          valueDate: new Date('2026-10-15T00:00:00.000Z'),
          status: 'VALIDATED',
          amountMinor: 30_000n,
          currency: 'XOF',
        },
      });

      const result = await service.createRepayment(USER_1, DEBT_1, {
        transactionId: TX_1,
        amountMinor: '30000',
      });

      expect(result.id).toBe(REPAYMENT_1);
      expect(mockRepo.attachRepayment).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 30_000n,
        }),
      );
    });

    it('refuses overpayment when repayment amount exceeds remaining balance', async () => {
      mockRepo.findById.mockResolvedValue(sampleDebt); // principal: 100 000, remaining: 100 000

      await expect(
        service.createRepayment(USER_1, DEBT_1, {
          accountId: ACCOUNT_1,
          amountMinor: '150000', // Exceeds 100 000
        }),
      ).rejects.toThrow(DomainError);
    });

    it('refuses repayment when debt status is not OPEN', async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleDebt,
        status: 'CANCELLED',
      });

      await expect(
        service.createRepayment(USER_1, DEBT_1, {
          accountId: ACCOUNT_1,
          amountMinor: '30000',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('deleteRepayment', () => {
    it('detaches repayment while preserving underlying transaction', async () => {
      mockRepo.findById.mockResolvedValue(sampleDebt);
      mockRepo.deleteRepayment.mockResolvedValue({
        id: REPAYMENT_1,
        debtId: DEBT_1,
        transactionId: TX_1,
      });

      await service.deleteRepayment(USER_1, DEBT_1, REPAYMENT_1);

      expect(mockRepo.deleteRepayment).toHaveBeenCalledWith(USER_1, DEBT_1, REPAYMENT_1);
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.repayment_delete',
          userId: USER_1,
          entityId: REPAYMENT_1,
        }),
      );
    });
  });
});
