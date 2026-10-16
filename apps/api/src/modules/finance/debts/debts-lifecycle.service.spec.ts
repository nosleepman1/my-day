import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import type { FinanceContext } from '../shared/finance-context';

import type { DebtWithRelations, DebtsRepository } from './debts.repository';
import { DebtsService } from './debts.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const DEBT_PAYABLE = '01927000-0000-7000-8000-000000000010';
const DEBT_RECEIVABLE = '01927000-0000-7000-8000-000000000011';
const COUNTERPARTY_1 = '01927000-0000-7000-8000-000000000020';

describe('DebtsService - Lifecycle & Summary (Task 6)', () => {
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
    cancel: ReturnType<typeof vi.fn>;
    writeOff: ReturnType<typeof vi.fn>;
    findOpenDebtsForSummary: ReturnType<typeof vi.fn>;
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

  const samplePayableDebt: DebtWithRelations = {
    id: DEBT_PAYABLE,
    userId: USER_1,
    type: 'PAYABLE',
    counterpartyId: COUNTERPARTY_1,
    title: 'Emprunt matériel',
    description: null,
    principalMinor: 100_000n,
    currency: 'XOF',
    openedOn: new Date('2026-10-01T00:00:00.000Z'),
    dueDate: new Date('2026-10-10T00:00:00.000Z'), // Past due relative to 2026-10-15
    status: 'OPEN',
    cancelledAt: null,
    writtenOffAt: null,
    closingReason: null,
    notes: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    counterparty: { id: COUNTERPARTY_1, name: 'Moussa Diop', kind: 'PERSON' },
    repayments: [],
  };

  const sampleReceivableDebt: DebtWithRelations = {
    id: DEBT_RECEIVABLE,
    userId: USER_1,
    type: 'RECEIVABLE',
    counterpartyId: COUNTERPARTY_1,
    title: 'Prêt accordé',
    description: null,
    principalMinor: 50_000n,
    currency: 'XOF',
    openedOn: new Date('2026-10-01T00:00:00.000Z'),
    dueDate: new Date('2026-10-20T00:00:00.000Z'), // Future due date
    status: 'OPEN',
    cancelledAt: null,
    writtenOffAt: null,
    closingReason: null,
    notes: null,
    createdAt: new Date('2026-10-01T10:00:00.000Z'),
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    counterparty: { id: COUNTERPARTY_1, name: 'Moussa Diop', kind: 'PERSON' },
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
      cancel: vi.fn(),
      writeOff: vi.fn(),
      findOpenDebtsForSummary: vi.fn(),
    };
    mockCounterpartiesRepo = { findById: vi.fn() };
    mockCtx = {
      newId: vi.fn(() => '01927000-0000-7000-8000-000000000099'),
      now: vi.fn(() => new Date('2026-10-15T12:00:00.000Z')),
    };
    mockAudit = { record: vi.fn().mockResolvedValue(undefined) };

    service = new DebtsService(
      mockRepo as unknown as DebtsRepository,
      mockCounterpartiesRepo as unknown as CounterpartiesRepository,
      mockCtx as unknown as FinanceContext,
      mockAudit as unknown as AuditService,
    );
  });

  describe('cancelDebt', () => {
    it('cancels open debt with no repayments and records audit log', async () => {
      mockRepo.findById.mockResolvedValue(samplePayableDebt);
      const cancelledDebt: DebtWithRelations = {
        ...samplePayableDebt,
        status: 'CANCELLED',
        closingReason: 'Erreur de saisie',
        cancelledAt: new Date('2026-10-15T12:00:00.000Z'),
      };
      mockRepo.cancel.mockResolvedValue(cancelledDebt);

      const result = await service.cancel(USER_1, DEBT_PAYABLE, {
        closingReason: 'Erreur de saisie',
      });

      expect(result.status).toBe('CANCELLED');
      expect(result.closingReason).toBe('Erreur de saisie');
      expect(mockRepo.cancel).toHaveBeenCalledWith(
        USER_1,
        DEBT_PAYABLE,
        'Erreur de saisie',
        expect.any(Date),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.cancel',
          userId: USER_1,
          entityId: DEBT_PAYABLE,
        }),
      );
    });

    it('refuses cancellation when debt has validated repayments', async () => {
      mockRepo.findById.mockResolvedValue({
        ...samplePayableDebt,
        repayments: [
          {
            amountMinor: 20_000n,
            transaction: { status: 'VALIDATED' },
          },
        ],
      });

      await expect(service.cancel(USER_1, DEBT_PAYABLE, { closingReason: 'Erreur' })).rejects.toThrow(
        DomainError,
      );
    });

    it('refuses cancellation when debt is already closed', async () => {
      mockRepo.findById.mockResolvedValue({
        ...samplePayableDebt,
        status: 'CANCELLED',
      });

      await expect(service.cancel(USER_1, DEBT_PAYABLE, { closingReason: 'Erreur' })).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe('writeOffDebt', () => {
    it('writes off open receivable debt and records audit log', async () => {
      mockRepo.findById.mockResolvedValue(sampleReceivableDebt);
      const writtenOffDebt: DebtWithRelations = {
        ...sampleReceivableDebt,
        status: 'WRITTEN_OFF',
        closingReason: 'Créance irrécouvrable',
        writtenOffAt: new Date('2026-10-15T12:00:00.000Z'),
      };
      mockRepo.writeOff.mockResolvedValue(writtenOffDebt);

      const result = await service.writeOff(USER_1, DEBT_RECEIVABLE, {
        closingReason: 'Créance irrécouvrable',
      });

      expect(result.status).toBe('WRITTEN_OFF');
      expect(result.closingReason).toBe('Créance irrécouvrable');
      expect(mockRepo.writeOff).toHaveBeenCalledWith(
        USER_1,
        DEBT_RECEIVABLE,
        'Créance irrécouvrable',
        expect.any(Date),
      );
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.debt.write_off',
          userId: USER_1,
          entityId: DEBT_RECEIVABLE,
        }),
      );
    });

    it('refuses write-off on payable debt (only receivable can be written off)', async () => {
      mockRepo.findById.mockResolvedValue(samplePayableDebt);

      await expect(service.writeOff(USER_1, DEBT_PAYABLE, { closingReason: 'Défaut' })).rejects.toThrow(
        DomainError,
      );
    });
  });

  describe('getSummary', () => {
    it('calculates totals and overdue amounts grouped by currency', async () => {
      mockRepo.findOpenDebtsForSummary.mockResolvedValue([
        samplePayableDebt, // 100 000 XOF, overdue (< 2026-10-15)
        sampleReceivableDebt, // 50 000 XOF, not overdue (2026-10-20)
      ]);

      const summary = await service.getSummary(USER_1);

      expect(summary.currencies).toHaveLength(1);
      const xof = summary.currencies[0];
      expect(xof).toEqual({
        currency: 'XOF',
        totalPayableMinor: '100000',
        totalReceivableMinor: '50000',
        remainingPayableMinor: '100000',
        remainingReceivableMinor: '50000',
        overduePayableMinor: '100000',
        overdueReceivableMinor: '0',
      });
    });
  });
});
