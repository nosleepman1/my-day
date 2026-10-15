import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { FinanceContext } from '../shared/finance-context';
import type { TransactionsService } from '../transactions/transactions.service';

import { ReconciliationService } from './reconciliation.service';

const USER_ID = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_ID = '01927000-0000-7000-8000-000000000002';
const TX_ID = '01927000-0000-7000-8000-000000000003';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let mockCtx: {
    userId: () => string;
    now: () => Date;
    newId: () => string;
  };
  let mockAccountsRepo: {
    findById: ReturnType<typeof vi.fn>;
    getClearedBalance: ReturnType<typeof vi.fn>;
  };
  let mockTransactionsService: {
    create: ReturnType<typeof vi.fn>;
  };
  let mockAudit: {
    record: ReturnType<typeof vi.fn>;
  };

  const sampleAccount = {
    id: ACCOUNT_ID,
    userId: USER_ID,
    name: 'Compte Wave',
    type: 'MOBILE_MONEY' as const,
    currency: 'XOF',
    openingBalanceMinor: 100_000n,
    openedOn: new Date('2026-01-01'),
    allowOverdraft: false,
    overdraftLimitMinor: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
  };

  const sampleTxResponse = {
    id: TX_ID,
    type: 'ADJUSTMENT' as const,
    status: 'VALIDATED' as const,
    economicClass: 'BALANCE_ADJUSTMENT' as const,
    amountMinor: '5000',
    currency: 'XOF' as const,
    occurredAt: '2026-10-15T12:00:00.000Z',
    valueDate: '2026-10-15',
    source: 'MANUAL' as const,
    description: 'Correction de caisse',
    notes: null,
    categoryId: null,
    counterpartyId: null,
    transferId: null,
    cancelReason: null,
    cancelledAt: null,
    ledgerEntries: [],
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
  };

  beforeEach(() => {
    mockCtx = {
      userId: () => USER_ID,
      now: () => new Date('2026-10-15T12:00:00.000Z'),
      newId: () => TX_ID,
    };

    mockAccountsRepo = {
      findById: vi.fn().mockResolvedValue(sampleAccount),
      getClearedBalance: vi.fn().mockResolvedValue({
        clearedBalanceMinor: 100_000n,
        unreconciledCount: 0,
      }),
    };

    mockTransactionsService = {
      create: vi.fn().mockResolvedValue(sampleTxResponse),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    service = new ReconciliationService(
      mockCtx as unknown as FinanceContext,
      mockAccountsRepo as unknown as AccountsRepository,
      mockTransactionsService as unknown as TransactionsService,
      mockAudit as unknown as AuditService,
    );
  });

  describe('adjust', () => {
    it('creates a validated adjustment transaction', async () => {
      const result = await service.adjust(ACCOUNT_ID, {
        amountMinor: '5000',
        direction: 'CREDIT',
        reason: 'Correction de caisse',
      });

      expect(result.id).toBe(TX_ID);
      expect(mockTransactionsService.create).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          type: 'ADJUSTMENT',
          status: 'VALIDATED',
          accountId: ACCOUNT_ID,
          amountMinor: '5000',
          currency: 'XOF',
          description: 'Correction de caisse',
          adjustmentDirection: 'CREDIT',
        }),
      );
    });

    it('rejects if account is not found', async () => {
      mockAccountsRepo.findById.mockResolvedValueOnce(null);

      await expect(
        service.adjust(ACCOUNT_ID, {
          amountMinor: '5000',
          direction: 'CREDIT',
          reason: 'Test',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects if account is archived', async () => {
      mockAccountsRepo.findById.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-02-01'),
      });

      await expect(
        service.adjust(ACCOUNT_ID, {
          amountMinor: '5000',
          direction: 'CREDIT',
          reason: 'Test',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects zero adjustment amount', async () => {
      await expect(
        service.adjust(ACCOUNT_ID, {
          amountMinor: '0',
          direction: 'CREDIT',
          reason: 'Test',
        }),
      ).rejects.toThrow();
    });

    it('rejects empty reason', async () => {
      await expect(
        service.adjust(ACCOUNT_ID, {
          amountMinor: '5000',
          direction: 'CREDIT',
          reason: '   ',
        }),
      ).rejects.toThrow();
    });
  });

  describe('previewReconciliation', () => {
    it('calculates balanced status when balances match', async () => {
      const res = await service.previewReconciliation(ACCOUNT_ID, {
        statementDate: '2026-10-15',
        statementEndingBalanceMinor: '100000',
      });

      expect(res.isBalanced).toBe(true);
      expect(res.differenceMinor).toBe('0');
      expect(res.clearedBalanceMinor).toBe('100000');
    });

    it('calculates difference when statement is higher', async () => {
      const res = await service.previewReconciliation(ACCOUNT_ID, {
        statementDate: '2026-10-15',
        statementEndingBalanceMinor: '115000',
      });

      expect(res.isBalanced).toBe(false);
      expect(res.differenceMinor).toBe('15000');
    });

    it('calculates difference when statement is lower', async () => {
      const res = await service.previewReconciliation(ACCOUNT_ID, {
        statementDate: '2026-10-15',
        statementEndingBalanceMinor: '95000',
      });

      expect(res.isBalanced).toBe(false);
      expect(res.differenceMinor).toBe('-5000');
    });

    it('rejects if account not found', async () => {
      mockAccountsRepo.findById.mockResolvedValueOnce(null);

      await expect(
        service.previewReconciliation(ACCOUNT_ID, {
          statementDate: '2026-10-15',
          statementEndingBalanceMinor: '100000',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('confirmReconciliation', () => {
    it('confirms balanced reconciliation without adjustment and logs audit', async () => {
      const res = await service.confirmReconciliation(ACCOUNT_ID, {
        statementDate: '2026-10-15',
        statementEndingBalanceMinor: '100000',
        createAdjustmentIfNeeded: true,
      });

      expect(res.isBalanced).toBe(true);
      expect(res.differenceMinor).toBe('0');
      expect(res.adjustmentTransaction).toBeNull();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.reconciliation.confirm',
          userId: USER_ID,
          entityId: ACCOUNT_ID,
        }),
      );
      expect(mockTransactionsService.create).not.toHaveBeenCalled();
    });

    it('confirms unbalanced reconciliation without adjustment if not requested', async () => {
      const res = await service.confirmReconciliation(ACCOUNT_ID, {
        statementDate: '2026-10-15',
        statementEndingBalanceMinor: '105000',
        createAdjustmentIfNeeded: false,
      });

      expect(res.isBalanced).toBe(false);
      expect(res.differenceMinor).toBe('5000');
      expect(res.adjustmentTransaction).toBeNull();
      expect(mockTransactionsService.create).not.toHaveBeenCalled();
    });

    it('creates adjustment and reconciles when createAdjustmentIfNeeded is true', async () => {
      const res = await service.confirmReconciliation(ACCOUNT_ID, {
        statementDate: '2026-10-15',
        statementEndingBalanceMinor: '105000',
        createAdjustmentIfNeeded: true,
        adjustmentReason: 'Régularisation relevé',
      });

      expect(res.isBalanced).toBe(true);
      expect(res.differenceMinor).toBe('0');
      expect(res.clearedBalanceMinor).toBe('105000');
      expect(res.adjustmentTransaction).not.toBeNull();
      expect(mockTransactionsService.create).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          type: 'ADJUSTMENT',
          amountMinor: '5000',
          adjustmentDirection: 'CREDIT',
          description: 'Régularisation relevé',
        }),
      );
    });
  });
});
