import { z } from 'zod';

import { InstantSchema } from '../common/dates';
import { dataEnvelope } from '../common/envelope';
import { HexColorSchema, optionalText, text } from '../organization/common';

export const CATEGORY_KINDS = ['INCOME', 'EXPENSE'] as const;
export const CategoryKindSchema = z.enum(CATEGORY_KINDS);
export type CategoryKind = z.infer<typeof CategoryKindSchema>;

export const ECONOMIC_CLASSES = [
  'INCOME_OPERATING',
  'INCOME_EXTRAORDINARY',
  'EXPENSE_OPERATING',
  'EXPENSE_ESSENTIAL',
  'EXPENSE_EXTRAORDINARY',
  'TRANSFER_INTERNAL',
  'CAPITAL_INVESTMENT',
] as const;
export const EconomicClassSchema = z.enum(ECONOMIC_CLASSES);
export type EconomicClass = z.infer<typeof EconomicClassSchema>;

export const CreateCategorySchema = z
  .object({
    name: text(1, 100),
    kind: CategoryKindSchema,
    defaultEconomicClass: EconomicClassSchema,
    parentId: z.uuid().optional(),
    icon: optionalText(50).optional(),
    color: HexColorSchema.optional(),
  })
  .strict();
export type CreateCategory = z.infer<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z
  .object({
    name: text(1, 100).optional(),
    defaultEconomicClass: EconomicClassSchema.optional(),
    parentId: z.uuid().nullable().optional(),
    icon: optionalText(50).optional(),
    color: HexColorSchema.nullable().optional(),
  })
  .strict();
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;

export const ListCategoriesQuerySchema = z
  .object({
    kind: CategoryKindSchema.optional(),
    parentId: z.uuid().optional(),
  })
  .strict();
export type ListCategoriesQuery = z.infer<typeof ListCategoriesQuerySchema>;

export const CategoryResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: CategoryKindSchema,
  defaultEconomicClass: EconomicClassSchema,
  parentId: z.uuid().nullable(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: InstantSchema,
  updatedAt: InstantSchema,
});
export type CategoryResponse = z.infer<typeof CategoryResponseSchema>;

export const CategoryEnvelopeSchema = dataEnvelope(CategoryResponseSchema);
export type CategoryEnvelope = z.infer<typeof CategoryEnvelopeSchema>;

export const CategoryListEnvelopeSchema = z.object({ data: z.array(CategoryResponseSchema) });
export type CategoryListEnvelope = z.infer<typeof CategoryListEnvelopeSchema>;
