import { z } from 'zod';

import { CurrencyCodeSchema, MoneyStringSchema } from '../common/amount';
import { CivilDateSchema, InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { HexColorSchema, optionalText, text } from '../organization/common';

export const ACCOUNT_TYPES = ['CASH', 'MOBILE_MONEY', 'BANK', 'PAYMENT_ACCOUNT', 'OTHER'] as const;
export const AccountTypeSchema = z.enum(ACCOUNT_TYPES);
export type AccountType = z.infer<typeof AccountTypeSchema>;

export const CreateAccountSchema = z
  .object({
    name: text(1, 80),
    type: AccountTypeSchema,
    provider: optionalText(60).optional(),
    currency: CurrencyCodeSchema,
    openingBalanceMinor: MoneyStringSchema.default('0'),
    openedOn: CivilDateSchema,
    allowOverdraft: z.boolean().default(false),
    overdraftLimitMinor: MoneyStringSchema.optional(),
    includeInNetWorth: z.boolean().default(true),
    color: HexColorSchema.optional(),
    icon: optionalText(40).optional(),
    notes: optionalText(500).optional(),
  })
  .strict();
export type CreateAccount = z.infer<typeof CreateAccountSchema>;
export type CreateAccountInput = z.input<typeof CreateAccountSchema>;

export const UpdateAccountSchema = z
  .object({
    name: text(1, 80).optional(),
    provider: optionalText(60).optional(),
    allowOverdraft: z.boolean().optional(),
    overdraftLimitMinor: MoneyStringSchema.nullable().optional(),
    includeInNetWorth: z.boolean().optional(),
    color: HexColorSchema.nullable().optional(),
    icon: optionalText(40).nullable().optional(),
    notes: optionalText(500).optional(),
  })
  .strict();
export type UpdateAccount = z.infer<typeof UpdateAccountSchema>;

export const CloseAccountSchema = z
  .object({
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
    archived: z.coerce.boolean().optional(),
  })
  .strict();
export type ListAccountsQuery = z.infer<typeof ListAccountsQuerySchema>;

export const AccountResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: AccountTypeSchema,
  provider: z.string().nullable(),
  currency: CurrencyCodeSchema,
  currentBalanceMinor: MoneyStringSchema,
  openingBalanceMinor: MoneyStringSchema,
  openedOn: CivilDateSchema,
  allowOverdraft: z.boolean(),
  overdraftLimitMinor: MoneyStringSchema.nullable(),
  includeInNetWorth: z.boolean(),
  color: z.string().nullable(),
  icon: z.string().nullable(),
  notes: z.string().nullable(),
  archivedAt: InstantSchema.nullable(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type AccountResponse = z.infer<typeof AccountResponseSchema>;

export const AccountEnvelopeSchema = dataEnvelope(AccountResponseSchema);
export type AccountEnvelope = z.infer<typeof AccountEnvelopeSchema>;

export const AccountListEnvelopeSchema = listEnvelope(AccountResponseSchema);
export type AccountListEnvelope = z.infer<typeof AccountListEnvelopeSchema>;
