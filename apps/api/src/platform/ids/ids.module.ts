import { Global, Module } from '@nestjs/common';

import { UuidV7Generator } from './uuid-v7.generator';

/** Jeton d injection du port IdGeneratorPort (ADR-011). */
export const ID_GENERATOR = Symbol('ID_GENERATOR');

@Global()
@Module({
  providers: [{ provide: ID_GENERATOR, useClass: UuidV7Generator }],
  exports: [ID_GENERATOR],
})
export class IdsModule {}
