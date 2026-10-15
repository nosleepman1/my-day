import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../errors/domain-error';

import { CsrfGuard, isCsrfSafe, SkipCsrf } from './csrf.guard';

const ORIGIN = 'https://orbit.example.com';
const VALID = { 'x-requested-with': 'orbit', origin: ORIGIN };

describe('isCsrfSafe (SECURITY.md §3.9)', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('lets the safe method %s through without any header', (method) => {
    expect(isCsrfSafe({ method, headers: {} }, ORIGIN)).toBe(true);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'accepts %s with the custom header and the app origin',
    (method) => {
      expect(isCsrfSafe({ method, headers: VALID }, ORIGIN)).toBe(true);
    },
  );

  it('accepts a same-origin fetch without Origin header', () => {
    expect(
      isCsrfSafe(
        { method: 'POST', headers: { 'x-requested-with': 'orbit', 'sec-fetch-site': 'same-origin' } },
        ORIGIN,
      ),
    ).toBe(true);
  });

  it.each([
    ['without the custom header', { origin: ORIGIN }],
    ['with another custom header value', { 'x-requested-with': 'XMLHttpRequest', origin: ORIGIN }],
    ['from another origin', { 'x-requested-with': 'orbit', origin: 'https://evil.example' }],
    ['from an opaque origin', { 'x-requested-with': 'orbit', origin: 'null' }],
    [
      'from a cross-site fetch without Origin',
      { 'x-requested-with': 'orbit', 'sec-fetch-site': 'cross-site' },
    ],
    ['without Origin nor Sec-Fetch-Site', { 'x-requested-with': 'orbit' }],
  ])('refuses a mutation %s', (_label, headers) => {
    expect(isCsrfSafe({ method: 'POST', headers }, ORIGIN)).toBe(false);
  });
});

class Routes {
  @SkipCsrf()
  webhook(): string {
    return 'webhook';
  }

  mutation(): string {
    return 'mutation';
  }
}

function contextFor(handler: () => string, request: { method: string; headers: Record<string, string> }) {
  return {
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const routes = new Routes();
  const logger = { warn: vi.fn() } as unknown as PinoLogger;
  const guard = new CsrfGuard(new Reflector(), ORIGIN, logger);

  it('answers CSRF_REJECTED and logs a warning for a forged mutation', () => {
    const error: unknown = (() => {
      try {
        return guard.canActivate(contextFor(routes.mutation, { method: 'POST', headers: {} }));
      } catch (caught: unknown) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('CSRF_REJECTED');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST' }),
      'security.csrf_rejected',
    );
  });

  it('lets a valid mutation and a @SkipCsrf() route through', () => {
    expect(guard.canActivate(contextFor(routes.mutation, { method: 'POST', headers: VALID }))).toBe(true);
    expect(guard.canActivate(contextFor(routes.webhook, { method: 'POST', headers: {} }))).toBe(true);
  });
});
