import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';
import type { IdGeneratorPort } from '../ids/id-generator.port';
import { IdsModule, ID_GENERATOR } from '../ids/ids.module';

import { buildLoggerParams } from './logger.options';

/** Logs structurés pino (avec `requestId` et masquage) partagés par l'API et le worker. */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [IdsModule],
      inject: [APP_CONFIG, ID_GENERATOR],
      useFactory: (env: Env, ids: IdGeneratorPort) => buildLoggerParams(env, ids),
    }),
  ],
  exports: [LoggerModule],
})
export class ObservabilityModule {}
