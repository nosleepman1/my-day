import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

import { AuditModule } from './audit/audit.module';
import { PasswordHasherModule } from './auth/password-hasher.module';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { GlobalExceptionFilter } from './http/global-exception.filter';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { IdsModule } from './ids/ids.module';
import { MailModule } from './mail/mail.module';
import { HealthController } from './observability/health.controller';
import { ObservabilityModule } from './observability/observability.module';
import { TenantModule } from './tenant/tenant.module';
import { TimeModule } from './time/time.module';

/**
 * Socle transverse de l'API (ARCHITECTURE.md §8) : configuration, logs, base, identifiants,
 * validation Zod des entrées, filtrage Zod des réponses et format d'erreur unique.
 */
@Module({
  imports: [
    ConfigModule,
    ObservabilityModule,
    TenantModule,
    AuditModule,
    IdempotencyModule,
    DatabaseModule,
    IdsModule,
    TimeModule,
    MailModule,
    PasswordHasherModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
})
export class PlatformModule {}
