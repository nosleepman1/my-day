import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  BalancesReport,
  CashFlowReport,
  CategoryBreakdownReport,
  FinanceSummaryReport,
} from '@orbit/contracts';

import { ReportsController } from './reports.controller';
import type { ReportsService } from './reports.service';

const sampleSummary: FinanceSummaryReport = {
  period: { from: '2026-01-01', to: '2026-01-31' },
  summaries: [
    {
      currency: 'XOF',
      incomeMinor: '500000',
      expenseMinor: '300000',
      netMinor: '200000',
      otherIncomeMinor: '0',
      adjustmentsMinor: '0',
    },
  ],
};

const sampleBalances: BalancesReport = {
  asOf: '2026-10-15',
  accounts: [],
  totalsByCurrency: { XOF: '100000' },
};

const sampleCategoryBreakdown: CategoryBreakdownReport = {
  period: { fromDate: '2026-01-01', toDate: '2026-01-31' },
  currency: 'XOF',
  kind: 'EXPENSE',
  totalMinor: '100000',
  categories: [],
};

const sampleCashFlow: CashFlowReport = {
  period: { fromDate: '2026-01-01', toDate: '2026-01-31' },
  currency: 'XOF',
  totalIncomeMinor: '100000',
  totalExpenseMinor: '50000',
  netCashFlowMinor: '50000',
  byEconomicClass: {},
  byMonth: [],
};

describe('ReportsController', () => {
  let controller: ReportsController;
  let mockService: {
    getSummary: ReturnType<typeof vi.fn>;
    getBalances: ReturnType<typeof vi.fn>;
    getCategoryBreakdown: ReturnType<typeof vi.fn>;
    getCashFlow: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockService = {
      getSummary: vi.fn().mockResolvedValue(sampleSummary),
      getBalances: vi.fn().mockResolvedValue(sampleBalances),
      getCategoryBreakdown: vi.fn().mockResolvedValue(sampleCategoryBreakdown),
      getCashFlow: vi.fn().mockResolvedValue(sampleCashFlow),
    };

    controller = new ReportsController(mockService as unknown as ReportsService);
  });

  it('delegates getSummary to service', async () => {
    const res = await controller.getSummary({ from: '2026-01-01', to: '2026-01-31' });
    expect(res).toEqual({ data: sampleSummary });
    expect(mockService.getSummary).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('delegates getByCategory to service', async () => {
    const res = await controller.getByCategory({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      currency: 'XOF',
    });
    expect(res).toEqual({ data: sampleCategoryBreakdown });
    expect(mockService.getCategoryBreakdown).toHaveBeenCalledWith({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      currency: 'XOF',
    });
  });

  it('delegates getCashFlow to service', async () => {
    const res = await controller.getCashFlow({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      currency: 'XOF',
    });
    expect(res).toEqual({ data: sampleCashFlow });
    expect(mockService.getCashFlow).toHaveBeenCalledWith({
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      currency: 'XOF',
    });
  });

  it('delegates getBalances to service', async () => {
    const res = await controller.getBalances({ asOf: '2026-10-15' });
    expect(res).toEqual({ data: sampleBalances });
    expect(mockService.getBalances).toHaveBeenCalledWith({ asOf: '2026-10-15' });
  });
});
