import { describe, expect, it } from 'vitest';

import { ERROR_HTTP_STATUS, ErrorCode, httpStatusOf } from './error-codes';

describe('ErrorCode', () => {
  it('maps every code to an HTTP error status', () => {
    for (const code of Object.values(ErrorCode)) {
      const status = ERROR_HTTP_STATUS[code];
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status, code).toBeLessThan(600);
    }
  });

  it.each([
    ['VALIDATION_FAILED', 400],
    ['UNAUTHENTICATED', 401],
    ['CSRF_REJECTED', 403],
    ['NOT_FOUND', 404],
    ['CONFLICT', 409],
    ['INSUFFICIENT_FUNDS', 422],
    ['RATE_LIMITED', 429],
    ['INTERNAL_ERROR', 500],
    ['SERVICE_UNAVAILABLE', 503],
  ] as const)('%s is served with %d (API.md §5.2)', (code, status) => {
    expect(httpStatusOf(code)).toBe(status);
  });

  it('uses the code itself as its value', () => {
    for (const [key, value] of Object.entries(ErrorCode)) expect(value).toBe(key);
  });
});
