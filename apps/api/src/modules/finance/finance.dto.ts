import { createZodDto } from 'nestjs-zod';

import {
  AccountEnvelopeSchema,
  AccountListEnvelopeSchema,
  CategoryEnvelopeSchema,
  CategoryListEnvelopeSchema,
  CloseAccountSchema,
  CreateAccountSchema,
  CreateCategorySchema,
  IdParamSchema,
  ListAccountsQuerySchema,
  ListCategoriesQuerySchema,
  ReopenAccountSchema,
  UpdateAccountSchema,
  UpdateCategorySchema,
} from '@orbit/contracts';

export class IdParamDto extends createZodDto(IdParamSchema) {}

export class CreateAccountDto extends createZodDto(CreateAccountSchema) {}
export class UpdateAccountDto extends createZodDto(UpdateAccountSchema) {}
export class CloseAccountDto extends createZodDto(CloseAccountSchema) {}
export class ReopenAccountDto extends createZodDto(ReopenAccountSchema) {}
export class ListAccountsQueryDto extends createZodDto(ListAccountsQuerySchema) {}

export class AccountEnvelopeDto extends createZodDto(AccountEnvelopeSchema) {}
export class AccountListEnvelopeDto extends createZodDto(AccountListEnvelopeSchema) {}

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
export class ListCategoriesQueryDto extends createZodDto(ListCategoriesQuerySchema) {}

export class CategoryEnvelopeDto extends createZodDto(CategoryEnvelopeSchema) {}
export class CategoryListEnvelopeDto extends createZodDto(CategoryListEnvelopeSchema) {}
