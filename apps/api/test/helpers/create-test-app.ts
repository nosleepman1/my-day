import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { inject } from 'vitest';

import { AppModule } from '../../src/app.module';
import { APP_CONFIG } from '../../src/platform/config/config.module';
import type { Env } from '../../src/platform/config/env.schema';
import { configureHttp } from '../../src/platform/http/configure-http';

const TEST_ENV = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  APP_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
  MAIL_FROM: 'ORBIT <no-reply@orbit.localhost>',
} as const;

/**
 * Démarre l'application réelle (guards, pipes, filtres, en-têtes) sur la base de test Testcontainers.
 * La configuration passe par `process.env`, comme en production, puis est validée par `loadEnv` ;
 * `process.env` est restauré ensuite pour qu'aucune surcharge ne fuie vers les tests suivants.
 */
export async function createTestApp(
  overrides: Readonly<Record<string, string>> = {},
): Promise<INestApplication> {
  const previous = { ...process.env };
  Object.assign(process.env, TEST_ENV, { DATABASE_URL: inject('databaseUrl') }, overrides);
  try {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication<NestExpressApplication>({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    configureHttp(app, app.get<Env>(APP_CONFIG));
    await app.init();
    return app;
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in previous)) Reflect.deleteProperty(process.env, key);
    }
    Object.assign(process.env, previous);
  }
}
