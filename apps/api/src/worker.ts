import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { WorkerModule } from './worker.module';

/** Worker : processus distinct de l'API (ADR-012). Vide jusqu'à PHASE-08 ; démarre et s'arrête proprement. */
async function bootstrapWorker(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();
  logger.log('worker.started');
}

bootstrapWorker().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'unknown startup failure';
  process.stderr.write(`[orbit-worker] fatal: ${message}\n`);
  process.exitCode = 1;
});
