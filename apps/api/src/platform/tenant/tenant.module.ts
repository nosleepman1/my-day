import { Global, Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';

import { TenantContext } from './tenant-context';

/** `request.id` est posé par le premier middleware (configure-http) : le contexte CLS en hérite. */
function requestIdOf(request: { id?: unknown }): string {
  return typeof request.id === 'string' ? request.id : '';
}

/** Contexte de requête nestjs-cls, ouvert pour chaque requête HTTP avant les guards (ADR-007-2). */
@Global()
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true, idGenerator: requestIdOf },
    }),
  ],
  providers: [TenantContext],
  exports: [TenantContext],
})
export class TenantModule {}
