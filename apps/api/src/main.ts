import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { APP_CONFIG } from './platform/config/config.module';
import type { Env } from './platform/config/env.schema';
import { configureHttp } from './platform/http/configure-http';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const env = app.get<Env>(APP_CONFIG);
  configureHttp(app, env);
  await app.listen(env.PORT);
  // Version déployée (SHA de l'image) : journalisée, jamais exposée par HTTP (PHASE-03 §5).
  app.get(Logger).log({ appVersion: env.APP_VERSION, appEnv: env.APP_ENV }, 'api.started');
}

// Configuration invalide ou base indisponible au démarrage : message sans valeur, code de sortie non nul.
bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown startup failure';
  process.stderr.write(`[orbit-api] fatal: ${message}\n`);
  process.exitCode = 1;
});
