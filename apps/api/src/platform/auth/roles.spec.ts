import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../audit/audit.service';
import { DomainError } from '../errors/domain-error';

import { Roles, RolesGuard } from './roles';
import type { UserRole } from './session-resolver.port';

class Routes {
  @Roles('ADMIN')
  adminOnly(): string {
    return 'admin';
  }

  open(): string {
    return 'open';
  }
}

function contextFor(handler: () => string, role: UserRole | null): ExecutionContext {
  const request = {
    headers: {},
    ip: '203.0.113.7',
    ...(role === null ? {} : { orbitSession: { sessionId: 's', userId: 'user-1', role } }),
  };
  return {
    getHandler: () => handler,
    getClass: () => Routes,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard (ADR-002, SECURITY.md §6.2)', () => {
  const routes = new Routes();

  function guard() {
    const record = vi.fn().mockResolvedValue(undefined);
    return { guard: new RolesGuard(new Reflector(), { record } as unknown as AuditService), record };
  }

  it('lets routes without @Roles() and matching roles through', async () => {
    const { guard: rolesGuard } = guard();

    await expect(rolesGuard.canActivate(contextFor(routes.open, 'USER'))).resolves.toBe(true);
    await expect(rolesGuard.canActivate(contextFor(routes.adminOnly, 'ADMIN'))).resolves.toBe(true);
  });

  it.each([
    ['a USER', 'USER' as const],
    ['a request without session', null],
  ])('answers 404 and audits role_denied for %s', async (_label, role) => {
    const { guard: rolesGuard, record } = guard();

    const error: unknown = await rolesGuard
      .canActivate(contextFor(routes.adminOnly, role))
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe('NOT_FOUND');
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'authz.role_denied',
        outcome: 'DENIED',
        metadata: { required: 'ADMIN' },
      }),
    );
  });
});
