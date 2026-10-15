import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';

/** Journal d'audit (SECURITY.md §18) : service injectable et intercepteur global de `@Audited()`. */
@Global()
@Module({
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}
