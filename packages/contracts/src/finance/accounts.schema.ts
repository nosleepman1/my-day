import { z } from 'zod';

import { CurrencyCodeSchema, MoneyStringSchema } from '../common/amount';
import { CivilDateSchema, InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { optionalText, text } from '../organization/common';

export const ACCOUNT_TYPES = [
  'CASH',
  'CHECKING',
  'SAVINGS',
  'MOBILE_MONEY',
  'CREDIT_CARD',
  'INVESTMENT',
  'OTHER',
] as const;
export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CreateAccountSchema = z
  .object({
    name: text(1, 100),
    type: AccountTypeSchema,
    currency: CurrencyCodeSchema,
    openingBalanceMinor: MoneyStringSchema.default('0'),
    openedOn: CivilDateSchema,
    allowOverdraft: z.boolean().default(false),
    notes: optionalText(500).optional(),
  })
  .strict();
export type CreateAccount = z.infer<typeof CreateAccountSchema>;

export const UpdateAccountSchema = z
  .object({
    name: text(1, 100).optional(),
    allowOverdraft: z.boolean().optional(),
    notes: optionalText(500).optional(),
  })
  .strict();
export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;

export const CloseAccountSchema = z
  .object({
    closedOn: CivilDateSchema.optional(),
    notes: optionalText(500).optional(),
  })
  .strict();
export type CloseAccount = z.infer<typeof CloseAccountSchema>;

export const ReopenAccountSchema = z
  .object({
    notes: optionalText(500).optional(),
  })
  .strict();
export type ReopenAccount = z.infer<typeof ReopenAccountSchema>;

export const ListAccountsQuerySchema = z
  .object({
    type: AccountTypeSchema.optional(),
    currency: CurrencyCodeSchema.optional(),
    isClosed: z.coerce.boolean().optional(),
  })
  .strict();
export type ListAccountsQuery = z.infer<typeof ListAccountsQuerySchema>;

export const AccountResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: AccountTypeSchema,
  currency: CurrencyCodeSchema,
  currentBalanceMinor: MoneyStringSchema,
  openingBalanceMinor: MoneyStringSchema,
  openedOn: CivilDateSchema,
  closedOn: CivilDateSchema.nullable(),
  allowOverdraft: z.boolean(),
  notes: z.string().nullable(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const AccountEnvelopeSchema = dataEnvelope(AccountResponseSchema);
export type AccountEnvelope = z.infer<typeof AccountEnvelopeSchema>;

export const AccountListEnvelopeSchema = listEnvelope(AccountResponseSchema);
export type AccountListEnvelope = z.infer<typeof AccountListEnvelopeSchema>;
