import { z } from 'zod';

import { CurrencyCodeSchema, MoneyStringSchema } from '../common/amount';
import { CivilDateSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';

import { AccountTypeSchema } from './accounts.schema';
import { CategoryKindSchema } from './categories.schema';

export const CashFlowQuerySchema = z
  .object({
    fromDate: CivilDateSchema,
    toDate: CivilDateSchema,
    currency: CurrencyCodeSchema,
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
    fromDate: CivilDateSchema,
    toDate: CivilDateSchema,
    kind: CategoryKindSchema,
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
