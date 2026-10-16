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
  ForecastAccountSummary,
  ForecastQueryInput,
  ForecastReportResponse,
  MonthlyCashFlow,
} from '@orbit/contracts';
import {
  BalancesReportQuerySchema,
  CashFlowQuerySchema,
  CategoryBreakdownQuerySchema,
  FinanceSummaryQuerySchema,
  ForecastQuerySchema,
} from '@orbit/contracts';

import { DomainError } from '../../../platform/errors/domain-error';
import { AccountsRepository } from '../accounts/accounts.repository';
import type { DebtWithRelations } from '../debts/debts.repository';
import { toDebtResponse } from '../debts/debts.service';
import { computeDebtRemaining } from '../domain/debt-rules';
import type { ProjectionDebtInput, ProjectionOccurrenceInput } from '../domain/forecast-projector';
import { projectAccountCashflow } from '../domain/forecast-projector';
import { generateOccurrences } from '../domain/recurrence-rules';
import type { OccurrenceWithRelations } from '../recurring/recurring.repository';
import { toOccurrenceResponse } from '../recurring/recurring.service';
import { FinanceContext } from '../shared/finance-context';

interface RawTxItem {
  readonly currency: string;
  readonly type: string;
  readonly economicClass: string;
  readonly amountMinor: bigint;
  readonly valueDate: Date;
  readonly ledgerEntries?: readonly { readonly direction: string }[];
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
      const direction = tx.ledgerEntries?.[0]?.direction ?? 'CREDIT';
      if (direction === 'CREDIT') {
        acc.adjustmentsMinor += tx.amountMinor;
      } else {
        acc.adjustmentsMinor -= tx.amountMinor;
      }
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
        ledgerEntries: {
          select: { direction: true },
        },
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

  private async materializeActiveRecurrences(userId: string, endDate: string): Promise<void> {
    const activeRecurrings = await this.ctx.db.recurringTransaction.findMany({
      where: { userId, status: 'ACTIVE' },
    });

    for (const rec of activeRecurrings) {
      const anchor = rec.recurrenceAnchorOn.toISOString().slice(0, 10);
      const dates = generateOccurrences({
        recurrenceRule: rec.recurrenceRule,
        anchorDate: anchor,
        fromDate: anchor,
        toDate: endDate,
      });

      if (dates.length > 0) {
        await this.ctx.db.recurringOccurrence.createMany({
          data: dates.map((dueOnCivil) => ({
            id: this.ctx.newId(),
            userId,
            recurringTransactionId: rec.id,
            dueOn: new Date(`${dueOnCivil}T00:00:00.000Z`),
            expectedAmountMinor: rec.amountMinor,
            currency: rec.currency,
            status: 'EXPECTED',
          })),
          skipDuplicates: true,
        });
      }
    }
  }

