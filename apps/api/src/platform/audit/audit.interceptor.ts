import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, from, mergeMap, type Observable, throwError } from 'rxjs';

import type { AuditAction } from '@orbit/contracts';

import type { AuthenticatedRequest } from '../auth/session-context';
import { DomainError } from '../errors/domain-error';
import { type ClientRequestLike, clientContextFrom } from '../http/client-context';

import { AuditService } from './audit.service';

const AUDITED_KEY = 'orbit:audited';

/** Audite la route décorée : `SUCCESS`, ou `FAILURE` avec le code d'erreur de l'API (SECURITY.md §18). */
export const Audited = (action: AuditAction): MethodDecorator => SetMetadata(AUDITED_KEY, action);

type AuditedRequest = AuthenticatedRequest & ClientRequestLike;

/** Intercepteur global : ne fait rien sur une route sans `@Audited()`. */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<AuditAction | undefined>(AUDITED_KEY, context.getHandler());
    if (action === undefined) return next.handle();
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const record = (outcome: 'SUCCESS' | 'FAILURE', code?: string) =>
      this.audit.record({
        action,
        userId: request.orbitSession?.userId ?? null,
        outcome,
        ip: clientContextFrom(request).ip,
        ...(code === undefined ? {} : { metadata: { code } }),
      });
    return next.handle().pipe(
      mergeMap(async (value: unknown) => {
        await record('SUCCESS');
        return value;
      }),
      catchError((error: unknown) =>
        from(record('FAILURE', error instanceof DomainError ? error.code : 'INTERNAL_ERROR')).pipe(
          mergeMap(() => throwError(() => error)),
        ),
      ),
    );
  }
}
