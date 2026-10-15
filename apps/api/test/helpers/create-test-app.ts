import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Logger, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { inject } from 'vitest';

import { AppModule } from '../../src/app.module';
import { APP_CONFIG } from '../../src/platform/config/config.module';
import { type Env, EnvSchema } from '../../src/platform/config/env.schema';
import { configureHttp } from '../../src/platform/http/configure-http';
import type { IdGeneratorPort } from '../../src/platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../src/platform/ids/ids.module';
import { CapturingMailAdapter } from '../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../src/platform/mail/mail.port';
import { buildLoggerParams } from '../../src/platform/observability/logger.options';

const TEST_ENV = {
  NODE_ENV: 'test',
  APP_ENV: 'test',
  APP_ORIGIN: 'http://localhost:5173',
  LOG_LEVEL: 'silent',
  MAIL_FROM: 'ORBIT <no-reply@orbit.localhost>',
  // Hachage rapide et aucune durée plancher : les tests restent rapides (valeurs refusées en déploiement).
  ARGON2_MEMORY_KIB: '1024',
  ARGON2_ITERATIONS: '1',
  AUTH_UNIFORM_RESPONSE_MS: '0',
  RATE_LIMIT_HMAC_KEY: 'test-only-rate-limit-key-0123456789abcdef',
  // Limitation par IP désactivée par défaut ; les tests de protections la réactivent.
  RATE_LIMIT_ENABLED: 'false',
  LOGIN_DELAY_UNIT_MS: '0',
} as const;

/** Toutes les variables lues par `loadEnv`, y compris les variantes `<NOM>_FILE` des secrets. */
export type TestAppOptions = Readonly<{
  /** Capture des journaux pino (niveau `LOG_LEVEL`) pour vérifier qu'aucun secret n'y figure. */
  logDestination?: DestinationStream;
}>;

const CONFIG_KEYS = Object.keys(EnvSchema.shape).flatMap((key) => [key, `${key}_FILE`]);

/**
 * Démarre l'application réelle (guards, pipes, filtres, en-têtes) sur la base de test Testcontainers.
 * La configuration passe par `process.env`, comme en production, puis est validée par `loadEnv` ;
 * `process.env` est restauré ensuite pour qu'aucune surcharge ne fuie vers les tests suivants.
 *
 * Le client Prisma charge `apps/api/.env` dans `process.env` dès son import : toute variable de
 * configuration de la machine est donc retirée d'abord, pour que seuls `TEST_ENV` et `overrides` comptent.
 */
export async function createTestApp(
  overrides: Readonly<Record<string, string>> = {},
  options: TestAppOptions = {},
): Promise<INestApplication> {
  const previous = { ...process.env };
  for (const key of CONFIG_KEYS) Reflect.deleteProperty(process.env, key);
  Object.assign(process.env, TEST_ENV, { DATABASE_URL: inject('databaseUrl') }, overrides);
  try {
    // Aucun e-mail ne part : `app.get(MAIL)` renvoie le CapturingMailAdapter de l'application.
    const builder = Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MAIL)
      .useValue(new CapturingMailAdapter());
    const { logDestination } = options;
    const moduleRef = await (
      logDestination === undefined
        ? builder
        : builder.overrideProvider(PARAMS_PROVIDER_TOKEN).useFactory({
            factory: (env: Env, ids: IdGeneratorPort) => buildLoggerParams(env, ids, logDestination),
            inject: [APP_CONFIG, ID_GENERATOR],
          })
    ).compile();
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
