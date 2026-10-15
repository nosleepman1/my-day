import { z } from 'zod';

import { PositiveMoneyStringSchema } from '../common/amount';
import { CivilDateSchema, InstantSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';
import { optionalText } from '../organization/common';

import { TransactionResponseSchema } from './transactions.schema';

export const CreateTransferSchema = z
  .object({
    fromAccountId: z.uuid(),
    toAccountId: z.uuid(),
    fromAmountMinor: PositiveMoneyStringSchema,
    toAmountMinor: PositiveMoneyStringSchema.optional(),
    exchangeRate: z
      .string()
      .regex(/^\d+(?:\.\d{1,10})?$/, 'Taux de change invalide.')
      .optional(),
    rateDate: CivilDateSchema.optional(),
    occurredAt: InstantSchema,
    valueDate: CivilDateSchema,
    description: optionalText(255).optional(),
    notes: optionalText(2000).optional(),
  })
  .strict()
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: 'Le compte source et le compte destination doivent être différents.',
    path: ['toAccountId'],
  });
export type CreateTransfer = z.infer<typeof CreateTransferSchema>;

export const TransferResponseSchema = z.object({
  transferId: z.uuid(),
  fromTransaction: TransactionResponseSchema,
  toTransaction: TransactionResponseSchema,
});
export type TransferResponse = z.infer<typeof TransferResponseSchema>;

export const TransferEnvelopeSchema = dataEnvelope(TransferResponseSchema);
export type TransferEnvelope = z.infer<typeof TransferEnvelopeSchema>;
