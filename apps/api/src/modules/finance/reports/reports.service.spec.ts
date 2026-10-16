import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountsRepository } from '../accounts/accounts.repository';
import type { FinanceContext } from '../shared/finance-context';

import { ReportsService } from './reports.service';

const USER_ID = '01927000-0000-7000-8000-000000000001';
const ACCOUNT_1 = '01927000-0000-7000-8000-000000000002';
const ACCOUNT_2 = '01927000-0000-7000-8000-000000000003';
const CAT_1 = '01927000-0000-7000-8000-000000000004';

describe('ReportsService', () => {
  let service: ReportsService;
  let mockCtx: {
    userId: () => string;
    now: () => Date;
    newId: () => string;
    db: {
      transaction: {
        findMany: ReturnType<typeof vi.fn>;
      };
      financialAccount: {
        findMany: ReturnType<typeof vi.fn>;
      };
      recurringTransaction: {
        findMany: ReturnType<typeof vi.fn>;
      };
      recurringOccurrence: {
        createMany: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
      debt: {
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };
  let mockAccountsRepo: {
    getClearedBalance: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockCtx = {
      userId: () => USER_ID,
      now: () => new Date('2026-10-15T12:00:00.000Z'),
      newId: vi.fn(() => '01927000-0000-7000-8000-000000000099'),
      db: {
        transaction: {
          findMany: vi.fn(),
        },
        financialAccount: {
          findMany: vi.fn(),
        },
        recurringTransaction: {
          findMany: vi.fn().mockResolvedValue([]),
        },
        recurringOccurrence: {
          createMany: vi.fn().mockResolvedValue({ count: 0 }),
          findMany: vi.fn().mockResolvedValue([]),
        },
        debt: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    };

    mockAccountsRepo = {
      getClearedBalance: vi.fn(),
    };

    service = new ReportsService(
      mockCtx as unknown as FinanceContext,
      mockAccountsRepo as unknown as AccountsRepository,
    );
  });

  describe('getSummary', () => {
    it('aggregates income and expenses strictly by currency without mixing', async () => {
      mockCtx.db.transaction.findMany.mockResolvedValueOnce([
        {
          currency: 'XOF',
          type: 'INCOME',
          economicClass: 'INCOME_OPERATING',
          amountMinor: 500_000n,
          valueDate: new Date('2026-01-10'),
          refundOfId: null,
          category: { name: 'Salaire' },
        },
        {
          currency: 'XOF',
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          amountMinor: 150_000n,
          valueDate: new Date('2026-01-15'),
          refundOfId: null,
          category: { name: 'Loyer' },
        },
        {
          currency: 'EUR',
          type: 'INCOME',
          economicClass: 'INCOME_OPERATING',
          amountMinor: 2_000n,
          valueDate: new Date('2026-01-12'),
          refundOfId: null,
          category: { name: 'Freelance' },
        },
      ]);

      const res = await service.getSummary({
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(res.period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
      expect(res.summaries).toHaveLength(2);

      const xof = res.summaries.find((s) => s.currency === 'XOF');
      expect(xof).toBeDefined();
      expect(xof?.incomeMinor).toBe('500000');
      expect(xof?.expenseMinor).toBe('150000');
      expect(xof?.netMinor).toBe('350000');

      const eur = res.summaries.find((s) => s.currency === 'EUR');
      expect(eur).toBeDefined();
      expect(eur?.incomeMinor).toBe('2000');
      expect(eur?.expenseMinor).toBe('0');
      expect(eur?.netMinor).toBe('2000');
    });

    it('rejects if from date is after to date', async () => {
      await expect(
        service.getSummary({
          from: '2026-02-01',
          to: '2026-01-01',
        }),
      ).rejects.toThrow();
    });
  });

  describe('getBalances', () => {
    it('returns balances for all accounts and sums per currency', async () => {
      mockCtx.db.financialAccount.findMany.mockResolvedValueOnce([
        {
          id: ACCOUNT_1,
          name: 'Compte Wave',
          type: 'MOBILE_MONEY',
          currency: 'XOF',
          archivedAt: null,
        },
        {
          id: ACCOUNT_2,
          name: 'Compte Cash',
          type: 'CASH',
          currency: 'XOF',
          archivedAt: null,
        },
      ]);

      mockAccountsRepo.getClearedBalance
        .mockResolvedValueOnce({ clearedBalanceMinor: 200_000n, unreconciledCount: 0 })
        .mockResolvedValueOnce({ clearedBalanceMinor: 50_000n, unreconciledCount: 0 });

      const res = await service.getBalances({ asOf: '2026-10-15' });

      expect(res.asOf).toBe('2026-10-15');
      expect(res.accounts).toHaveLength(2);
      expect(res.totalsByCurrency).toEqual({
        XOF: '250000',
      });
    });
  });

  describe('getCategoryBreakdown', () => {
    it('groups expenses by category with percentages', async () => {
      mockCtx.db.transaction.findMany.mockResolvedValueOnce([
        {
          amountMinor: 80_000n,
          categoryId: CAT_1,
          category: { name: 'Alimentation' },
        },
        {
          amountMinor: 20_000n,
          categoryId: null,
          category: null,
        },
      ]);

      const res = await service.getCategoryBreakdown({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        currency: 'XOF',
        kind: 'EXPENSE',
      });

      expect(res.currency).toBe('XOF');
      expect(res.totalMinor).toBe('100000');
      expect(res.categories).toHaveLength(2);
      expect(res.categories[0]?.categoryName).toBe('Alimentation');
      expect(res.categories[0]?.amountMinor).toBe('80000');
      expect(res.categories[0]?.percentage).toBe(80);
      expect(res.categories[1]?.categoryName).toBe('Sans catégorie');
      expect(res.categories[1]?.percentage).toBe(20);
    });
  });

  describe('getCashFlow', () => {
    it('aggregates total income, expense and monthly intervals', async () => {
      mockCtx.db.transaction.findMany.mockResolvedValueOnce([
        {
          amountMinor: 100_000n,
          type: 'INCOME',
          economicClass: 'INCOME_OPERATING',
          valueDate: new Date('2026-01-15'),
        },
        {
          amountMinor: 40_000n,
          type: 'EXPENSE',
          economicClass: 'EXPENSE_OPERATING',
          valueDate: new Date('2026-01-20'),
        },
      ]);

      const res = await service.getCashFlow({
        fromDate: '2026-01-01',
        toDate: '2026-01-31',
        currency: 'XOF',
      });

      expect(res.currency).toBe('XOF');
      expect(res.totalIncomeMinor).toBe('100000');
      expect(res.totalExpenseMinor).toBe('40000');
      expect(res.netCashFlowMinor).toBe('60000');
      expect(res.byMonth).toHaveLength(1);
      expect(res.byMonth[0]?.month).toBe('2026-01');
      expect(res.byMonth[0]?.netMinor).toBe('60000');
    });
  });

  describe('getForecast', () => {
    it('returns cashflow forecast projection across accounts and occurrences', async () => {
      mockCtx.db.financialAccount.findMany.mockResolvedValueOnce([
        {
          id: ACCOUNT_1,
          name: 'Compte Principal',
          type: 'CHECKING',
          currency: 'XOF',
          openingBalanceMinor: 100_000n,
          archivedAt: null,
        },
      ]);

      mockAccountsRepo.getClearedBalance.mockResolvedValueOnce({
        clearedBalanceMinor: 100_000n,
      });

      mockCtx.db.recurringOccurrence.findMany.mockResolvedValueOnce([
        {
          id: '01927000-0000-7000-8000-000000000050',
          userId: USER_ID,
          recurringTransactionId: '01927000-0000-7000-8000-000000000010',
          dueOn: new Date('2026-10-20T00:00:00.000Z'),
          expectedAmountMinor: 30_000n,
          currency: 'XOF',
          status: 'EXPECTED',
          transactionId: null,
          confirmedAt: null,
          skippedAt: null,
          createdAt: new Date('2026-10-01T10:00:00.000Z'),
          recurringTransaction: {
            id: '01927000-0000-7000-8000-000000000010',
            name: 'Loyer Bureau',
            type: 'EXPENSE',
            economicClass: 'EXPENSE_OPERATING',
            accountId: ACCOUNT_1,
            destinationAccountId: null,
          },
        },
      ]);

      const res = await service.getForecast({
        horizon: 30,
        currency: 'XOF',
      });

      expect(res.horizonDays).toBe(30);
      expect(res.startDate).toBe('2026-10-15');
      expect(res.accounts).toHaveLength(1);
      expect(res.accounts[0]?.accountId).toBe(ACCOUNT_1);
      expect(res.accounts[0]?.currentBalanceMinor).toBe('100000');
      expect(res.accounts[0]?.projectedEndBalanceMinor).toBe('70000');
      expect(res.occurrences).toHaveLength(1);
      expect(res.debts).toBeUndefined();
    });

    it('incorporates open debts when includeDebts is true', async () => {
      mockCtx.db.financialAccount.findMany.mockResolvedValueOnce([
        {
          id: ACCOUNT_1,
          name: 'Compte Principal',
          type: 'CHECKING',
          currency: 'XOF',
          openingBalanceMinor: 50_000n,
          archivedAt: null,
        },
      ]);

      mockAccountsRepo.getClearedBalance.mockResolvedValueOnce({
        clearedBalanceMinor: 50_000n,
      });

      mockCtx.db.debt.findMany.mockResolvedValueOnce([
        {
          id: '01927000-0000-7000-8000-000000000070',
          userId: USER_ID,
          type: 'RECEIVABLE',
          counterpartyId: null,
          title: 'Prêt ami',
          description: null,
          principalMinor: 20_000n,
          currency: 'XOF',
          openedOn: new Date('2026-10-01'),
          dueDate: new Date('2026-10-25T00:00:00.000Z'),
          status: 'OPEN',
          notes: null,
          createdAt: new Date('2026-10-01'),
          updatedAt: new Date('2026-10-01'),
          repayments: [],
          counterparty: null,
        },
      ]);

      const res = await service.getForecast({
        horizon: 30,
        currency: 'XOF',
        includeDebts: true,
      });

      expect(res.accounts[0]?.projectedEndBalanceMinor).toBe('70000');
      expect(res.debts).toBeDefined();
      expect(res.debts).toHaveLength(1);
    });

    it('materializes active recurrences and projects recurring transfer to destination account', async () => {
      mockCtx.db.financialAccount.findMany.mockResolvedValueOnce([
        {
          id: ACCOUNT_1,
          name: 'Compte Épargne',
          type: 'SAVINGS',
          currency: 'XOF',
          openingBalanceMinor: 10_000n,
          archivedAt: null,
        },
      ]);
      mockAccountsRepo.getClearedBalance.mockResolvedValueOnce({
        clearedBalanceMinor: 10_000n,
      });

      mockCtx.db.recurringTransaction.findMany.mockResolvedValueOnce([
        {
          id: '01927000-0000-7000-8000-000000000080',
          userId: USER_ID,
          name: 'Virement Épargne',
          type: 'TRANSFER',
          amountMinor: 15_000n,
          currency: 'XOF',
          accountId: ACCOUNT_2,
          destinationAccountId: ACCOUNT_1,
          recurrenceRule: 'FREQ=MONTHLY;BYMONTHDAY=20',
          recurrenceAnchorOn: new Date('2026-10-01T00:00:00.000Z'),
        },
      ]);

      mockCtx.db.recurringOccurrence.findMany.mockResolvedValueOnce([
        {
          id: '01927000-0000-7000-8000-000000000085',
          dueOn: new Date('2026-10-20T00:00:00.000Z'),
          expectedAmountMinor: 15_000n,
          status: 'EXPECTED',
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          recurringTransaction: {
            id: '01927000-0000-7000-8000-000000000080',
            type: 'TRANSFER',
            accountId: ACCOUNT_2,
            destinationAccountId: ACCOUNT_1,
          },
        },
      ]);

      const res = await service.getForecast({
        horizon: 30,
        currency: 'XOF',
        accountId: ACCOUNT_1,
      });

      expect(mockCtx.db.recurringOccurrence.createMany).toHaveBeenCalled();
      expect(res.accounts[0]?.projectedEndBalanceMinor).toBe('25000');
    });
  });
});
