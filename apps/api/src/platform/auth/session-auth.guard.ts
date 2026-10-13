import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { DomainError } from '../errors/domain-error';
import { defaultMessageOf } from '../http/error-mapping';
import { TenantContext } from '../tenant/tenant-context';

import { IS_PUBLIC_KEY } from './public.decorator';
import type { AuthenticatedRequest } from './session-context';
import { readSessionToken } from './session-cookie';
import { SESSION_RESOLVER, type SessionResolverPort } from './session-resolver.port';

function unauthenticated(): DomainError {
  return new DomainError('UNAUTHENTICATED', defaultMessageOf('UNAUTHENTICATED'));
}

/**
 * Guard global (SECURITY.md §3.1) : toute route exige une session valide, sauf `@Public()`.
 * Un échec ne distingue jamais sa cause : cookie absent, mal formé, session révoquée ou expirée → 401.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SESSION_RESOLVER) private readonly sessions: SessionResolverPort,
    private readonly tenant: TenantContext,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookie = request.headers['cookie'];
    const token = readSessionToken(typeof cookie === 'string' ? cookie : undefined);
    if (token === null) throw unauthenticated();
    const session = await this.sessions.resolve(token);
    if (session === null) throw unauthenticated();
    request.orbitSession = session;
    // Contexte CLS : lu par le client Prisma cloisonné et, plus tard, par l'audit (ADR-007-2).
    this.tenant.attachSession(session);
    return true;
  }
}
