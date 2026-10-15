import { z } from 'zod';

import { EmailSchema } from '../auth/registration.schema';
import { InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { PaginationQuerySchema } from '../common/pagination';
import { optionalText, QueryBooleanSchema, text } from '../organization/common';

export const COUNTERPARTY_KINDS = ['PERSON', 'ORGANIZATION'] as const;
export const CounterpartyKindSchema = z.enum(COUNTERPARTY_KINDS);
export type CounterpartyKind = z.infer<typeof CounterpartyKindSchema>;

// Aliases for backwards compatibility
export const COUNTERPARTY_TYPES = COUNTERPARTY_KINDS;
export const CounterpartyTypeSchema = CounterpartyKindSchema;
export type CounterpartyType = CounterpartyKind;

export const CreateCounterpartySchema = z
  .object({
    name: text(1, 120),
    kind: CounterpartyKindSchema.default('PERSON'),
    phone: z.string().trim().max(20).optional().nullable(),
    email: EmailSchema.optional().nullable(),
    notes: optionalText(500).optional().nullable(),
  })
  .strict();
export type CreateCounterparty = z.infer<typeof CreateCounterpartySchema>;

export const UpdateCounterpartySchema = z
  .object({
    name: text(1, 120).optional(),
    kind: CounterpartyKindSchema.optional(),
    phone: z.string().trim().max(20).optional().nullable(),
    email: EmailSchema.optional().nullable(),
    notes: optionalText(500).optional().nullable(),
  })
  .strict();
export type UpdateCounterparty = z.infer<typeof UpdateCounterpartySchema>;

export const MergeCounterpartySchema = z
  .object({
    targetCounterpartyId: z.uuid(),
  })
  .strict();
export type MergeCounterparty = z.infer<typeof MergeCounterpartySchema>;

export const ListCounterpartiesQuerySchema = PaginationQuerySchema.extend({
  kind: CounterpartyKindSchema.optional(),
  search: z.string().trim().max(120).optional(),
  includeArchived: QueryBooleanSchema.optional(),
}).strict();
export type ListCounterpartiesQuery = z.infer<typeof ListCounterpartiesQuerySchema>;

export const CounterpartyResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: CounterpartyKindSchema,
  phone: z.string().nullable(),
  email: z.string().nullable(),
  notes: z.string().nullable(),
  archivedAt: InstantSchema.nullable(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
  transactionCount: z.number().int().optional(),
});
export type CounterpartyResponse = z.infer<typeof CounterpartyResponseSchema>;

export const CounterpartyEnvelopeSchema = dataEnvelope(CounterpartyResponseSchema);
export type CounterpartyEnvelope = z.infer<typeof CounterpartyEnvelopeSchema>;

export const CounterpartyListEnvelopeSchema = listEnvelope(CounterpartyResponseSchema);
export type CounterpartyListEnvelope = z.infer<typeof CounterpartyListEnvelopeSchema>;
