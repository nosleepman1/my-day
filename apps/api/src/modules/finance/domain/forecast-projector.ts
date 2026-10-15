import type { CurrencyCode, ForecastAccountPoint, ForecastAccountSummary } from '@orbit/contracts';

export type ProjectionOccurrenceInput = Readonly<{
  dueOn: string; // YYYY-MM-DD
  expectedAmountMinor: bigint;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  direction?: 'DEBIT' | 'CREDIT';
  status: 'EXPECTED' | 'CONFIRMED' | 'SKIPPED';
}>;

export type ProjectionDebtInput = Readonly<{
  dueDate: string | null;
  remainingMinor: bigint;
  type: 'PAYABLE' | 'RECEIVABLE';
}>;

export type ProjectAccountCashflowParams = Readonly<{
  accountId: string;
  accountName: string;
  currency: CurrencyCode;
  currentBalanceMinor: bigint;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  occurrences: readonly ProjectionOccurrenceInput[];
  debts?: readonly ProjectionDebtInput[];
}>;

const DAY_MS = 86_400_000;

function fromCivil(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`);
}

function toCivil(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  let current = fromCivil(start);
  const target = fromCivil(end);

  while (current <= target) {
    dates.push(toCivil(current));
    current += DAY_MS;
  }
  return dates;
}

interface DailyFlow {
  inflows: bigint;
  outflows: bigint;
}

function computeOccurrenceFlow(occ: ProjectionOccurrenceInput): DailyFlow {
  if (occ.type === 'INCOME') {
    return { inflows: occ.expectedAmountMinor, outflows: 0n };
  }
  if (occ.type === 'EXPENSE') {
    return { inflows: 0n, outflows: occ.expectedAmountMinor };
  }
  if (occ.direction === 'CREDIT') {
    return { inflows: occ.expectedAmountMinor, outflows: 0n };
  }
  if (occ.direction === 'DEBIT') {
    return { inflows: 0n, outflows: occ.expectedAmountMinor };
  }
  return { inflows: 0n, outflows: 0n };
}

function computeDailyOccurrencesFlow(
  occurrences: readonly ProjectionOccurrenceInput[],
  date: string,
): DailyFlow {
  let inflows = 0n;
  let outflows = 0n;

  for (const occ of occurrences) {
    if (occ.dueOn === date && occ.status === 'EXPECTED') {
      const flow = computeOccurrenceFlow(occ);
      inflows += flow.inflows;
      outflows += flow.outflows;
    }
  }

  return { inflows, outflows };
}

function computeDailyDebtsFlow(debts: readonly ProjectionDebtInput[], date: string): DailyFlow {
  let inflows = 0n;
  let outflows = 0n;

  for (const debt of debts) {
    if (debt.dueDate === date && debt.remainingMinor > 0n) {
      if (debt.type === 'RECEIVABLE') {
        inflows += debt.remainingMinor;
      } else {
        outflows += debt.remainingMinor;
      }
    }
  }

  return { inflows, outflows };
}

/**
 * Projette les flux de trésorerie sur un horizon civil selon DATA_MODEL.md §3.5 et cahier §4.13.
 * Série séparée du réalisé, pas de double comptage des occurrences confirmées.
 */
export function projectAccountCashflow(params: ProjectAccountCashflowParams): ForecastAccountSummary {
  const {
    accountId,
    accountName,
    currency,
    currentBalanceMinor,
    startDate,
    endDate,
    occurrences,
    debts = [],
  } = params;

  const dateList = generateDateRange(startDate, endDate);
  const points: ForecastAccountPoint[] = [];

  let runningBalance = currentBalanceMinor;
  let lowestBalance = currentBalanceMinor;
  let isFirstDay = true;

  for (const d of dateList) {
    const occFlow = computeDailyOccurrencesFlow(occurrences, d);
    const debtFlow = computeDailyDebtsFlow(debts, d);
    const dayInflows = occFlow.inflows + debtFlow.inflows;
    const dayOutflows = occFlow.outflows + debtFlow.outflows;

    if (!isFirstDay) {
      runningBalance = runningBalance + dayInflows - dayOutflows;
    }
    if (runningBalance < lowestBalance) {
      lowestBalance = runningBalance;
    }

    points.push({
      date: d,
      realisedBalanceMinor: isFirstDay ? currentBalanceMinor.toString() : null,
      projectedBalanceMinor: runningBalance.toString(),
      expectedInflowsMinor: dayInflows.toString(),
      expectedOutflowsMinor: dayOutflows.toString(),
    });

    isFirstDay = false;
  }

  return {
    accountId,
    accountName,
    currency,
    currentBalanceMinor: currentBalanceMinor.toString(),
    projectedEndBalanceMinor: runningBalance.toString(),
    lowestProjectedBalanceMinor: lowestBalance.toString(),
    hasProjectedNegative: lowestBalance < 0n,
    points,
  };
}
