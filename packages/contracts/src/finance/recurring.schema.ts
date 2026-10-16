import { z } from 'zod';

import { CurrencyCodeSchema, PositiveMoneyStringSchema } from '../common/amount';
import { CivilDateSchema, InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { PaginationQuerySchema } from '../common/pagination';
import { optionalText, text } from '../organization/common';

import { EconomicClassSchema } from './categories.schema';
import { TransactionTypeSchema } from './transactions.schema';

export const RECURRING_STATUSES = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
export const RecurringStatusSchema = z.enum(RECURRING_STATUSES);
export type RecurringStatus = z.infer<typeof RecurringStatusSchema>;

export const RECURRING_GENERATION_MODES = ['CONFIRM', 'AUTO_PENDING'] as const;
export const RecurringGenerationModeSchema = z.enum(RECURRING_GENERATION_MODES);
export type RecurringGenerationMode = z.infer<typeof RecurringGenerationModeSchema>;

export const OCCURRENCE_STATUSES = ['EXPECTED', 'CONFIRMED', 'SKIPPED'] as const;
export const OccurrenceStatusSchema = z.enum(OCCURRENCE_STATUSES);
export type OccurrenceStatus = z.infer<typeof OccurrenceStatusSchema>;

export const LocalTimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, {
  message: 'Format d’heure invalide (HH:mm ou HH:mm:ss attendu).',
});

export const CreateRecurringTransactionSchema = z
  .object({
    name: text(1, 120),
    type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']),
    economicClass: EconomicClassSchema,
    amountMinor: PositiveMoneyStringSchema,
    currency: CurrencyCodeSchema,
    accountId: z.uuid(),
    destinationAccountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    counterpartyId: z.uuid().optional(),
    projectId: z.uuid().optional(),
    generationMode: RecurringGenerationModeSchema.default('CONFIRM'),
    reminderDaysBefore: z.number().int().min(0).max(30).default(1),
    recurrenceRule: text(1, 500),
    recurrenceAnchorOn: CivilDateSchema,
    recurrenceTimezone: text(1, 60),
    recurrenceLocalTime: LocalTimeSchema.optional(),
    notes: optionalText(2000).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.type === 'TRANSFER') {
        return !!data.destinationAccountId && data.destinationAccountId !== data.accountId;
      }
      return !data.destinationAccountId;
    },
    {
      message: 'Un transfert récurrent requiert un compte destination distinct du compte source.',
      path: ['destinationAccountId'],
    },
  );
export type CreateRecurringTransaction = z.infer<typeof CreateRecurringTransactionSchema>;
export type CreateRecurringTransactionInput = z.input<typeof CreateRecurringTransactionSchema>;

export const UpdateRecurringTransactionSchema = z
  .object({
    name: text(1, 120).optional(),
    amountMinor: PositiveMoneyStringSchema.optional(),
    accountId: z.uuid().optional(),
    destinationAccountId: z.uuid().nullable().optional(),
    categoryId: z.uuid().nullable().optional(),
    counterpartyId: z.uuid().nullable().optional(),
    projectId: z.uuid().nullable().optional(),
    generationMode: RecurringGenerationModeSchema.optional(),
    reminderDaysBefore: z.number().int().min(0).max(30).optional(),
    recurrenceRule: text(1, 500).optional(),
    recurrenceTimezone: text(1, 60).optional(),
    recurrenceLocalTime: LocalTimeSchema.nullable().optional(),
    notes: optionalText(2000).optional(),
  })
  .strict();
export type UpdateRecurringTransaction = z.infer<typeof UpdateRecurringTransactionSchema>;
export type UpdateRecurringTransactionInput = z.input<typeof UpdateRecurringTransactionSchema>;

export const ListRecurringTransactionsQuerySchema = PaginationQuerySchema.extend({
  status: RecurringStatusSchema.optional(),
  type: z.enum(['INCOME', 'EXPENSE', 'TRANSFER']).optional(),
  accountId: z.uuid().optional(),
});
export type ListRecurringTransactionsQuery = z.infer<typeof ListRecurringTransactionsQuerySchema>;

