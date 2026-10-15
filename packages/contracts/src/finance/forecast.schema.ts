import { z } from 'zod';

import { CurrencyCodeSchema } from '../common/amount';
import { CivilDateSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';

import { DebtResponseSchema } from './debts.schema';
import { RecurringOccurrenceResponseSchema } from './recurring.schema';

export const FORECAST_HORIZONS = [30, 60, 90] as const;

export const ForecastQuerySchema = z.object({
  horizon: z.coerce.number().int().min(1).max(365).default(90),
  accountId: z.uuid().optional(),
  currency: CurrencyCodeSchema.optional(),
  includeDebts: z.coerce.boolean().default(false),
});
export type ForecastQuery = z.infer<typeof ForecastQuerySchema>;

export const ForecastAccountPointSchema = z.object({
  date: CivilDateSchema,
  realisedBalanceMinor: z.string().nullable(),
  projectedBalanceMinor: z.string(),
  expectedInflowsMinor: z.string(),
  expectedOutflowsMinor: z.string(),
});
export type ForecastAccountPoint = z.infer<typeof ForecastAccountPointSchema>;

export const ForecastAccountSummarySchema = z.object({
  accountId: z.uuid(),
  accountName: z.string(),
  currency: CurrencyCodeSchema,
  currentBalanceMinor: z.string(),
  projectedEndBalanceMinor: z.string(),
  lowestProjectedBalanceMinor: z.string(),
  hasProjectedNegative: z.boolean(),
  points: z.array(ForecastAccountPointSchema),
});
export type ForecastAccountSummary = z.infer<typeof ForecastAccountSummarySchema>;

export const ForecastReportResponseSchema = z.object({
  horizonDays: z.number(),
  startDate: CivilDateSchema,
  endDate: CivilDateSchema,
  accounts: z.array(ForecastAccountSummarySchema),
  occurrences: z.array(RecurringOccurrenceResponseSchema),
  debts: z.array(DebtResponseSchema).optional(),
});
export type ForecastReportResponse = z.infer<typeof ForecastReportResponseSchema>;

export const ForecastReportEnvelopeSchema = dataEnvelope(ForecastReportResponseSchema);
export type ForecastReportEnvelope = z.infer<typeof ForecastReportEnvelopeSchema>;
