import { z } from 'zod';

import { MoneyStringSchema } from '../common/amount';
import { CivilDateSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';

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
