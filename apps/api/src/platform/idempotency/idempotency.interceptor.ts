import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { of, type Observable } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { DomainError } from '../errors/domain-error';
import { TenantContext } from '../tenant/tenant-context';

import { canonicalJsonHash } from './canonical-json';
import { IdempotencyService } from './idempotency.service';
import { IDEMPOTENT_METADATA_KEY, type IdempotentOptions } from './idempotent.decorator';

function extractIdempotencyKey(req: Request): string | undefined {
  const rawKey = req.headers['idempotency-key'] ?? req.headers['Idempotency-Key'];
  return Array.isArray(rawKey) ? rawKey[0] : rawKey;
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
    private readonly tenant: TenantContext,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const options = this.reflector.get<IdempotentOptions | undefined>(
      IDEMPOTENT_METADATA_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const key = extractIdempotencyKey(req);

    if (!key) {
      if (options.required !== false) {
        throw new DomainError(
          'IDEMPOTENCY_KEY_REQUIRED',
          'En-tête Idempotency-Key obligatoire sur cette opération.',
          { field: 'Idempotency-Key' },
        );
      }
      return next.handle();
    }

    const userId = this.tenant.requireUserId();
    const routePath = (req.route as { path?: string } | undefined)?.path;
    const scope = options.scope ?? `${req.method} ${routePath ?? req.path}`;
    const requestHash = canonicalJsonHash(req.body);

    const started = await this.idempotency.start({ userId, scope, key, requestHash });
    if (started.status === 'REPLAYED') {
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(started.responseStatus);
      return of(started.responseBody);
    }

    return next.handle().pipe(
      tap({
        next: (responseBody) => {
          void this.idempotency.complete({
            userId,
            scope,
            key,
            responseStatus: res.statusCode || 200,
            responseBody,
          });
        },
      }),
      catchError((err: unknown) => {
        void this.idempotency.abort(userId, scope, key);
        throw err;
      }),
    );
  }
}
