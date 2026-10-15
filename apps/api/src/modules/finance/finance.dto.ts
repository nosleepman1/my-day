import { createZodDto } from 'nestjs-zod';

import {
  AccountEnvelopeSchema,
  AccountListEnvelopeSchema,
  CloseAccountSchema,
  CreateAccountSchema,
  IdParamSchema,
  ListAccountsQuerySchema,
  ReopenAccountSchema,
  UpdateAccountSchema,
} from '@orbit/contracts';

export class IdParamDto extends createZodDto(IdParamSchema) {}

export class CreateAccountDto extends createZodDto(CreateAccountSchema) {}
export class UpdateAccountDto extends createZodDto(UpdateAccountSchema) {}
export class CloseAccountDto extends createZodDto(CloseAccountSchema) {}
export class ReopenAccountDto extends createZodDto(ReopenAccountSchema) {}
export class ListAccountsQueryDto extends createZodDto(ListAccountsQuerySchema) {}

export class AccountEnvelopeDto extends createZodDto(AccountEnvelopeSchema) {}
export class AccountListEnvelopeDto extends createZodDto(AccountListEnvelopeSchema) {}
