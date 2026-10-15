import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail, type ThrottlerModuleOptions } from '@nestjs/throttler';

import { normalizeEmail } from '@orbit/contracts';

import type { Pseudonymizer } from '../auth/pseudonymizer';
import { DomainError } from '../errors/domain-error';

import { defaultMessageOf } from './error-mapping';
import { ipThrottleKey } from './ip-prefix';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

interface ThrottledRequest {
  ip?: string;
  orbitSession?: { userId: string };
  body?: unknown;
}

type RateLimitOptions = Extract<ThrottlerModuleOptions, { throttlers: unknown }>;

function requestOf(context: ExecutionContext): ThrottledRequest {
  return context.switchToHttp().getRequest<ThrottledRequest>();
}

function emailOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null || !('email' in body)) return null;
  const { email } = body;
  return typeof email === 'string' && email.trim() !== '' ? email : null;
}

/**
 * Limites par défaut (SECURITY.md §3.7) : 60/min par IP sur les routes publiques, 300/min par utilisateur
 * sur les routes authentifiées ; le limiteur `email` ne s'applique qu'aux routes qui le configurent.
 * Les clés ne contiennent jamais d'IP ni d'e-mail en clair (HMAC). Le guard s'exécute après celui de session.
 */
export function rateLimitOptions(enabled: boolean, pseudonymizer: Pseudonymizer): RateLimitOptions {
  // Le skipIf d'un limiteur remplace celui du module (throttler v6) : la désactivation est répétée partout.
  const unless =
    (condition: (context: ExecutionContext) => boolean) =>
    (context: ExecutionContext): boolean =>
      !enabled || condition(context);
  return {
    skipIf: () => !enabled,
    setHeaders: false,
    throttlers: [
      {
        name: 'public',
        ttl: MINUTE_MS,
        limit: 60,
        getTracker: (request) =>
          pseudonymizer.hex(ipThrottleKey((request as ThrottledRequest).ip ?? null) ?? 'unknown'),
        skipIf: unless((context) => requestOf(context).orbitSession !== undefined),
      },
      {
        name: 'user',
        ttl: MINUTE_MS,
        limit: 300,
        getTracker: (request) => (request as ThrottledRequest).orbitSession?.userId ?? '',
        skipIf: unless((context) => requestOf(context).orbitSession === undefined),
      },
      {
        name: 'email',
        ttl: HOUR_MS,
        limit: Number.MAX_SAFE_INTEGER,
        getTracker: (request) =>
          pseudonymizer.hex(normalizeEmail(emailOf((request as ThrottledRequest).body) ?? '')),
        skipIf: unless((context) => emailOf(requestOf(context).body) === null),
      },
    ],
  };
}

/** Limites propres aux routes d'authentification (SECURITY.md §3.7), pour `@Throttle(...)`. */
export const AUTH_ROUTE_LIMITS = {
  login: { public: { limit: 20, ttl: 10 * MINUTE_MS } },
  register: { public: { limit: 5, ttl: HOUR_MS }, email: { limit: 3, ttl: HOUR_MS } },
  verifyEmail: { public: { limit: 20, ttl: HOUR_MS } },
  resendVerification: { public: { limit: 10, ttl: HOUR_MS }, email: { limit: 3, ttl: HOUR_MS } },
  forgotPassword: { public: { limit: 10, ttl: HOUR_MS }, email: { limit: 3, ttl: HOUR_MS } },
  resetPassword: { public: { limit: 10, ttl: HOUR_MS } },
  reauth: { user: { limit: 5, ttl: 15 * MINUTE_MS } },
  changeEmail: { user: { limit: 5, ttl: HOUR_MS } },
} as const;

/** `429 RATE_LIMITED` au format de l'API ; le filtre global pose `Retry-After` depuis `details`. */
export class OrbitThrottlerGuard extends ThrottlerGuard {
  protected override throwThrottlingException(
    _context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    const retryAfterSeconds = Math.max(1, Math.ceil(detail.timeToBlockExpire));
    return Promise.reject(
      new DomainError('RATE_LIMITED', defaultMessageOf('RATE_LIMITED'), { retryAfterSeconds }),
    );
  }
}
