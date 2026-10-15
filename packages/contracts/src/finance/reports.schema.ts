import { z } from 'zod';

import { CurrencyCodeSchema, MoneyStringSchema } from '../common/amount';
import { CivilDateSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';

import { AccountTypeSchema } from './accounts.schema';
import { CategoryKindSchema } from './categories.schema';

export const FinanceSummaryQuerySchema = z
  .object({
    from: CivilDateSchema.optional(),
    to: CivilDateSchema.optional(),
    fromDate: CivilDateSchema.optional(),
    toDate: CivilDateSchema.optional(),
  })
  .strict();
export type FinanceSummaryQuery = z.infer<typeof FinanceSummaryQuerySchema>;

export const CurrencySummaryItemSchema = z.object({
  currency: CurrencyCodeSchema,
  incomeMinor: MoneyStringSchema,
  expenseMinor: MoneyStringSchema,
  netMinor: MoneyStringSchema,
  otherIncomeMinor: MoneyStringSchema,
  adjustmentsMinor: MoneyStringSchema,
});
export type CurrencySummaryItem = z.infer<typeof CurrencySummaryItemSchema>;

export const FinanceSummaryReportSchema = z.object({
  period: z.object({
    from: CivilDateSchema,
    to: CivilDateSchema,
  }),
  summaries: z.array(CurrencySummaryItemSchema),
});
export type FinanceSummaryReport = z.infer<typeof FinanceSummaryReportSchema>;
export const FinanceSummaryEnvelopeSchema = dataEnvelope(FinanceSummaryReportSchema);
export type FinanceSummaryEnvelope = z.infer<typeof FinanceSummaryEnvelopeSchema>;

export const BalancesReportQuerySchema = z
  .object({
    asOf: CivilDateSchema.optional(),
  })
  .strict();
export type BalancesReportQuery = z.infer<typeof BalancesReportQuerySchema>;

export const AccountBalanceItemSchema = z.object({
  accountId: z.uuid(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: CurrencyCodeSchema,
  balanceMinor: MoneyStringSchema,
  isArchived: z.boolean(),
});
export type AccountBalanceItem = z.infer<typeof AccountBalanceItemSchema>;

export const BalancesReportSchema = z.object({
  asOf: CivilDateSchema,
  accounts: z.array(AccountBalanceItemSchema),
  totalsByCurrency: z.record(z.string(), MoneyStringSchema),
});
export type BalancesReport = z.infer<typeof BalancesReportSchema>;
export const BalancesReportEnvelopeSchema = dataEnvelope(BalancesReportSchema);
export type BalancesReportEnvelope = z.infer<typeof BalancesReportEnvelopeSchema>;

export const CashFlowQuerySchema = z
  .object({
    from: CivilDateSchema.optional(),
    to: CivilDateSchema.optional(),
    fromDate: CivilDateSchema.optional(),
    toDate: CivilDateSchema.optional(),
    currency: CurrencyCodeSchema,
    granularity: z.enum(['day', 'week', 'month']).default('month').optional(),
  })
  .strict();
export type CashFlowQuery = z.infer<typeof CashFlowQuerySchema>;

export const MonthlyCashFlowSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format attendu YYYY-MM.'),
  incomeMinor: MoneyStringSchema,
  expenseMinor: MoneyStringSchema,
  netMinor: MoneyStringSchema,
});
export type MonthlyCashFlow = z.infer<typeof MonthlyCashFlowSchema>;

export const CashFlowReportSchema = z.object({
  period: z.object({
    fromDate: CivilDateSchema,
    toDate: CivilDateSchema,
  }),
  currency: CurrencyCodeSchema,
  totalIncomeMinor: MoneyStringSchema,
  totalExpenseMinor: MoneyStringSchema,
  netCashFlowMinor: MoneyStringSchema,
  byEconomicClass: z.record(z.string(), MoneyStringSchema),
  byMonth: z.array(MonthlyCashFlowSchema),
});
export type CashFlowReport = z.infer<typeof CashFlowReportSchema>;
export const CashFlowEnvelopeSchema = dataEnvelope(CashFlowReportSchema);
export type CashFlowEnvelope = z.infer<typeof CashFlowEnvelopeSchema>;

export const NetWorthQuerySchema = z
  .object({
    asOfDate: CivilDateSchema.optional(),
    baseCurrency: CurrencyCodeSchema,
  })
  .strict();
export type NetWorthQuery = z.infer<typeof NetWorthQuerySchema>;

export const NetWorthAccountItemSchema = z.object({
  accountId: z.uuid(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: CurrencyCodeSchema,
  balanceMinor: MoneyStringSchema,
  balanceInBaseMinor: MoneyStringSchema,
});
export type NetWorthAccountItem = z.infer<typeof NetWorthAccountItemSchema>;

export const NetWorthReportSchema = z.object({
  asOfDate: CivilDateSchema,
  baseCurrency: CurrencyCodeSchema,
  totalAssetsMinor: MoneyStringSchema,
  totalLiabilitiesMinor: MoneyStringSchema,
  netWorthMinor: MoneyStringSchema,
  accounts: z.array(NetWorthAccountItemSchema),
});
export type NetWorthReport = z.infer<typeof NetWorthReportSchema>;
export const NetWorthEnvelopeSchema = dataEnvelope(NetWorthReportSchema);
export type NetWorthEnvelope = z.infer<typeof NetWorthEnvelopeSchema>;

export const CategoryBreakdownQuerySchema = z
  .object({
    from: CivilDateSchema.optional(),
    to: CivilDateSchema.optional(),
    fromDate: CivilDateSchema.optional(),
    toDate: CivilDateSchema.optional(),
    kind: CategoryKindSchema.optional(),
    currency: CurrencyCodeSchema,
  })
  .strict();
export type CategoryBreakdownQuery = z.infer<typeof CategoryBreakdownQuerySchema>;

export const CategoryBreakdownItemSchema = z.object({
  categoryId: z.uuid().nullable(),
  categoryName: z.string(),
  amountMinor: MoneyStringSchema,
  percentage: z.number().min(0).max(100),
});
export type CategoryBreakdownItem = z.infer<typeof CategoryBreakdownItemSchema>;

export const CategoryBreakdownReportSchema = z.object({
  period: z.object({
    fromDate: CivilDateSchema,
    toDate: CivilDateSchema,
  }),
  currency: CurrencyCodeSchema,
  kind: CategoryKindSchema,
  totalMinor: MoneyStringSchema,
  categories: z.array(CategoryBreakdownItemSchema),
});
export type CategoryBreakdownReport = z.infer<typeof CategoryBreakdownReportSchema>;
export const CategoryBreakdownEnvelopeSchema = dataEnvelope(CategoryBreakdownReportSchema);
export type CategoryBreakdownEnvelope = z.infer<typeof CategoryBreakdownEnvelopeSchema>;
