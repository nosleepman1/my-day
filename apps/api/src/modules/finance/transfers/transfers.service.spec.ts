import { Prisma, type FinancialAccount, type TransactionCategory } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../../platform/audit/audit.service';
import { DomainError } from '../../../platform/errors/domain-error';
import type { AccountsRepository } from '../accounts/accounts.repository';
import type { CategoriesRepository } from '../categories/categories.repository';
import type { FinanceContext } from '../shared/finance-context';

import { TransferReferences } from './transfer-references';
import type { TransferWithDetails, TransfersRepository } from './transfers.repository';
import { TransfersService } from './transfers.service';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_FROM = '01927000-0000-7000-8000-000000000010';
const ACCOUNT_TO = '01927000-0000-7000-8000-000000000020';
const ACCOUNT_EUR = '01927000-0000-7000-8000-000000000021';
const TRANSFER_ID = '01927000-0000-7000-8000-000000000030';
const FEE_CAT_ID = '01927000-0000-7000-8000-000000000040';

describe('TransfersService', () => {
  let service: TransfersService;
  let mockRepo: {
    createTransfer: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
  };
  let mockAccountsRepo: {
    findById: ReturnType<typeof vi.fn>;
  };
  let mockCategoriesRepo: {
    findBySystemKey: ReturnType<typeof vi.fn>;
  };
  let mockCtx: {
    newId: ReturnType<typeof vi.fn>;
  };
  let mockAudit: {
    record: ReturnType<typeof vi.fn>;
  };

  const sampleFromAccount: FinancialAccount = {
    id: ACCOUNT_FROM,
    userId: USER_1,
    name: 'Compte Wave',
    type: 'MOBILE_MONEY',
    provider: 'Wave',
    currency: 'XOF',
    openingBalanceMinor: 100000n,
    openedOn: new Date('2026-01-01T00:00:00.000Z'),
    allowOverdraft: false,
    overdraftLimitMinor: 0n,
    includeInNetWorth: true,
    color: '#000000',
    icon: 'phone',
    sortOrder: 0,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleToAccount: FinancialAccount = {
    id: ACCOUNT_TO,
    userId: USER_1,
    name: 'Compte Espèces',
    type: 'CASH',
    provider: null,
    currency: 'XOF',
    openingBalanceMinor: 20000n,
    openedOn: new Date('2026-01-01T00:00:00.000Z'),
    allowOverdraft: false,
    overdraftLimitMinor: 0n,
    includeInNetWorth: true,
    color: '#000000',
    icon: 'cash',
    sortOrder: 1,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleEurAccount: FinancialAccount = {
    ...sampleToAccount,
    id: ACCOUNT_EUR,
    name: 'Compte EUR',
    currency: 'EUR',
  };

  const sampleFeeCategory: TransactionCategory = {
    id: FEE_CAT_ID,
    userId: USER_1,
    name: 'Frais mobile money et bancaires',
    kind: 'EXPENSE',
    defaultEconomicClass: 'EXPENSE_FEE',
    parentId: null,
    isSystem: true,
    systemKey: 'EXPENSE_FEE',
    color: null,
    icon: null,
    sortOrder: 280,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleTransferResult: TransferWithDetails = {
    id: TRANSFER_ID,
    userId: USER_1,
    type: 'TRANSFER',
    status: 'VALIDATED',
    economicClass: 'INTERNAL_TRANSFER',
    amountMinor: 50000n,
    currency: 'XOF',
    occurredAt: new Date('2026-02-01T10:00:00.000Z'),
    valueDate: new Date('2026-02-01T00:00:00.000Z'),
    description: 'Virement interne',
    notes: null,
    categoryId: null,
    counterpartyId: null,
    projectId: null,
    parentTransactionId: null,
    refundOfId: null,
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
        id: 'entry-debit',
        userId: USER_1,
        transactionId: TRANSFER_ID,
        accountId: ACCOUNT_FROM,
        direction: 'DEBIT',
        amountMinor: 50000n,
        currency: 'XOF',
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
      {
        id: 'entry-credit',
        userId: USER_1,
        transactionId: TRANSFER_ID,
        accountId: ACCOUNT_TO,
        direction: 'CREDIT',
        amountMinor: 50000n,
        currency: 'XOF',
        createdAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ],
    feeTransaction: null,
  };

  beforeEach(() => {
    mockRepo = {
      createTransfer: vi.fn().mockResolvedValue(sampleTransferResult),
      findById: vi.fn().mockResolvedValue(sampleTransferResult),
    };

    mockAccountsRepo = {
      findById: vi.fn().mockImplementation((_u, id) => {
        if (id === ACCOUNT_FROM) return sampleFromAccount;
        if (id === ACCOUNT_TO) return sampleToAccount;
        if (id === ACCOUNT_EUR) return sampleEurAccount;
        return null;
      }),
    };

    mockCategoriesRepo = {
      findBySystemKey: vi.fn().mockResolvedValue(sampleFeeCategory),
    };

    mockCtx = {
      newId: vi.fn().mockReturnValue(TRANSFER_ID),
    };

    mockAudit = {
      record: vi.fn().mockResolvedValue(undefined),
    };

    const references = new TransferReferences(
      mockAccountsRepo as unknown as AccountsRepository,
      mockCategoriesRepo as unknown as CategoriesRepository,
    );

    service = new TransfersService(
      mockRepo as unknown as TransfersRepository,
      references,
      mockCtx as unknown as FinanceContext,
      mockAudit as unknown as AuditService,
    );
  });

  it('creates same-currency transfer and records audit', async () => {
    const result = await service.create(USER_1, {
      fromAccountId: ACCOUNT_FROM,
      toAccountId: ACCOUNT_TO,
      fromAmountMinor: '50000',
      occurredAt: '2026-02-01T10:00:00.000Z',
      valueDate: '2026-02-01',
      description: 'Virement interne',
    });

    expect(result.id).toBe(TRANSFER_ID);
    expect(result.fromAccountId).toBe(ACCOUNT_FROM);
    expect(result.toAccountId).toBe(ACCOUNT_TO);
    expect(result.fromAmountMinor).toBe('50000');
    expect(result.toAmountMinor).toBe('50000');
    expect(mockRepo.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromAccountId: ACCOUNT_FROM,
        toAccountId: ACCOUNT_TO,
        fromAmountMinor: 50000n,
        toAmountMinor: 50000n,
      }),
    );
    expect(mockAudit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'finance.transfer.create',
        userId: USER_1,
        entityId: TRANSFER_ID,
      }),
    );
  });

  it('creates multi-currency transfer with exchange rate and computes toAmount', async () => {
    // 100 EUR = 65595.7 XOF -> rate 655.957 XOF per EUR
    const eurTransferResult: TransferWithDetails = {
      ...sampleTransferResult,
      amountMinor: 10000n, // 100.00 EUR
      currency: 'EUR',
      rate: new Prisma.Decimal('655.957'),
      rateDate: new Date('2026-02-01T00:00:00.000Z'),
      ledgerEntries: [
        {
          id: 'entry-debit',
          userId: USER_1,
          transactionId: TRANSFER_ID,
          accountId: ACCOUNT_EUR,
          direction: 'DEBIT',
          amountMinor: 10000n,
          currency: 'EUR',
          createdAt: new Date('2026-02-01T10:00:00.000Z'),
        },
        {
          id: 'entry-credit',
          userId: USER_1,
          transactionId: TRANSFER_ID,
          accountId: ACCOUNT_TO,
          direction: 'CREDIT',
          amountMinor: 65596n,
          currency: 'XOF',
          createdAt: new Date('2026-02-01T10:00:00.000Z'),
        },
      ],
    };
    mockRepo.createTransfer.mockResolvedValue(eurTransferResult);

    const result = await service.create(USER_1, {
      fromAccountId: ACCOUNT_EUR,
      toAccountId: ACCOUNT_TO,
      fromAmountMinor: '10000',
      exchangeRate: '655.957',
      rateDate: '2026-02-01',
      occurredAt: '2026-02-01T10:00:00.000Z',
      valueDate: '2026-02-01',
    });

    expect(result.fromCurrency).toBe('EUR');
    expect(result.toCurrency).toBe('XOF');
    expect(result.fromAmountMinor).toBe('10000');
    expect(result.toAmountMinor).toBe('65596');
    expect(mockRepo.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        fromCurrency: 'EUR',
        toCurrency: 'XOF',
        fromAmountMinor: 10000n,
        toAmountMinor: 65596n,
      }),
    );
  });

  it('rejects multi-currency transfer when exchangeRate is missing', async () => {
    await expect(
      service.create(USER_1, {
        fromAccountId: ACCOUNT_EUR,
        toAccountId: ACCOUNT_TO,
        fromAmountMinor: '10000',
        occurredAt: '2026-02-01T10:00:00.000Z',
        valueDate: '2026-02-01',
      }),
    ).rejects.toThrow(DomainError);
  });

  it('rejects transfer when source account is not found', async () => {
    await expect(
      service.create(USER_1, {
        fromAccountId: '01927000-0000-7000-8000-999999999999',
        toAccountId: ACCOUNT_TO,
        fromAmountMinor: '50000',
        occurredAt: '2026-02-01T10:00:00.000Z',
        valueDate: '2026-02-01',
      }),
    ).rejects.toThrow(DomainError);
  });

  it('returns transfer response when getById is called', async () => {
    const result = await service.getById(USER_1, TRANSFER_ID);
    expect(result.id).toBe(TRANSFER_ID);
    expect(result.fromAccountId).toBe(ACCOUNT_FROM);
    expect(result.toAccountId).toBe(ACCOUNT_TO);
  });

  it('throws NOT_FOUND when transfer is not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getById(USER_1, 'unknown-id')).rejects.toThrow(DomainError);
  });
});
