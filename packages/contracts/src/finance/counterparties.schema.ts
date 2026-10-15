import { z } from 'zod';

import { InstantSchema } from '../common/dates';
import { dataEnvelope, listEnvelope } from '../common/envelope';
import { PaginationQuerySchema } from '../common/pagination';
import { optionalText, text } from '../organization/common';

export const COUNTERPARTY_TYPES = ['INDIVIDUAL', 'MERCHANT', 'INSTITUTION', 'EMPLOYER', 'OTHER'] as const;
export const CounterpartyTypeSchema = z.enum(COUNTERPARTY_TYPES);
export type CounterpartyType = z.infer<typeof CounterpartyTypeSchema>;

export const CreateCounterpartySchema = z
  .object({
    name: text(1, 100),
    type: CounterpartyTypeSchema.default('OTHER'),
    defaultCategoryId: z.uuid().optional(),
    notes: optionalText(500).optional(),
  })
  .strict();
export type CreateCounterparty = z.infer<typeof CreateCounterpartySchema>;

export const UpdateCounterpartySchema = z
  .object({
    name: text(1, 100).optional(),
    type: CounterpartyTypeSchema.optional(),
    defaultCategoryId: z.uuid().nullable().optional(),
    notes: optionalText(500).optional(),
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
  type: CounterpartyTypeSchema.optional(),
  search: z.string().trim().max(100).optional(),
}).strict();
export type ListCounterpartiesQuery = z.infer<typeof ListCounterpartiesQuerySchema>;

export const CounterpartyResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  type: CounterpartyTypeSchema,
  defaultCategoryId: z.uuid().nullable(),
  notes: z.string().nullable(),
  transactionCount: z.number().int().optional(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type CounterpartyResponse = z.infer<typeof CounterpartyResponseSchema>;

export const CounterpartyEnvelopeSchema = dataEnvelope(CounterpartyResponseSchema);
export type CounterpartyEnvelope = z.infer<typeof CounterpartyEnvelopeSchema>;

export const CounterpartyListEnvelopeSchema = listEnvelope(CounterpartyResponseSchema);
export type CounterpartyListEnvelope = z.infer<typeof CounterpartyListEnvelopeSchema>;
