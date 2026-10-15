import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type ThrottlerOptions, ThrottlerStorageService } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';

import { Pseudonymizer } from '../auth/pseudonymizer';
import { DomainError } from '../errors/domain-error';

import { OrbitThrottlerGuard, rateLimitOptions } from './rate-limit';

const pseudonymizer = new Pseudonymizer('test-only-rate-limit-key-0123456789abcdef');

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

function throttler(name: string): ThrottlerOptions {
  const found = rateLimitOptions(true, pseudonymizer).throttlers.find((option) => option.name === name);
  if (found === undefined) throw new Error(`missing throttler ${name}`);
  return found;
}

describe('rateLimitOptions (SECURITY.md §3.7)', () => {
  it('defines public, user and e-mail throttlers with the default limits', () => {
    const { throttlers, setHeaders } = rateLimitOptions(true, pseudonymizer);

    expect(throttlers.map(({ name, limit, ttl }) => ({ name, limit, ttl }))).toEqual([
      { name: 'public', limit: 60, ttl: 60_000 },
      { name: 'user', limit: 300, ttl: 60_000 },
      { name: 'email', limit: Number.MAX_SAFE_INTEGER, ttl: 3_600_000 },
    ]);
    expect(setHeaders).toBe(false);
  });

  it('tracks anonymous clients by HMAC of their IP, never the IP itself', async () => {
    const request = { ip: '203.0.113.7' };

    const tracker = await throttler('public').getTracker?.(request, contextWith(request));

    expect(tracker).toBe(pseudonymizer.hex('203.0.113.7'));
    expect(tracker).not.toContain('203.0.113');
  });

  it('tracks authenticated users by user id and skips the matching other throttler', async () => {
    const authenticated = {
      ip: '203.0.113.7',
      orbitSession: { userId: 'user-1', sessionId: 's', role: 'USER' },
    };
    const anonymous = { ip: '203.0.113.7' };

    expect(await throttler('user').getTracker?.(authenticated, contextWith(authenticated))).toBe('user-1');
    expect(throttler('public').skipIf?.(contextWith(authenticated))).toBe(true);
    expect(throttler('user').skipIf?.(contextWith(anonymous))).toBe(true);
    expect(throttler('public').skipIf?.(contextWith(anonymous))).toBe(false);
  });

  it('tracks the normalised e-mail of the body by HMAC, and skips requests without one', async () => {
    const request = { body: { email: ' Aminata.Diop@Example.test ' } };

    expect(await throttler('email').getTracker?.(request, contextWith(request))).toBe(
      pseudonymizer.hex('aminata.diop@example.test'),
    );
    expect(throttler('email').skipIf?.(contextWith(request))).toBe(false);
    expect(throttler('email').skipIf?.(contextWith({ body: {} }))).toBe(true);
  });

  it('can be disabled (tests only; refused once deployed by the configuration)', () => {
    expect(rateLimitOptions(false, pseudonymizer).skipIf?.(contextWith({}))).toBe(true);
    expect(rateLimitOptions(true, pseudonymizer).skipIf?.(contextWith({}))).toBe(false);
    const disabled = rateLimitOptions(false, pseudonymizer).throttlers;
    expect(disabled.every((option) => option.skipIf?.(contextWith({ ip: '203.0.113.7' })) === true)).toBe(
      true,
    );
  });
});

describe('OrbitThrottlerGuard', () => {
  it('turns a throttling hit into RATE_LIMITED with the seconds to wait', async () => {
    const guard = new OrbitThrottlerGuard(
      rateLimitOptions(true, pseudonymizer),
      new ThrottlerStorageService(),
      new Reflector(),
    );
    const detail = {
      ttl: 60_000,
      limit: 60,
      key: 'k',
      tracker: 't',
      totalHits: 61,
      timeToExpire: 42,
      isBlocked: true,
      timeToBlockExpire: 42,
    };

    const error: unknown = await (
      guard as unknown as { throwThrottlingException: (c: unknown, d: unknown) => Promise<void> }
    )
      .throwThrottlingException(contextWith({}), detail)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('RATE_LIMITED');
    expect((error as DomainError).details).toEqual({ retryAfterSeconds: 42 });
  });
});
