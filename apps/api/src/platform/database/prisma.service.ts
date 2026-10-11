import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { APP_CONFIG } from '../config/config.module';
import type { Env } from '../config/env.schema';

/**
 * Client Prisma unique de l'application. La connexion est ouverte au démarrage pour que la première
 * sonde `/health/ready` ne paie pas le démarrage à froid ; un échec n'empêche pas l'API de démarrer,
 * `/health/ready` le signale (503). L'extension `tenantScope` arrive en PHASE-01 (ADR-007).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(
    @Inject(APP_CONFIG) env: Env,
    @InjectPinoLogger(PrismaService.name) private readonly logger: PinoLogger,
  ) {
    super({ datasourceUrl: env.DATABASE_URL });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error: unknown) {
      this.logger.warn({ err: error }, 'database.connect_failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
