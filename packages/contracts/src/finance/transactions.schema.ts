import { z } from 'zod';

import { CurrencyCodeSchema, PositiveMoneyStringSchema } from '../common/amount';
import { CivilDateSchema, InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { PaginationQuerySchema } from '../common/pagination';
import { optionalText, text } from '../organization/common';

import { EconomicClassSchema } from './categories.schema';

export const TRANSACTION_TYPES = ['INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT'] as const;
export const TransactionTypeSchema = z.enum(TRANSACTION_TYPES);
export type TransactionType = z.infer<typeof TransactionTypeSchema>;

export const TRANSACTION_STATUSES = ['PENDING', 'VALIDATED', 'CANCELLED'] as const;
export const TransactionStatusSchema = z.enum(TRANSACTION_STATUSES);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TRANSACTION_SOURCES = ['MANUAL', 'RECURRING', 'IMPORT_CSV', 'IMPORT_API'] as const;
export const TransactionSourceSchema = z.enum(TRANSACTION_SOURCES);
export type TransactionSource = z.infer<typeof TransactionSourceSchema>;

export const ENTRY_DIRECTIONS = ['DEBIT', 'CREDIT'] as const;
export const EntryDirectionSchema = z.enum(ENTRY_DIRECTIONS);
export type EntryDirection = z.infer<typeof EntryDirectionSchema>;

export const LedgerEntryResponseSchema = z.object({
  id: z.uuid(),
  transactionId: z.uuid(),
  accountId: z.uuid(),
  direction: EntryDirectionSchema,
  amountMinor: PositiveMoneyStringSchema,
  currency: CurrencyCodeSchema,
  createdAt: InstantSchema,
});
export type LedgerEntryResponse = z.infer<typeof LedgerEntryResponseSchema>;

export const CreateTransactionSchema = z
  .object({
    type: z.enum(['INCOME', 'EXPENSE', 'ADJUSTMENT']),
    status: z.enum(['PENDING', 'VALIDATED']).default('VALIDATED'),
    accountId: z.uuid(),
    amountMinor: PositiveMoneyStringSchema,
    currency: CurrencyCodeSchema,
    occurredAt: InstantSchema,
    valueDate: CivilDateSchema,
    categoryId: z.uuid().optional(),
    counterpartyId: z.uuid().optional(),
    description: optionalText(255).optional(),
    notes: optionalText(2000).optional(),
    economicClass: EconomicClassSchema.optional(),
    adjustmentDirection: EntryDirectionSchema.optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.type === 'ADJUSTMENT') {
        return !!data.adjustmentDirection;
      }
      return true;
    },
    {
      message: 'La direction (CREDIT ou DEBIT) est obligatoire pour un ajustement.',
      path: ['adjustmentDirection'],
    },
  );
export type CreateTransaction = z.infer<typeof CreateTransactionSchema>;
export type CreateTransactionInput = z.input<typeof CreateTransactionSchema>;

export const UpdateTransactionDetailsSchema = z
  .object({
    description: optionalText(255).optional(),
    notes: optionalText(2000).optional(),
    categoryId: z.uuid().nullable().optional(),
    counterpartyId: z.uuid().nullable().optional(),
    valueDate: CivilDateSchema.optional(),
  })
  .strict();
export type UpdateTransactionDetails = z.infer<typeof UpdateTransactionDetailsSchema>;

export const CancelTransactionSchema = z
  .object({
    reason: text(3, 500),
  })
  .strict();
export type CancelTransaction = z.infer<typeof CancelTransactionSchema>;

export const ListTransactionsQuerySchema = PaginationQuerySchema.extend({
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  counterpartyId: z.uuid().optional(),
  type: TransactionTypeSchema.optional(),
  status: TransactionStatusSchema.optional(),
  fromDate: CivilDateSchema.optional(),
  toDate: CivilDateSchema.optional(),
  search: z.string().trim().max(100).optional(),
}).strict();
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;

export const TransactionResponseSchema = z.object({
  id: z.uuid(),
  type: TransactionTypeSchema,
  status: TransactionStatusSchema,
  economicClass: EconomicClassSchema,
  amountMinor: PositiveMoneyStringSchema,
  currency: CurrencyCodeSchema,
  occurredAt: InstantSchema,
  valueDate: CivilDateSchema,
  source: TransactionSourceSchema,
  description: z.string().nullable(),
  notes: z.string().nullable(),
  categoryId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  transferId: z.uuid().nullable(),
  cancelReason: z.string().nullable(),
  cancelledAt: InstantSchema.nullable(),
  ledgerEntries: z.array(LedgerEntryResponseSchema),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type TransactionResponse = z.infer<typeof TransactionResponseSchema>;

export const TransactionEnvelopeSchema = dataEnvelope(TransactionResponseSchema);
export type TransactionEnvelope = z.infer<typeof TransactionEnvelopeSchema>;

export const TransactionListEnvelopeSchema = listEnvelope(TransactionResponseSchema);
export type TransactionListEnvelope = z.infer<typeof TransactionListEnvelopeSchema>;
