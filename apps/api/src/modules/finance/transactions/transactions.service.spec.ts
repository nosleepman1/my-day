import type { TransactionCategory } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { CounterpartiesRepository } from '../counterparties/counterparties.repository';
import type { FinanceContext } from '../shared/finance-context';

import { TransactionReferences } from './transaction-references';
import type { TransactionsRepository, TransactionWithEntries } from './transactions.repository';
import { TransactionsService } from './transactions.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000010';
const CAT_INCOME = '01927000-0000-7000-8000-000000000020';
const CAT_EXPENSE = '01927000-0000-7000-8000-000000000021';
const COUNTERPARTY_1 = '01927000-0000-7000-8000-000000000030';
const TX_1 = '01927000-0000-7000-8000-000000000040';
const ENTRY_1 = '01927000-0000-7000-8000-000000000050';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let mockRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateDetails: ReturnType<typeof vi.fn>;
    validate: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let mockCategoriesRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let mockCounterpartiesRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let mockCtx: {
    newId: ReturnType<typeof vi.fn>;
  };
  let mockAudit: {
    record: ReturnType<typeof vi.fn>;
  };

  const sampleIncomeCategory: TransactionCategory = {
    id: CAT_INCOME,
    userId: USER_1,
    name: 'Ventes',
    kind: 'INCOME',
    defaultEconomicClass: 'INCOME_OPERATING',
    parentId: null,
    isSystem: false,
    systemKey: null,
    color: null,
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleExpenseCategory: TransactionCategory = {
    id: CAT_EXPENSE,
    userId: USER_1,
    name: 'Fournitures',
    kind: 'EXPENSE',
    defaultEconomicClass: 'EXPENSE_OPERATING',
    parentId: null,
    isSystem: false,
    systemKey: null,
    color: null,
    icon: null,
    sortOrder: 0,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleTxRecord: TransactionWithEntries = {
    id: TX_1,
    userId: USER_1,
    type: 'INCOME',
    status: 'VALIDATED',
    economicClass: 'INCOME_OPERATING',
    amountMinor: 50000n,
    currency: 'XOF',
    occurredAt: new Date('2026-02-01T10:00:00.000Z'),
    valueDate: new Date('2026-02-01T00:00:00.000Z'),
    description: 'Vente prestation',
    notes: null,
    categoryId: CAT_INCOME,
    counterpartyId: COUNTERPARTY_1,
    projectId: null,
    parentTransactionId: null,
    refundOfId: null,
    debtId: null,
    rate: null,
    rateDate: null,
    rateSource: null,
    source: 'MANUAL',
    idempotencyKey: null,
    externalReference: null,
    validatedAt: new Date('2026-02-01T10:00:00.000Z'),
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    updatedAt: new Date('2026-02-01T10:00:00.000Z'),
    ledgerEntries: [
      {
        id: ENTRY_1,
        userId: USER_1,
        transactionId: TX_1,
        accountId: ACCOUNT_1,
        direction: 'CREDIT',
        amountMinor: 50000n,
        currency: 'XOF',
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ],
  };

  beforeEach(() => {
    mockRepo = {
      create: vi.fn().mockResolvedValue(sampleTxRecord),
      findById: vi.fn().mockResolvedValue(sampleTxRecord),
      list: vi.fn().mockResolvedValue({ rows: [sampleTxRecord], hasMore: false, nextCursor: null }),
      updateDetails: vi.fn().mockResolvedValue(sampleTxRecord),
      validate: vi.fn().mockResolvedValue(sampleTxRecord),
      cancel: vi.fn().mockResolvedValue({
        ...sampleTxRecord,
        status: 'CANCELLED',
        cancelReason: 'Motif',
      }),
    };

    mockCategoriesRepo = {
      findById: vi.fn().mockImplementation((_u, id) => {
        if (id === CAT_INCOME) return sampleIncomeCategory;
        if (id === CAT_EXPENSE) return sampleExpenseCategory;
        return null;
      }),
    };

    mockCounterpartiesRepo = {
      findById: vi.fn().mockImplementation((_u, id) => {
        if (id === COUNTERPARTY_1) return { id: COUNTERPARTY_1, name: 'Client A' };
        return null;
      }),
    };

    let idCounter = 1;
    mockCtx = {
      newId: vi.fn().mockImplementation(() => `01927000-0000-7000-8000-0000000000${idCounter++}`),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    const references = new TransactionReferences(
      mockCategoriesRepo as unknown as CategoriesRepository,
      mockCounterpartiesRepo as unknown as CounterpartiesRepository,
    );

    service = new TransactionsService(
      mockRepo as unknown as TransactionsRepository,
      references,
      mockCtx as unknown as FinanceContext,
      mockAudit as unknown as AuditService,
    );
  });

  describe('create', () => {
    it('creates an INCOME transaction with category and counterparty', async () => {
      const response = await service.create(USER_1, {
        type: 'INCOME',
        status: 'VALIDATED',
        accountId: ACCOUNT_1,
        amountMinor: '50000',
        currency: 'XOF',
        occurredAt: '2026-02-01T10:00:00.000Z',
        valueDate: '2026-02-01',
        categoryId: CAT_INCOME,
        counterpartyId: COUNTERPARTY_1,
        description: 'Vente prestation',
      });

      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.transaction.create',
          userId: USER_1,
        }),
      );
      expect(response.id).toBe(TX_1);
      expect(response.amountMinor).toBe('50000');
      expect(response.currency).toBe('XOF');
    });

    it('creates an ADJUSTMENT transaction and audits finance.adjustment.create', async () => {
      const adjTxRecord: TransactionWithEntries = {
        ...sampleTxRecord,
        type: 'ADJUSTMENT',
        economicClass: 'BALANCE_ADJUSTMENT',
      };
      mockRepo.create.mockResolvedValue(adjTxRecord);

      await service.create(USER_1, {
        type: 'ADJUSTMENT',
        status: 'VALIDATED',
        accountId: ACCOUNT_1,
        amountMinor: '1000',
        currency: 'XOF',
        occurredAt: '2026-02-01T10:00:00.000Z',
        valueDate: '2026-02-01',
        adjustmentDirection: 'CREDIT',
        description: 'Correction inventaire caisse',
      });

      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.adjustment.create',
          userId: USER_1,
        }),
      );
    });

    it('rejects ADJUSTMENT without description with BUSINESS_RULE_VIOLATION', async () => {
      await expect(
        service.create(USER_1, {
          type: 'ADJUSTMENT',
          status: 'VALIDATED',
          accountId: ACCOUNT_1,
          amountMinor: '1000',
          currency: 'XOF',
          occurredAt: '2026-02-01T10:00:00.000Z',
          valueDate: '2026-02-01',
          adjustmentDirection: 'CREDIT',
          description: '',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects INCOME with EXPENSE category with BUSINESS_RULE_VIOLATION', async () => {
      await expect(
        service.create(USER_1, {
          type: 'INCOME',
          status: 'VALIDATED',
          accountId: ACCOUNT_1,
          amountMinor: '1000',
          currency: 'XOF',
          occurredAt: '2026-02-01T10:00:00.000Z',
          valueDate: '2026-02-01',
          categoryId: CAT_EXPENSE,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects non-existent category with NOT_FOUND', async () => {
      await expect(
        service.create(USER_1, {
          type: 'INCOME',
          status: 'VALIDATED',
          accountId: ACCOUNT_1,
          amountMinor: '1000',
          currency: 'XOF',
          occurredAt: '2026-02-01T10:00:00.000Z',
          valueDate: '2026-02-01',
          categoryId: '01927000-0000-7000-8000-000000000099',
        }),
      ).rejects.toThrow(DomainError);
    });

    it('rejects non-existent counterparty with NOT_FOUND', async () => {
      await expect(
        service.create(USER_1, {
          type: 'INCOME',
          status: 'VALIDATED',
          accountId: ACCOUNT_1,
          amountMinor: '1000',
          currency: 'XOF',
          occurredAt: '2026-02-01T10:00:00.000Z',
          valueDate: '2026-02-01',
          counterpartyId: '01927000-0000-7000-8000-000000000099',
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('getById', () => {
    it('returns transaction response when found', async () => {
      const result = await service.getById(USER_1, TX_1);
      expect(result.id).toBe(TX_1);
      expect(result.ledgerEntries).toHaveLength(1);
    });

    it('throws NOT_FOUND when transaction does not exist', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.getById(USER_1, 'non-existent')).rejects.toThrow(DomainError);
    });
  });

  describe('list', () => {
    it('returns list of transaction responses', async () => {
      const result = await service.list(USER_1, { limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });
  });

  describe('updateDetails', () => {
    it('updates transaction non-financial metadata', async () => {
      const updatedRecord: TransactionWithEntries = {
        ...sampleTxRecord,
        description: 'Nouveau libellé',
      };
      mockRepo.updateDetails.mockResolvedValue(updatedRecord);

      const result = await service.updateDetails(USER_1, TX_1, {
        description: 'Nouveau libellé',
      });

      expect(result.description).toBe('Nouveau libellé');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.transaction.update',
          userId: USER_1,
        }),
      );
    });
  });

  describe('validate', () => {
    it('validates a pending transaction and records audit', async () => {
      const result = await service.validate(USER_1, TX_1);
      expect(result.status).toBe('VALIDATED');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.transaction.validate',
          userId: USER_1,
        }),
      );
    });
  });

  describe('cancel', () => {
    it('cancels a transaction, validates input and records audit', async () => {
      const cancelledRecord: TransactionWithEntries = {
        ...sampleTxRecord,
        status: 'CANCELLED',
        cancelReason: 'Erreur de montant',
        cancelledAt: new Date('2026-02-05T00:00:00.000Z'),
      };
      mockRepo.cancel.mockResolvedValue(cancelledRecord);

      const result = await service.cancel(USER_1, TX_1, {
        reason: 'Erreur de montant',
      });

      expect(result.status).toBe('CANCELLED');
      expect(result.cancelReason).toBe('Erreur de montant');
      expect(mockRepo.cancel).toHaveBeenCalledWith(USER_1, TX_1, 'Erreur de montant');
      expect(mockAudit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'finance.transaction.cancel',
          userId: USER_1,
          entityType: 'Transaction',
          entityId: TX_1,
          outcome: 'SUCCESS',
        }),
      );
    });
  });
});
