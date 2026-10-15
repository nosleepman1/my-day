import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';
import type { IdGeneratorPort } from '../ids/id-generator.port';
import { IdsModule, ID_GENERATOR } from '../ids/ids.module';

import { createErrorReporter, ERROR_REPORTER } from './error-reporter';
import { buildLoggerParams } from './logger.options';

/** Logs structurés pino (avec `requestId` et masquage) et suivi d'erreurs, partagés par l'API et le worker. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [IdsModule],
      inject: [APP_CONFIG, ID_GENERATOR],
      useFactory: (env: Env, ids: IdGeneratorPort) => buildLoggerParams(env, ids),
    }),
  ],
  providers: [{ provide: ERROR_REPORTER, inject: [APP_CONFIG], useFactory: createErrorReporter }],
  exports: [LoggerModule, ERROR_REPORTER],
})
export class ObservabilityModule {}
