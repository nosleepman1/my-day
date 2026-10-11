import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './http/global-exception.filter';
import { IdsModule } from './ids/ids.module';
import { HealthController } from './observability/health.controller';
import { ObservabilityModule } from './observability/observability.module';

/**
 * Socle transverse de l'API (ARCHITECTURE.md §8) : configuration, logs, base, identifiants,
 * validation Zod des entrées, filtrage Zod des réponses et format d'erreur unique.
 */
@Module({
  imports: [ConfigModule, ObservabilityModule, DatabaseModule, IdsModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class PlatformModule {}
