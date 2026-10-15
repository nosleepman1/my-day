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
    db: {
      transaction: {
        findMany: ReturnType<typeof vi.fn>;
      };
      financialAccount: {
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
      db: {
        transaction: {
          findMany: vi.fn(),
        },
        financialAccount: {
          findMany: vi.fn(),
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
});
