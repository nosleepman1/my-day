import { type CanActivate, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuditService } from '../audit/audit.service';
import { DomainError } from '../errors/domain-error';
import { type ClientRequestLike, clientContextFrom } from '../http/client-context';
import { defaultMessageOf } from '../http/error-mapping';

import type { AuthenticatedRequest } from './session-context';
import type { UserRole } from './session-resolver.port';

const ROLES_KEY = 'orbit:roles';

/** Rôles autorisés sur une route ou un contrôleur (ADR-002) ; la zone Dev et l'admin exigent `ADMIN`. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/**
 * Guard global, après celui de session. Un rôle insuffisant répond `404 NOT_FOUND` : un `USER` ne distingue
 * pas une route ADMIN d'une route inexistante (SECURITY.md §6.2). Audit `authz.role_denied`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & ClientRequestLike>();
    const session = request.orbitSession;
    if (session !== undefined && roles.includes(session.role)) return true;
    await this.audit.record({
      action: 'authz.role_denied',
      userId: session?.userId ?? null,
      outcome: 'DENIED',
      ip: clientContextFrom(request).ip,
      metadata: { required: roles.join(',') },
    });
    throw new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
  }
}
