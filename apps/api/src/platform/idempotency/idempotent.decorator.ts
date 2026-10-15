import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'orbit:idempotent';

export interface IdempotentOptions {
  /** Indique si l'en-tête Idempotency-Key est strictement obligatoire (API.md §9.3). Défaut: true */
  readonly required?: boolean;
  /** Portée de l'opération (ex: 'POST /finance/transactions'). Si omis, dérivé de la méthode et route. */
  readonly scope?: string;
}

export function Idempotent(options: IdempotentOptions = { required: true }): CustomDecorator {
  return SetMetadata(IDEMPOTENT_METADATA_KEY, options);
}
