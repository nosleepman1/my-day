import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { DomainError } from '../errors/domain-error';
import type { TenantContext } from '../tenant/tenant-context';

import { Public } from './public.decorator';
import { SessionAuthGuard } from './session-auth.guard';
import type { AuthenticatedRequest } from './session-context';
import type { AuthenticatedSession, SessionResolverPort } from './session-resolver.port';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE';
const SESSION: AuthenticatedSession = { sessionId: 'session-1', userId: 'user-1', role: 'USER' };

class PublicController {
  @Public()
  open(): string {
    return 'open';
  }

  closed(): string {
    return 'closed';
  }
}

function contextFor(handler: () => string, request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => PublicController,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function fakeTenant(): TenantContext & { attachSession: ReturnType<typeof vi.fn> } {
  return { attachSession: vi.fn() } as unknown as TenantContext & { attachSession: ReturnType<typeof vi.fn> };
}

function resolverReturning(session: AuthenticatedSession | null): SessionResolverPort & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    resolve: (token: string) => {
      calls.push(token);
      return Promise.resolve(session);
    },
  };
}

describe('SessionAuthGuard (SECURITY.md §3.1)', () => {
  const controller = new PublicController();

  it('lets @Public() routes through without looking at the cookie', async () => {
    const resolver = resolverReturning(null);
    const guard = new SessionAuthGuard(new Reflector(), resolver, fakeTenant());

    await expect(guard.canActivate(contextFor(controller.open, { headers: {} }))).resolves.toBe(true);
    expect(resolver.calls).toHaveLength(0);
  });

  it('attaches the resolved session to the request', async () => {
    const request: AuthenticatedRequest = { headers: { cookie: `__Host-orbit_sid=${TOKEN}` } };
    const resolver = resolverReturning(SESSION);
    const tenant = fakeTenant();

    await expect(
      new SessionAuthGuard(new Reflector(), resolver, tenant).canActivate(
        contextFor(controller.closed, request),
      ),
    ).resolves.toBe(true);
    expect(resolver.calls).toEqual([TOKEN]);
    expect(tenant.attachSession).toHaveBeenCalledWith(SESSION);
    expect(request.orbitSession).toEqual(SESSION);
  });

  it.each([
    ['without a cookie', {}, SESSION],
    ['with a malformed cookie', { cookie: '__Host-orbit_sid=short' }, SESSION],
    ['when the session is not valid', { cookie: `__Host-orbit_sid=${TOKEN}` }, null],
  ])('answers UNAUTHENTICATED %s', async (_label, headers, session) => {
    const guard = new SessionAuthGuard(new Reflector(), resolverReturning(session), fakeTenant());

    const error: unknown = await guard
      .canActivate(contextFor(controller.closed, { headers }))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('UNAUTHENTICATED');
  });
});
