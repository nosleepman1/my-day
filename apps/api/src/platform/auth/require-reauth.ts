import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DomainError } from '../errors/domain-error';
import { defaultMessageOf } from '../http/error-mapping';
import { CLOCK, type ClockPort } from '../time/clock.port';

import type { AuthenticatedRequest } from './session-context';

const REQUIRE_REAUTH_KEY = 'orbit:requireReauth';
/** SECURITY.md §4 : 10 minutes pour les actions sensibles (5 min pour la révélation d'un secret). */
export const DEFAULT_REAUTH_MAX_AGE_SECONDS = 600;

/** Exige une ré-authentification récente (`POST /auth/reauth`) sur la session courante. */
export const RequireReauth = (maxAgeSeconds: number = DEFAULT_REAUTH_MAX_AGE_SECONDS): MethodDecorator =>
  SetMetadata(REQUIRE_REAUTH_KEY, maxAgeSeconds);

/** Guard global, après celui de session : `403 REAUTH_REQUIRED` avec `details.maxAgeSeconds`. */
@Injectable()
export class RecentAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CLOCK) private readonly clock: ClockPort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const maxAgeSeconds = this.reflector.get<number | undefined>(REQUIRE_REAUTH_KEY, context.getHandler());
    if (maxAgeSeconds === undefined) return true;
    const reauthAt = context.switchToHttp().getRequest<AuthenticatedRequest>().orbitSession?.reauthAt ?? null;
    const ageMs =
      reauthAt === null ? Number.POSITIVE_INFINITY : this.clock.now().getTime() - reauthAt.getTime();
    if (ageMs <= maxAgeSeconds * 1_000) return true;
    throw new DomainError('REAUTH_REQUIRED', defaultMessageOf('REAUTH_REQUIRED'), { maxAgeSeconds });
  }
}
