import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import { DomainError } from '../errors/domain-error';
import { defaultMessageOf } from '../http/error-mapping';

import type { AuthenticatedSession } from './session-resolver.port';

/** Requête après passage du guard global ; le contexte CLS prendra le relais en T7. */
export interface AuthenticatedRequest {
  headers: Readonly<Record<string, string | string[] | undefined>>;
  orbitSession?: AuthenticatedSession;
}

/** Paramètre de contrôleur : `@CurrentSession() session: AuthenticatedSession` (routes non publiques). */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const session = context.switchToHttp().getRequest<AuthenticatedRequest>().orbitSession;
    if (session === undefined) {
      throw new DomainError('UNAUTHENTICATED', defaultMessageOf('UNAUTHENTICATED'));
    }
    return session;
  },
);
