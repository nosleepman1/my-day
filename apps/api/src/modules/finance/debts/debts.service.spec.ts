import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import type { FinanceContext } from '../shared/finance-context';

import type { DebtWithRelations, DebtsRepository } from './debts.repository';
import { DebtsService, toDebtResponse } from './debts.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const DEBT_1 = '01927000-0000-7000-8000-000000000010';
const COUNTERPARTY_1 = '01927000-0000-7000-8000-000000000020';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000030';

describe('DebtsService', () => {
  let service: DebtsService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
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
    description: 'Achat ordinateur',
    principalMinor: 500_000n,
    currency: 'XOF',
    openedOn: new Date('2026-10-01T00:00:00.000Z'),
    dueDate: new Date('2026-11-01T00:00:00.000Z'),
    status: 'OPEN',
    cancelledAt: null,
    writtenOffAt: null,
    closingReason: null,
    notes: 'Remboursement en 2 fois',
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

  describe('toDebtResponse', () => {
    it('computes derived values accurately for an unpaid debt', () => {
      const response = toDebtResponse(sampleDebt, '2026-10-15');

      expect(response.id).toBe(DEBT_1);
      expect(response.principalMinor).toBe('500000');
      expect(response.remainingMinor).toBe('500000');
      expect(response.totalRepaidMinor).toBe('0');
      expect(response.settlementStatus).toBe('UNPAID');
      expect(response.isOverdue).toBe(false);
      expect(response.counterparty?.name).toBe('Moussa Diop');
    });

    it('computes derived values for partially settled debt with repayments', () => {
      const debtWithRepayments: DebtWithRelations = {
        ...sampleDebt,
        repayments: [
          {
            amountMinor: 200_000n,
            transaction: {
              status: 'VALIDATED',
            },
          },
          {
            amountMinor: 50_000n,
            transaction: {
              status: 'CANCELLED', // Must be ignored!
            },
          },
        ],
      };

      const response = toDebtResponse(debtWithRepayments, '2026-10-15');

      expect(response.remainingMinor).toBe('300000');
      expect(response.totalRepaidMinor).toBe('200000');
      expect(response.settlementStatus).toBe('PARTIALLY_SETTLED');
      expect(response.isOverdue).toBe(false);
    });

    it('identifies overdue debt when dueDate < todayCivil and remaining > 0', () => {
      const overdueDebt: DebtWithRelations = {
        ...sampleDebt,
        dueDate: new Date('2026-10-10T00:00:00.000Z'),
      };

      const response = toDebtResponse(overdueDebt, '2026-10-15');

      expect(response.isOverdue).toBe(true);
    });
  });

  describe('create', () => {
    it('creates a debt without initial movement', async () => {
      mockCounterpartiesRepo.findById.mockResolvedValue({
        id: COUNTERPARTY_1,
        userId: USER_1,
        name: 'Moussa Diop',
        kind: 'PERSON',
      });
      mockRepo.create.mockResolvedValue(sampleDebt);

      const result = await service.create(USER_1, {
        type: 'PAYABLE',
        counterpartyId: COUNTERPARTY_1,
        title: 'Emprunt matériel',
        principalMinor: '500000',
        currency: 'XOF',
        openedOn: '2026-10-01',
        dueDate: '2026-11-01',
      });

      expect(result.id).toBe(DEBT_1);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_1,
          type: 'PAYABLE',
          counterpartyId: COUNTERPARTY_1,
          principalMinor: 500_000n,
          currency: 'XOF',
          openedOn: expect.any(Date),
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.create',
          userId: USER_1,
          entityId: expect.any(String),
        }),
      );
    });

    it('rejects creation if counterparty does not exist', async () => {
      mockCounterpartiesRepo.findById.mockResolvedValue(null);

      await expect(
        service.create(USER_1, {
          type: 'PAYABLE',
          counterpartyId: COUNTERPARTY_1,
          title: 'Emprunt',
          principalMinor: '500000',
          currency: 'XOF',
          openedOn: '2026-10-01',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('creates a debt with initial movement in the same transaction', async () => {
      mockCounterpartiesRepo.findById.mockResolvedValue({
        id: COUNTERPARTY_1,
        userId: USER_1,
        name: 'Moussa Diop',
      });
      mockRepo.create.mockResolvedValue(sampleDebt);

      const result = await service.create(USER_1, {
        type: 'PAYABLE',
        counterpartyId: COUNTERPARTY_1,
        title: 'Emprunt matériel',
        principalMinor: '500000',
        currency: 'XOF',
        openedOn: '2026-10-01',
        initialMovement: {
          accountId: ACCOUNT_1,
          valueDate: '2026-10-01',
        },
      });

      expect(result.id).toBe(DEBT_1);
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          initialMovement: expect.objectContaining({
            accountId: ACCOUNT_1,
            transactionId: expect.any(String),
            ledgerEntryId: expect.any(String),
          }),
        }),
      );
    });
  });

  describe('getById', () => {
    it('returns debt if found', async () => {
      mockRepo.findById.mockResolvedValue(sampleDebt);

      const result = await service.getById(USER_1, DEBT_1);

      expect(result.id).toBe(DEBT_1);
      expect(result.title).toBe('Emprunt matériel');
    });

    it('throws 404 NOT_FOUND if debt does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getById(USER_1, '01927000-0000-7000-8000-000000000099')).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe('update', () => {
    it('updates title, notes and checks if dueDate changed for reschedule audit', async () => {
      mockRepo.findById.mockResolvedValue(sampleDebt);
      const updatedDebt: DebtWithRelations = {
        ...sampleDebt,
        title: 'Nouveau titre',
        dueDate: new Date('2026-12-01T00:00:00.000Z'),
      };
      mockRepo.update.mockResolvedValue(updatedDebt);

      const result = await service.update(USER_1, DEBT_1, {
        title: 'Nouveau titre',
        dueDate: '2026-12-01',
      });

      expect(result.title).toBe('Nouveau titre');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.rescheduled',
        }),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.update',
        }),
      );
    });

    it('rejects modification if debt is CANCELLED', async () => {
      mockRepo.findById.mockResolvedValue({
        ...sampleDebt,
        status: 'CANCELLED',
      });

      await expect(
        service.update(USER_1, DEBT_1, {
          title: 'Modification impossible',
        }),
      ).rejects.toThrow(DomainError);
    });
  });
});