export const RecurringTransactionResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  name: z.string(),
  type: TransactionTypeSchema,
  economicClass: EconomicClassSchema,
  amountMinor: PositiveMoneyStringSchema,
  currency: CurrencyCodeSchema,
  accountId: z.uuid(),
  destinationAccountId: z.uuid().nullable(),
  categoryId: z.uuid().nullable(),
  counterpartyId: z.uuid().nullable(),
  projectId: z.uuid().nullable(),
  generationMode: RecurringGenerationModeSchema,
  reminderDaysBefore: z.number(),
  status: RecurringStatusSchema,
  recurrenceRule: z.string(),
  recurrenceAnchorOn: CivilDateSchema,
  recurrenceTimezone: z.string(),
  recurrenceLocalTime: z.string().nullable(),
  nextOccurrenceAt: InstantSchema.nullable(),
  generatedUntil: CivilDateSchema.nullable(),
  notes: z.string().nullable(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type RecurringTransactionResponse = z.infer<typeof RecurringTransactionResponseSchema>;

export const RecurringOccurrenceResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  recurringTransactionId: z.uuid(),
  dueOn: CivilDateSchema,
  expectedAmountMinor: PositiveMoneyStringSchema,
  currency: CurrencyCodeSchema,
  status: OccurrenceStatusSchema,
  transactionId: z.uuid().nullable(),
  confirmedAt: InstantSchema.nullable(),
  skippedAt: InstantSchema.nullable(),
  createdAt: InstantSchema,
  isOverdue: z.boolean(),
  recurringTransaction: z
    .object({
      id: z.uuid(),
      name: z.string(),
      type: TransactionTypeSchema,
      economicClass: EconomicClassSchema,
      accountId: z.uuid(),
    })
    .optional(),
});
export type RecurringOccurrenceResponse = z.infer<typeof RecurringOccurrenceResponseSchema>;

export const ListOccurrencesQuerySchema = PaginationQuerySchema.extend({
  from: CivilDateSchema.optional(),
  to: CivilDateSchema.optional(),
  status: OccurrenceStatusSchema.optional(),
  recurringTransactionId: z.uuid().optional(),
  accountId: z.uuid().optional(),
});
export type ListOccurrencesQuery = z.infer<typeof ListOccurrencesQuerySchema>;

export const ConfirmOccurrenceSchema = z
  .object({
    transactionId: z.uuid().optional(),
    accountId: z.uuid().optional(),
    amountMinor: PositiveMoneyStringSchema.optional(),
    valueDate: CivilDateSchema.optional(),
    notes: optionalText(500).optional(),
  })
  .strict();
export type ConfirmOccurrence = z.infer<typeof ConfirmOccurrenceSchema>;
export type ConfirmOccurrenceInput = z.input<typeof ConfirmOccurrenceSchema>;

export const SkipOccurrenceSchema = z
  .object({
    reason: optionalText(500).optional(),
  })
  .strict();
export type SkipOccurrence = z.infer<typeof SkipOccurrenceSchema>;
export type SkipOccurrenceInput = z.input<typeof SkipOccurrenceSchema>;

export const RecurringTransactionEnvelopeSchema = dataEnvelope(RecurringTransactionResponseSchema);
export type RecurringTransactionEnvelope = z.infer<typeof RecurringTransactionEnvelopeSchema>;

export const RecurringTransactionListEnvelopeSchema = listEnvelope(RecurringTransactionResponseSchema);
export type RecurringTransactionListEnvelope = z.infer<typeof RecurringTransactionListEnvelopeSchema>;

export const RecurringOccurrenceEnvelopeSchema = dataEnvelope(RecurringOccurrenceResponseSchema);
export type RecurringOccurrenceEnvelope = z.infer<typeof RecurringOccurrenceEnvelopeSchema>;

export const RecurringOccurrenceListEnvelopeSchema = listEnvelope(RecurringOccurrenceResponseSchema);
export type RecurringOccurrenceListEnvelope = z.infer<typeof RecurringOccurrenceListEnvelopeSchema>;
