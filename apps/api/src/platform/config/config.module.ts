import { Global, Module } from '@nestjs/common';

import { loadEnv } from './env.schema';

/** Jeton d'injection de la configuration validée (`Env`). */
export const APP_CONFIG = Symbol('APP_CONFIG');

/** Seul point de lecture de `process.env` de l'application (ARCHITECTURE.md §9). */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadEnv(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
