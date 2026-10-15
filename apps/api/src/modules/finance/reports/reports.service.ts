import { Injectable } from '@nestjs/common';

import type {
  AccountBalanceItem,
  BalancesReport,
  BalancesReportQuery,
  CashFlowQuery,
  CashFlowReport,
  CategoryBreakdownItem,
  CategoryBreakdownQuery,
  CategoryBreakdownReport,
  CurrencyCode,
  CurrencySummaryItem,
  FinanceSummaryQuery,
  FinanceSummaryReport,
  MonthlyCashFlow,
} from '@orbit/contracts';
import {
  BalancesReportQuerySchema,
  CashFlowQuerySchema,
  CategoryBreakdownQuerySchema,
  FinanceSummaryQuerySchema,
} from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { AccountsRepository } from '../accounts/accounts.repository';
import { FinanceContext } from '../shared/finance-context';

interface RawTxItem {
  readonly currency: string;
  readonly type: string;
  readonly economicClass: string;
  readonly amountMinor: bigint;
  readonly valueDate: Date;
}

interface CurrencyAccumulator {
  incomeMinor: bigint;
  expenseMinor: bigint;
  otherIncomeMinor: bigint;
  adjustmentsMinor: bigint;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly ctx: FinanceContext,
    private readonly accountsRepo: AccountsRepository,
  ) {}

  private extractPeriod(query: { from?: string; to?: string; fromDate?: string; toDate?: string }): {
    from: string;
    to: string;
  } {
    const from = query.from ?? query.fromDate;
    const to = query.to ?? query.toDate;

    if (!from || !to) {
      throw new DomainError('VALIDATION_FAILED', 'Période obligatoire (from et to).');
    }

    if (from > to) {
      throw new DomainError(
        'BUSINESS_RULE_VIOLATION',
        'La date de début ne peut pas être postérieure à la date de fin.',
      );
    }

    return { from, to };
  }

  private accumulateSummary(map: Map<string, CurrencyAccumulator>, tx: RawTxItem): void {
    let acc = map.get(tx.currency);
    if (!acc) {
      acc = { incomeMinor: 0n, expenseMinor: 0n, otherIncomeMinor: 0n, adjustmentsMinor: 0n };
      map.set(tx.currency, acc);
    }

    if (tx.type === 'INCOME') {
      if (tx.economicClass === 'INCOME_OPERATING') {
        acc.incomeMinor += tx.amountMinor;
      } else {
        acc.otherIncomeMinor += tx.amountMinor;
      }
    } else if (tx.type === 'EXPENSE' || tx.economicClass === 'EXPENSE_FEE') {
      acc.expenseMinor += tx.amountMinor;
    } else if (tx.type === 'ADJUSTMENT') {
      acc.adjustmentsMinor += tx.amountMinor;
    }
  }

  async getSummary(rawQuery: FinanceSummaryQuery): Promise<FinanceSummaryReport> {
    const query = FinanceSummaryQuerySchema.parse(rawQuery);
    const { from, to } = this.extractPeriod(query);
    const userId = this.ctx.userId();

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const transactions = await this.ctx.db.transaction.findMany({
      where: {
        userId,
        status: 'VALIDATED',
        valueDate: { gte: fromDate, lte: toDate },
      },
      select: {
        currency: true,
        type: true,
        economicClass: true,
        amountMinor: true,
        valueDate: true,
      },
    });

    const currencyMap = new Map<string, CurrencyAccumulator>();
    for (const tx of transactions) {
      this.accumulateSummary(currencyMap, tx);
    }

    const summaries: CurrencySummaryItem[] = [];
    for (const [currency, acc] of currencyMap.entries()) {
      summaries.push({
        currency: currency as CurrencyCode,
        incomeMinor: acc.incomeMinor.toString(),
        expenseMinor: acc.expenseMinor.toString(),
        netMinor: (acc.incomeMinor - acc.expenseMinor).toString(),
        otherIncomeMinor: acc.otherIncomeMinor.toString(),
        adjustmentsMinor: acc.adjustmentsMinor.toString(),
      });
    }

    return {
      period: { from, to },
      summaries,
    };
  }

  async getBalances(rawQuery: BalancesReportQuery): Promise<BalancesReport> {
    const query = BalancesReportQuerySchema.parse(rawQuery);
    const userId = this.ctx.userId();
    const asOf = query.asOf ?? this.ctx.now().toISOString().slice(0, 10);
    const asOfDate = new Date(`${asOf}T23:59:59.999Z`);

    const accounts = await this.ctx.db.financialAccount.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    const accountItems: AccountBalanceItem[] = [];
    const totalsMap = new Map<string, bigint>();

    for (const acc of accounts) {
      const balance = await this.accountsRepo.getClearedBalance(userId, acc.id, asOfDate);
      const balanceMinor = balance?.clearedBalanceMinor ?? acc.openingBalanceMinor;

      accountItems.push({
        accountId: acc.id,
        name: acc.name,
        type: acc.type,
        currency: acc.currency as CurrencyCode,
        balanceMinor: balanceMinor.toString(),
        isArchived: acc.archivedAt !== null,
      });

      const currentTotal = totalsMap.get(acc.currency) ?? 0n;
      totalsMap.set(acc.currency, currentTotal + balanceMinor);
    }

    const totalsByCurrency: Record<string, string> = {};
    for (const [currency, total] of totalsMap.entries()) {
      totalsByCurrency[currency] = total.toString();
    }

    return {
      asOf,
      accounts: accountItems,
      totalsByCurrency,
    };
  }

  private buildCategoryItems(
    transactions: readonly {
      amountMinor: bigint;
      categoryId: string | null;
      category: { name: string } | null;
    }[],
    totalMinor: bigint,
  ): CategoryBreakdownItem[] {
    const categoryMap = new Map<string, { name: string; amountMinor: bigint; id: string | null }>();

    for (const tx of transactions) {
      const catKey = tx.categoryId ?? '__uncategorized__';
      const catName = tx.category?.name ?? 'Sans catégorie';
      const existing = categoryMap.get(catKey) ?? { name: catName, amountMinor: 0n, id: tx.categoryId };
      existing.amountMinor += tx.amountMinor;
      categoryMap.set(catKey, existing);
    }

    const categories: CategoryBreakdownItem[] = [];
    for (const item of categoryMap.values()) {
      const basisPoints = totalMinor > 0n ? (item.amountMinor * 10000n) / totalMinor : 0n;
      const percentage = +basisPoints.toString() / 100;
      categories.push({
        categoryId: item.id,
        categoryName: item.name,
        amountMinor: item.amountMinor.toString(),
        percentage,
      });
    }

    categories.sort((a, b) => (BigInt(b.amountMinor) > BigInt(a.amountMinor) ? 1 : -1));
    return categories;
  }

  async getCategoryBreakdown(rawQuery: CategoryBreakdownQuery): Promise<CategoryBreakdownReport> {
    const query = CategoryBreakdownQuerySchema.parse(rawQuery);
    const { from, to } = this.extractPeriod(query);
    const userId = this.ctx.userId();
    const kind = query.kind ?? 'EXPENSE';

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const transactions = await this.ctx.db.transaction.findMany({
      where: {
        userId,
        status: 'VALIDATED',
        currency: query.currency,
        type: kind === 'EXPENSE' ? 'EXPENSE' : 'INCOME',
        valueDate: { gte: fromDate, lte: toDate },
      },
      select: {
        amountMinor: true,
        categoryId: true,
        category: {
          select: { name: true },
        },
      },
    });

    let totalMinor = 0n;
    for (const tx of transactions) {
      totalMinor += tx.amountMinor;
    }

    const categories = this.buildCategoryItems(transactions, totalMinor);

    return {
      period: { fromDate: from, toDate: to },
      currency: query.currency,
      kind,
      totalMinor: totalMinor.toString(),
      categories,
    };
  }

  private buildCashFlowAggregates(
    transactions: readonly {
      amountMinor: bigint;
      type: string;
      economicClass: string;
      valueDate: Date;
    }[],
  ): {
    totalIncome: bigint;
    totalExpense: bigint;
    byEconomicClass: Record<string, string>;
    byMonth: MonthlyCashFlow[];
  } {
    let totalIncome = 0n;
    let totalExpense = 0n;
    const byClass: Record<string, bigint> = {};
    const byMonthMap = new Map<string, { income: bigint; expense: bigint }>();

    for (const tx of transactions) {
      const month = tx.valueDate.toISOString().slice(0, 7);
      const mItem = byMonthMap.get(month) ?? { income: 0n, expense: 0n };

      byClass[tx.economicClass] = (byClass[tx.economicClass] ?? 0n) + tx.amountMinor;

      if (tx.type === 'INCOME') {
        totalIncome += tx.amountMinor;
        mItem.income += tx.amountMinor;
      } else if (tx.type === 'EXPENSE') {
        totalExpense += tx.amountMinor;
        mItem.expense += tx.amountMinor;
      }

      byMonthMap.set(month, mItem);
    }

    const byEconomicClass: Record<string, string> = {};
    for (const [k, v] of Object.entries(byClass)) {
      byEconomicClass[k] = v.toString();
    }

    const byMonth: MonthlyCashFlow[] = Array.from(byMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        incomeMinor: data.income.toString(),
        expenseMinor: data.expense.toString(),
        netMinor: (data.income - data.expense).toString(),
      }));

    return { totalIncome, totalExpense, byEconomicClass, byMonth };
  }

  async getCashFlow(rawQuery: CashFlowQuery): Promise<CashFlowReport> {
    const query = CashFlowQuerySchema.parse(rawQuery);
    const { from, to } = this.extractPeriod(query);
    const userId = this.ctx.userId();

    const fromDate = new Date(`${from}T00:00:00.000Z`);
    const toDate = new Date(`${to}T23:59:59.999Z`);

    const transactions = await this.ctx.db.transaction.findMany({
      where: {
        userId,
        status: 'VALIDATED',
        currency: query.currency,
        valueDate: { gte: fromDate, lte: toDate },
      },
      select: {
        amountMinor: true,
        type: true,
        economicClass: true,
        valueDate: true,
      },
    });

    const aggregates = this.buildCashFlowAggregates(transactions);

    return {
      period: { fromDate: from, toDate: to },
      currency: query.currency,
      totalIncomeMinor: aggregates.totalIncome.toString(),
      totalExpenseMinor: aggregates.totalExpense.toString(),
      netCashFlowMinor: (aggregates.totalIncome - aggregates.totalExpense).toString(),
      byEconomicClass: aggregates.byEconomicClass,
      byMonth: aggregates.byMonth,
    };
  }
}
