import type { FinancialAccount } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountLockingQueries } from '../../../platform/database/raw/account-locking.queries';
import { DomainError } from '../../../platform/errors/domain-error';
import type { FinanceContext } from '../shared/finance-context';

import type { DebtWithRelations } from './debts.repository';
import { DebtsRepository } from './debts.repository';

const USER_1 = '01927000-0000-7000-8000-000000000001';
const DEBT_1 = '01927000-0000-7000-8000-000000000010';
const CP_1 = '01927000-0000-7000-8000-000000000020';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000030';
const TX_1 = '01927000-0000-7000-8000-000000000040';
const ENTRY_1 = '01927000-0000-7000-8000-000000000050';
const REPAYMENT_1 = '01927000-0000-7000-8000-000000000060';

describe('DebtsRepository', () => {
  let repository: DebtsRepository;
  let mockAccountLocking: {
    lockAccounts: ReturnType<typeof vi.fn>;
  };
  let mockTx: {
    debt: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    debtRepayment: {
      create: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    financialAccount: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
    ledgerEntry: {
      findMany: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
    transaction: {
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
    recurringOccurrence: {
      findFirst: ReturnType<typeof vi.fn>;
    };
  };
  let mockCtx: {
    db: {
      $transaction: ReturnType<typeof vi.fn>;
      debt: typeof mockTx.debt;
      debtRepayment: typeof mockTx.debtRepayment;
      financialAccount: typeof mockTx.financialAccount;
      ledgerEntry: typeof mockTx.ledgerEntry;
      transaction: typeof mockTx.transaction;
      recurringOccurrence: typeof mockTx.recurringOccurrence;
    };
  };

  const sampleAccount: FinancialAccount = {
    id: ACCOUNT_1,
    userId: USER_1,
    name: 'Compte Principal',
    type: 'BANK',
    provider: 'Bank',
    currency: 'XOF',
    openingBalanceMinor: 500_000n,
    openedOn: new Date('2026-01-01T00:00:00.000Z'),
    allowOverdraft: false,
    overdraftLimitMinor: 0n,
    includeInNetWorth: true,
    color: '#000000',
    icon: 'bank',
    sortOrder: 0,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  const sampleDebt: DebtWithRelations = {
    id: DEBT_1,
    userId: USER_1,
    type: 'PAYABLE',
    counterpartyId: CP_1,
    title: 'Emprunt Bancaire',
    description: 'Prêt professionnel',
    principalMinor: 200_000n,
    currency: 'XOF',
    openedOn: new Date('2026-02-01T00:00:00.000Z'),
    dueDate: new Date('2026-12-31T00:00:00.000Z'),
    status: 'OPEN',
    closingReason: null,
    cancelledAt: null,
    writtenOffAt: null,
    notes: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    counterparty: { id: CP_1, name: 'SGBS', kind: 'ORGANIZATION' },
    repayments: [],
  };

  beforeEach(() => {
    mockAccountLocking = {
      lockAccounts: vi.fn().mockResolvedValue(undefined),
    };

    mockTx = {
      debt: {
        create: vi.fn().mockResolvedValue(sampleDebt),
        findFirst: vi.fn().mockResolvedValue(sampleDebt),
        findMany: vi.fn().mockResolvedValue([sampleDebt]),
        update: vi.fn().mockResolvedValue(sampleDebt),
      },
      debtRepayment: {
        create: vi.fn().mockResolvedValue({
          id: REPAYMENT_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
          currency: 'XOF',
          notes: null,
          createdAt: new Date('2026-02-01T10:00:00.000Z'),
          transaction: {
            id: TX_1,
            occurredAt: new Date('2026-02-01T10:00:00.000Z'),
            valueDate: new Date('2026-02-01T10:00:00.000Z'),
            status: 'VALIDATED',
            amountMinor: 50_000n,
            currency: 'XOF',
          },
        }),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        delete: vi.fn().mockResolvedValue({ id: REPAYMENT_1 }),
      },
      financialAccount: {
        findFirst: vi.fn().mockResolvedValue(sampleAccount),
        findMany: vi.fn().mockResolvedValue([sampleAccount]),
      },
      ledgerEntry: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: ENTRY_1 }),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: TX_1 }),
        update: vi.fn().mockResolvedValue({ id: TX_1, status: 'VALIDATED' }),
        findFirst: vi.fn().mockResolvedValue({
          id: TX_1,
          userId: USER_1,
          status: 'VALIDATED',
          currency: 'XOF',
          amountMinor: 50_000n,
        }),
      },
      recurringOccurrence: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    mockCtx = {
      db: {
        $transaction: vi.fn().mockImplementation((cb: (tx: unknown) => unknown) => cb(mockTx)),
        ...mockTx,
      },
    };

    repository = new DebtsRepository(
      mockCtx as unknown as FinanceContext,
      mockAccountLocking as unknown as AccountLockingQueries,
    );
  });

  describe('create', () => {
    it('creates debt without initial movement', async () => {
      const result = await repository.create({
        id: DEBT_1,
        userId: USER_1,
        type: 'PAYABLE',
        counterpartyId: CP_1,
        title: 'Emprunt',
        principalMinor: 200_000n,
        currency: 'XOF',
        openedOn: new Date('2026-02-01'),
      });

      expect(result).toEqual(sampleDebt);
      expect(mockTx.debt.create).toHaveBeenCalled();
      expect(mockAccountLocking.lockAccounts).not.toHaveBeenCalled();
    });

    it('creates debt with initial movement for PAYABLE', async () => {
      await repository.create({
        id: DEBT_1,
        userId: USER_1,
        type: 'PAYABLE',
        counterpartyId: CP_1,
        title: 'Emprunt',
        principalMinor: 200_000n,
        currency: 'XOF',
        openedOn: new Date('2026-02-01'),
        initialMovement: {
          accountId: ACCOUNT_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          occurredAt: new Date('2026-02-01'),
        },
      });

      expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_1]);
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'BORROWING',
            economicClass: 'DEBT_DRAWDOWN',
          }),
        }),
      );
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'CREDIT',
            amountMinor: 200_000n,
          }),
        }),
      );
      expect(mockTx.transaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'VALIDATED' }),
        }),
      );
    });

    it('creates debt with initial movement for RECEIVABLE with overdraft verification', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        openingBalanceMinor: 300_000n,
      });

      await repository.create({
        id: DEBT_1,
        userId: USER_1,
        type: 'RECEIVABLE',
        counterpartyId: CP_1,
        title: 'Prêt',
        principalMinor: 100_000n,
        currency: 'XOF',
        openedOn: new Date('2026-02-01'),
        initialMovement: {
          accountId: ACCOUNT_1,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          occurredAt: new Date('2026-02-01'),
        },
      });

      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'LOAN',
            economicClass: 'LOAN_DISBURSEMENT',
          }),
        }),
      );
      expect(mockTx.ledgerEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'DEBIT',
            amountMinor: 100_000n,
          }),
        }),
      );
    });

    it('throws NOT_FOUND if account does not exist during initial movement', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.create({
          id: DEBT_1,
          userId: USER_1,
          type: 'PAYABLE',
          counterpartyId: CP_1,
          title: 'Emprunt',
          principalMinor: 200_000n,
          currency: 'XOF',
          openedOn: new Date('2026-02-01'),
          initialMovement: {
            accountId: ACCOUNT_1,
            transactionId: TX_1,
            ledgerEntryId: ENTRY_1,
            occurredAt: new Date('2026-02-01'),
          },
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws BUSINESS_RULE_VIOLATION if account is archived', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        archivedAt: new Date('2026-02-01T10:00:00.000Z'),
      });

      await expect(
        repository.create({
          id: DEBT_1,
          userId: USER_1,
          type: 'PAYABLE',
          counterpartyId: CP_1,
          title: 'Emprunt',
          principalMinor: 200_000n,
          currency: 'XOF',
          openedOn: new Date('2026-02-01'),
          initialMovement: {
            accountId: ACCOUNT_1,
            transactionId: TX_1,
            ledgerEntryId: ENTRY_1,
            occurredAt: new Date('2026-02-01'),
          },
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws CURRENCY_MISMATCH if currency does not match account', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        currency: 'EUR',
      });

      await expect(
        repository.create({
          id: DEBT_1,
          userId: USER_1,
          type: 'PAYABLE',
          counterpartyId: CP_1,
          title: 'Emprunt',
          principalMinor: 200_000n,
          currency: 'XOF',
          openedOn: new Date('2026-02-01'),
          initialMovement: {
            accountId: ACCOUNT_1,
            transactionId: TX_1,
            ledgerEntryId: ENTRY_1,
            occurredAt: new Date('2026-02-01'),
          },
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws BUSINESS_RULE_VIOLATION if valueDate is before account openedOn', async () => {
      await expect(
        repository.create({
          id: DEBT_1,
          userId: USER_1,
          type: 'PAYABLE',
          counterpartyId: CP_1,
          title: 'Emprunt',
          principalMinor: 200_000n,
          currency: 'XOF',
          openedOn: new Date('2025-01-01'),
          initialMovement: {
            accountId: ACCOUNT_1,
            transactionId: TX_1,
            ledgerEntryId: ENTRY_1,
            occurredAt: new Date('2025-01-01'),
            valueDate: new Date('2025-01-01'),
          },
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws INSUFFICIENT_FUNDS if RECEIVABLE exceeds available funds', async () => {
      mockTx.financialAccount.findFirst.mockResolvedValueOnce({
        ...sampleAccount,
        openingBalanceMinor: 10_000n,
        allowOverdraft: false,
      });

      await expect(
        repository.create({
          id: DEBT_1,
          userId: USER_1,
          type: 'RECEIVABLE',
          counterpartyId: CP_1,
          title: 'Prêt',
          principalMinor: 100_000n,
          currency: 'XOF',
          openedOn: new Date('2026-02-01'),
          initialMovement: {
            accountId: ACCOUNT_1,
            transactionId: TX_1,
            ledgerEntryId: ENTRY_1,
            occurredAt: new Date('2026-02-01'),
          },
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws NOT_FOUND if created debt cannot be re-queried', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.create({
          id: DEBT_1,
          userId: USER_1,
          type: 'PAYABLE',
          counterpartyId: CP_1,
          title: 'Emprunt',
          principalMinor: 200_000n,
          currency: 'XOF',
          openedOn: new Date('2026-02-01'),
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('findById and list', () => {
    it('finds debt by id', async () => {
      const res = await repository.findById(USER_1, DEBT_1);
      expect(res).toEqual(sampleDebt);
      expect(mockCtx.db.debt.findFirst).toHaveBeenCalledWith({
        where: { userId: USER_1, id: DEBT_1 },
        include: expect.any(Object),
      });
    });

    it('lists debts with filters and pagination', async () => {
      const res = await repository.list(USER_1, {
        limit: 10,
        type: 'PAYABLE',
        status: 'OPEN',
        counterpartyId: CP_1,
        from: '2026-01-01',
        to: '2026-12-31',
        overdue: true,
        todayCivil: '2026-06-01',
        cursor: 'prev_id',
      });

      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBeUndefined();
    });

    it('returns nextCursor when items exceed limit', async () => {
      mockTx.debt.findMany.mockResolvedValueOnce([sampleDebt, { ...sampleDebt, id: 'next_id' }]);

      const res = await repository.list(USER_1, { limit: 1 });
      expect(res.items).toHaveLength(1);
      expect(res.nextCursor).toBe(sampleDebt.id);
    });
  });

  describe('update', () => {
    it('updates allowed debt fields', async () => {
      await repository.update(USER_1, DEBT_1, {
        title: 'Nouveau titre',
        description: 'Nouvelle description',
        dueDate: new Date('2026-11-30'),
        notes: 'Notes à jour',
      });

      expect(mockCtx.db.debt.update).toHaveBeenCalledWith({
        where: { userId_id: { userId: USER_1, id: DEBT_1 } },
        data: expect.objectContaining({
          title: 'Nouveau titre',
          description: 'Nouvelle description',
          notes: 'Notes à jour',
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('createRepaymentWithTransaction', () => {
    it('creates repayment with transaction for PAYABLE debt', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);

      await repository.createRepaymentWithTransaction({
        id: REPAYMENT_1,
        userId: USER_1,
        debtId: DEBT_1,
        accountId: ACCOUNT_1,
        amountMinor: 50_000n,
        transactionId: TX_1,
        ledgerEntryId: ENTRY_1,
        occurredAt: new Date('2026-03-01'),
        date: '2026-03-01',
        notes: 'Acompte 1',
      });

      expect(mockAccountLocking.lockAccounts).toHaveBeenCalledWith(mockTx, USER_1, [ACCOUNT_1]);
      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'EXPENSE',
            economicClass: 'DEBT_REPAYMENT',
          }),
        }),
      );
      expect(mockTx.debtRepayment.create).toHaveBeenCalled();
    });

    it('creates repayment with transaction for RECEIVABLE debt', async () => {
      const receivableDebt: DebtWithRelations = {
        ...sampleDebt,
        type: 'RECEIVABLE',
      };
      mockTx.debt.findFirst.mockResolvedValueOnce(receivableDebt);

      await repository.createRepaymentWithTransaction({
        id: REPAYMENT_1,
        userId: USER_1,
        debtId: DEBT_1,
        accountId: ACCOUNT_1,
        amountMinor: 50_000n,
        transactionId: TX_1,
        ledgerEntryId: ENTRY_1,
        occurredAt: new Date('2026-03-01'),
      });

      expect(mockTx.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'INCOME',
            economicClass: 'LOAN_COLLECTION',
          }),
        }),
      );
    });

    it('throws NOT_FOUND if debt does not exist', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.createRepaymentWithTransaction({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          accountId: ACCOUNT_1,
          amountMinor: 50_000n,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          occurredAt: new Date('2026-03-01'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws INVALID_STATE_TRANSITION if debt is closed', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce({
        ...sampleDebt,
        status: 'PAID',
      });

      await expect(
        repository.createRepaymentWithTransaction({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          accountId: ACCOUNT_1,
          amountMinor: 50_000n,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          occurredAt: new Date('2026-03-01'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws OVERPAYMENT if repayment exceeds remaining', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce({
        ...sampleDebt,
        principalMinor: 100_000n,
      });

      await expect(
        repository.createRepaymentWithTransaction({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          accountId: ACCOUNT_1,
          amountMinor: 150_000n,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          occurredAt: new Date('2026-03-01'),
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws NOT_FOUND if payment account does not exist', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.financialAccount.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.createRepaymentWithTransaction({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          accountId: ACCOUNT_1,
          amountMinor: 50_000n,
          transactionId: TX_1,
          ledgerEntryId: ENTRY_1,
          occurredAt: new Date('2026-03-01'),
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('attachRepayment', () => {
    it('attaches an existing transaction to debt repayment', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);

      await repository.attachRepayment({
        id: REPAYMENT_1,
        userId: USER_1,
        debtId: DEBT_1,
        transactionId: TX_1,
        amountMinor: 50_000n,
      });

      expect(mockTx.debtRepayment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            debtId: DEBT_1,
            transactionId: TX_1,
            amountMinor: 50_000n,
          }),
        }),
      );
    });

    it('throws NOT_FOUND if existing transaction is missing', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.transaction.findFirst.mockResolvedValueOnce(null);

      await expect(
        repository.attachRepayment({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws BUSINESS_RULE_VIOLATION if transaction is not VALIDATED', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.transaction.findFirst.mockResolvedValueOnce({
        id: TX_1,
        userId: USER_1,
        status: 'PENDING',
        currency: 'XOF',
        amountMinor: 50_000n,
      });

      await expect(
        repository.attachRepayment({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws CURRENCY_MISMATCH if transaction currency differs', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.transaction.findFirst.mockResolvedValueOnce({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        currency: 'EUR',
        amountMinor: 50_000n,
      });

      await expect(
        repository.attachRepayment({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws BUSINESS_RULE_VIOLATION if amount exceeds transaction amount', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.transaction.findFirst.mockResolvedValueOnce({
        id: TX_1,
        userId: USER_1,
        status: 'VALIDATED',
        currency: 'XOF',
        amountMinor: 20_000n,
      });

      await expect(
        repository.attachRepayment({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws CONFLICT if transaction already attached to a repayment', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.debtRepayment.findFirst.mockResolvedValueOnce({ id: 'existing' });

      await expect(
        repository.attachRepayment({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
        }),
      ).rejects.toThrow(DomainError);
    });

    it('throws CONFLICT if transaction already attached to an occurrence', async () => {
      mockTx.debt.findFirst.mockResolvedValueOnce(sampleDebt);
      mockTx.recurringOccurrence.findFirst.mockResolvedValueOnce({ id: 'occurrence' });

      await expect(
        repository.attachRepayment({
          id: REPAYMENT_1,
          userId: USER_1,
          debtId: DEBT_1,
          transactionId: TX_1,
          amountMinor: 50_000n,
        }),
      ).rejects.toThrow(DomainError);
    });
  });

  describe('deleteRepayment and listRepayments', () => {
    it('deletes an existing repayment', async () => {
      mockTx.debtRepayment.findFirst.mockResolvedValueOnce({
        id: REPAYMENT_1,
        debtId: DEBT_1,
        transactionId: TX_1,
      });

      const res = await repository.deleteRepayment(USER_1, DEBT_1, REPAYMENT_1);
      expect(res).toEqual({ id: REPAYMENT_1, debtId: DEBT_1, transactionId: TX_1 });
      expect(mockTx.debtRepayment.delete).toHaveBeenCalledWith({
        where: { userId_id: { userId: USER_1, id: REPAYMENT_1 } },
      });
    });

    it('throws NOT_FOUND when deleting non-existent repayment', async () => {
      mockTx.debtRepayment.findFirst.mockResolvedValueOnce(null);

      await expect(repository.deleteRepayment(USER_1, DEBT_1, REPAYMENT_1)).rejects.toThrow(DomainError);
    });

    it('lists repayments for debt', async () => {
      await repository.listRepayments(USER_1, DEBT_1);
      expect(mockTx.debtRepayment.findMany).toHaveBeenCalledWith({
        where: { userId: USER_1, debtId: DEBT_1 },
        orderBy: { createdAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('cancel and writeOff', () => {
    it('cancels a debt', async () => {
      await repository.cancel(USER_1, DEBT_1, 'Erreur de saisie', new Date('2026-02-01T10:00:00.000Z'));
      expect(mockTx.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });

    it('writes off a debt', async () => {
      await repository.writeOff(USER_1, DEBT_1, 'Client disparu', new Date('2026-02-01T10:00:00.000Z'));
      expect(mockTx.debt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'WRITTEN_OFF' }),
        }),
      );
    });

    it('finds open debts for summary', async () => {
      await repository.findOpenDebtsForSummary(USER_1);
      expect(mockTx.debt.findMany).toHaveBeenCalledWith({
        where: { userId: USER_1, status: 'OPEN' },
        include: expect.any(Object),
      });
    });
  });
});
