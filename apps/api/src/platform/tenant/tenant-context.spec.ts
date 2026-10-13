import { AsyncLocalStorage } from 'node:async_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import { ClsService } from 'nestjs-cls';
import { describe, expect, it } from 'vitest';

import { MissingTenantContextError, type OrbitClsStore, TenantContext } from './tenant-context';

function newTenant(): { tenant: TenantContext; cls: ClsService<OrbitClsStore> } {
  const cls = new ClsService<OrbitClsStore>(new AsyncLocalStorage());
  return { tenant: new TenantContext(cls), cls };
}

describe('TenantContext (ADR-007-2)', () => {
  it('has no user outside any request context and refuses to guess one', () => {
    const { tenant } = newTenant();

    expect(tenant.userId()).toBeUndefined();
    expect(() => tenant.requireUserId()).toThrow(MissingTenantContextError);
  });

  it('runs a task as a given user (worker, ADR-007-8) without leaking the context afterwards', async () => {
    const { tenant } = newTenant();

    const seen = await tenant.runAsUser('user-a', 'USER', () => Promise.resolve(tenant.requireUserId()));

    expect(seen).toBe('user-a');
    expect(tenant.userId()).toBeUndefined();
  });

  it('runs a lazy thenable (a Prisma query) inside the context, not after it', async () => {
    const { tenant } = newTenant();
    const lazyQuery: PromiseLike<string> = {
      then: (onFulfilled, onRejected) => {
        try {
          return Promise.resolve(tenant.requireUserId()).then(onFulfilled, onRejected);
        } catch (error: unknown) {
          return Promise.reject(error instanceof Error ? error : new Error(String(error))).then(
            onFulfilled,
            onRejected,
          );
        }
      },
    };

    await expect(tenant.runAsUser('user-a', 'USER', () => lazyQuery)).resolves.toBe('user-a');
  });

  it('keeps concurrent contexts isolated', async () => {
    const { tenant } = newTenant();
    const observe = (userId: string, delayMs: number) =>
      tenant.runAsUser(userId, 'USER', async () => {
        await sleep(delayMs);
        return tenant.requireUserId();
      });

    await expect(Promise.all([observe('user-a', 20), observe('user-b', 1)])).resolves.toEqual([
      'user-a',
      'user-b',
    ]);
  });

  it('attaches the authenticated session to the current request context', async () => {
    const { tenant, cls } = newTenant();

    await cls.run(() => {
      tenant.attachSession({ sessionId: 'session-1', userId: 'user-a', role: 'ADMIN' });

      expect(tenant.requireUserId()).toBe('user-a');
      expect(tenant.role()).toBe('ADMIN');
      expect(cls.get('sessionId')).toBe('session-1');
      return Promise.resolve();
    });
  });

  it('refuses to attach a session outside a request context', () => {
    const { tenant } = newTenant();

    expect(() => {
      tenant.attachSession({ sessionId: 's', userId: 'u', role: 'USER' });
    }).toThrow(MissingTenantContextError);
  });
});
