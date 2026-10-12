import { Global, Module } from '@nestjs/common';

import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';

import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PASSWORD_HASHER, type PasswordHasherPort } from './password-hasher.port';

/** Hachage argon2id paramétré par `ARGON2_MEMORY_KIB` et `ARGON2_ITERATIONS` (ADR-006, ADR-039). */
@Global()
@Module({
  providers: [
    {
      provide: PASSWORD_HASHER,
      inject: [APP_CONFIG],
      useFactory: (env: Env): PasswordHasherPort =>
        new Argon2PasswordHasher({
          memoryCost: env.ARGON2_MEMORY_KIB,
          timeCost: env.ARGON2_ITERATIONS,
          parallelism: 1,
        }),
    },
  ],
  exports: [PASSWORD_HASHER],
})
export class PasswordHasherModule {}