  private async loadForecastOccurrences(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<OccurrenceWithRelations[]> {
    return this.ctx.db.recurringOccurrence.findMany({
      where: {
        userId,
        dueOn: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T00:00:00.000Z`),
        },
      },
      include: {
        recurringTransaction: {
          select: {
            id: true,
            name: true,
            type: true,
            economicClass: true,
            accountId: true,
            destinationAccountId: true,
            categoryId: true,
            counterpartyId: true,
            projectId: true,
          },
        },
      },
      orderBy: [{ dueOn: 'asc' }, { id: 'asc' }],
    });
  }

  private async loadForecastDebts(
    userId: string,
    startDate: string,
    endDate: string,
    includeDebts: boolean,
  ): Promise<DebtWithRelations[]> {
    if (!includeDebts) return [];

    return this.ctx.db.debt.findMany({
      where: {
        userId,
        status: 'OPEN',
        dueDate: {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T00:00:00.000Z`),
        },
      },
      include: {
        repayments: {
          include: { transaction: { select: { status: true } } },
        },
        counterparty: { select: { id: true, name: true, kind: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });
  }

  private async loadForecastAccounts(userId: string, accountId?: string, currency?: string) {
    const where: { userId: string; archivedAt: null; id?: string; currency?: string } = {
      userId,
      archivedAt: null,
    };
    if (accountId) where.id = accountId;
    if (currency) where.currency = currency;

    return this.ctx.db.financialAccount.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  private extractAccountOccurrences(
    occurrences: readonly OccurrenceWithRelations[],
    accountId: string,
  ): ProjectionOccurrenceInput[] {
    const results: ProjectionOccurrenceInput[] = [];
    for (const occ of occurrences) {
      const rec = occ.recurringTransaction;
      if (!rec) continue;
      if (rec.type !== 'INCOME' && rec.type !== 'EXPENSE' && rec.type !== 'TRANSFER') continue;
      const dueOnStr = occ.dueOn.toISOString().slice(0, 10);

      if (rec.accountId === accountId) {
        results.push({
          dueOn: dueOnStr,
          expectedAmountMinor: occ.expectedAmountMinor,
          type: rec.type,
          direction: rec.type === 'TRANSFER' ? 'DEBIT' : undefined,
          status: occ.status,
        });
      } else if (rec.destinationAccountId === accountId && rec.type === 'TRANSFER') {
        results.push({
          dueOn: dueOnStr,
          expectedAmountMinor: occ.expectedAmountMinor,
          type: 'TRANSFER',
          direction: 'CREDIT',
          status: occ.status,
        });
      }
    }
    return results;
  }

  private extractAccountDebts(
    debts: readonly DebtWithRelations[],
    accountCurrency: string,
  ): ProjectionDebtInput[] {
    const results: ProjectionDebtInput[] = [];
    for (const debt of debts) {
      if (debt.currency !== accountCurrency || !debt.dueDate) continue;
      const repaymentsList = debt.repayments.map((r) => ({
        amountMinor: r.amountMinor,
        transactionStatus: r.transaction.status,
      }));
      const remaining = computeDebtRemaining(debt.principalMinor, repaymentsList);
      if (remaining > 0n) {
        results.push({
          dueDate: debt.dueDate.toISOString().slice(0, 10),
          remainingMinor: remaining,
          type: debt.type,
        });
      }
    }
    return results;
  }

  private projectSingleAccount(params: {
    account: { id: string; name: string; currency: string };
    currentBalanceMinor: bigint;
    startDate: string;
    endDate: string;
    occurrences: readonly OccurrenceWithRelations[];
    debts: readonly DebtWithRelations[];
  }): ForecastAccountSummary {
    const { account, currentBalanceMinor, startDate, endDate, occurrences, debts } = params;
    const accountOccurrences = this.extractAccountOccurrences(occurrences, account.id);
    const accountDebts = this.extractAccountDebts(debts, account.currency);

    return projectAccountCashflow({
      accountId: account.id,
      accountName: account.name,
      currency: account.currency as CurrencyCode,
      currentBalanceMinor,
      startDate,
      endDate,
      occurrences: accountOccurrences,
      debts: accountDebts,
    });
  }

  async getForecast(rawQuery: ForecastQueryInput): Promise<ForecastReportResponse> {
    const query = ForecastQuerySchema.parse(rawQuery);
    const userId = this.ctx.userId();
    const horizonDays = query.horizon;
    const startDate = this.ctx.now().toISOString().slice(0, 10);
    const startEpoch = Date.parse(`${startDate}T00:00:00.000Z`);
    const endDate = new Date(startEpoch + horizonDays * 86_400_000).toISOString().slice(0, 10);

    await this.materializeActiveRecurrences(userId, endDate);

    const occurrences = await this.loadForecastOccurrences(userId, startDate, endDate);
    const debts = await this.loadForecastDebts(userId, startDate, endDate, query.includeDebts);

    const accounts = await this.loadForecastAccounts(userId, query.accountId, query.currency);
    const accountSummaries: ForecastAccountSummary[] = [];

    const asOfDate = new Date(`${startDate}T23:59:59.999Z`);
    for (const acc of accounts) {
      const balance = await this.accountsRepo.getClearedBalance(userId, acc.id, asOfDate);
      const currentBalanceMinor = balance?.clearedBalanceMinor ?? acc.openingBalanceMinor;
      const summary = this.projectSingleAccount({
        account: acc,
        currentBalanceMinor,
        startDate,
        endDate,
        occurrences,
        debts,
      });
      accountSummaries.push(summary);
    }

    return {
      horizonDays,
      startDate,
      endDate,
      accounts: accountSummaries,
      occurrences: occurrences.map((occ) => toOccurrenceResponse(occ, startDate)),
      debts: query.includeDebts ? debts.map((d) => toDebtResponse(d, startDate)) : undefined,
    };
  }
}
