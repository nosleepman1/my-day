import { describe, expect, it } from 'vitest';

import { ApiError, ContractError, NetworkError } from '@/lib/http/client';

import { createQueryClient, shouldRetry } from './query-client';

describe('query retry policy (FRONTEND.md §3.4)', () => {
  it('never retries client errors or contract violations', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND', undefined, 'r'))).toBe(false);
    expect(shouldRetry(0, new ContractError('bad body'))).toBe(false);
  });

  it('retries server and network failures twice', () => {
    const serverError = new ApiError(503, 'SERVICE_UNAVAILABLE', undefined, 'r');
    expect(shouldRetry(0, serverError)).toBe(true);
    expect(shouldRetry(1, new NetworkError('down'))).toBe(true);
    expect(shouldRetry(2, serverError)).toBe(false);
  });

  it('never retries mutations', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});

describe('global 401 handling', () => {
  async function failWith(error: ApiError): Promise<number> {
    let calls = 0;
    const client = createQueryClient({
      onUnauthorized: () => {
        calls += 1;
      },
    });
    await client
      .query({ queryKey: ['probe'], queryFn: () => Promise.reject(error), retry: false })
      .catch(() => undefined);
    return calls;
  }

  it('signs out on an expired session only, never on wrong credentials', async () => {
    await expect(failWith(new ApiError(401, 'UNAUTHENTICATED', undefined, 'r'))).resolves.toBe(1);
    await expect(failWith(new ApiError(401, 'INVALID_CREDENTIALS', undefined, 'r'))).resolves.toBe(0);
  });
});
