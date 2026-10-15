import { z } from 'zod';

import { MoneyStringSchema } from '../common/amount';
import { CivilDateSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';
import { optionalText } from '../organization/common';

import { TransactionResponseSchema } from './transactions.schema';

export const StartReconciliationSchema = z
  .object({
    accountId: z.uuid(),
    statementDate: CivilDateSchema,
    statementEndingBalanceMinor: MoneyStringSchema,
  })
  .strict();
export type StartReconciliation = z.infer<typeof StartReconciliationSchema>;

export const ReconcileTransactionsSchema = z
  .object({
    accountId: z.uuid(),
    statementDate: CivilDateSchema,
    statementEndingBalanceMinor: MoneyStringSchema,
    transactionIds: z.array(z.uuid()).min(1),
    createAdjustmentIfNeeded: z.boolean().default(false),
  })
  .strict();
export type ReconcileTransactions = z.infer<typeof ReconcileTransactionsSchema>;

export const ReconciliationStatusResponseSchema = z.object({
  accountId: z.uuid(),
  statementDate: CivilDateSchema,
  statementEndingBalanceMinor: MoneyStringSchema,
  clearedBalanceMinor: MoneyStringSchema,
  differenceMinor: MoneyStringSchema,
  isBalanced: z.boolean(),
  unreconciledCount: z.number().int(),
});
export type ReconciliationStatusResponse = z.infer<typeof ReconciliationStatusResponseSchema>;

export const ReconciliationStatusEnvelopeSchema = dataEnvelope(ReconciliationStatusResponseSchema);
export type ReconciliationStatusEnvelope = z.infer<typeof ReconciliationStatusEnvelopeSchema>;

export const ReconciliationQuerySchema = z
  .object({
    statementDate: CivilDateSchema,
    statementEndingBalanceMinor: MoneyStringSchema,
  })
  .strict();
export type ReconciliationQuery = z.infer<typeof ReconciliationQuerySchema>;

export const ConfirmReconciliationSchema = z
  .object({
    statementDate: CivilDateSchema,
    statementEndingBalanceMinor: MoneyStringSchema,
    createAdjustmentIfNeeded: z.boolean().default(false),
    adjustmentReason: optionalText(500).optional(),
  })
  .strict();
export type ConfirmReconciliation = z.infer<typeof ConfirmReconciliationSchema>;

export const ReconciliationResultSchema = z.object({
  accountId: z.uuid(),
  statementDate: CivilDateSchema,
  statementEndingBalanceMinor: MoneyStringSchema,
  clearedBalanceMinor: MoneyStringSchema,
  differenceMinor: MoneyStringSchema,
  isBalanced: z.boolean(),
  adjustmentTransaction: TransactionResponseSchema.nullable(),
});
export type ReconciliationResult = z.infer<typeof ReconciliationResultSchema>;

export const ReconciliationResultEnvelopeSchema = dataEnvelope(ReconciliationResultSchema);
export type ReconciliationResultEnvelope = z.infer<typeof ReconciliationResultEnvelopeSchema>;
