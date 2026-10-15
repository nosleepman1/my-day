import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';

import { DomainError } from '../errors/domain-error';
import { FixedClock } from '../time/fixed-clock';

import { RecentAuthGuard, RequireReauth } from './require-reauth';

const NOW = new Date('2026-10-13T09:30:00.000Z');

class Routes {
  @RequireReauth()
  sensitive(): string {
    return 'sensitive';
  }

  @RequireReauth(300)
  verySensitive(): string {
    return 'very';
  }

  ordinary(): string {
    return 'ordinary';
  }
}

function contextFor(handler: () => string, reauthAt: Date | null): ExecutionContext {
  const request = { headers: {}, orbitSession: { sessionId: 's', userId: 'u', role: 'USER', reauthAt } };
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const minutesAgo = (minutes: number): Date => new Date(NOW.getTime() - minutes * 60_000);

describe('RecentAuthGuard (SECURITY.md §4)', () => {
  const routes = new Routes();
  const guard = new RecentAuthGuard(new Reflector(), new FixedClock(NOW));

  it('ignores routes without @RequireReauth()', () => {
    expect(guard.canActivate(contextFor(routes.ordinary, null))).toBe(true);
  });

  it('accepts a re-authentication within the window (10 minutes by default)', () => {
    expect(guard.canActivate(contextFor(routes.sensitive, minutesAgo(9)))).toBe(true);
  });

  it.each([
    ['never re-authenticated', routes.sensitive, null, 600],
    ['re-authenticated too long ago', routes.sensitive, minutesAgo(11), 600],
    ['outside a shorter custom window', routes.verySensitive, minutesAgo(6), 300],
  ])('answers REAUTH_REQUIRED when %s', (_label, handler, reauthAt, maxAgeSeconds) => {
    const error: unknown = (() => {
      try {
        return guard.canActivate(contextFor(handler, reauthAt));
      } catch (caught: unknown) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('REAUTH_REQUIRED');
    expect((error as DomainError).details).toEqual({ maxAgeSeconds });
  });
});
