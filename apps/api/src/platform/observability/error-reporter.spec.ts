import { describe, expect, it } from 'vitest';

import type { Env } from '../config/env.schema';

import { createErrorReporter, NOOP_ERROR_REPORTER, scrubEvent } from './error-reporter';

describe('error reporter (INFRASTRUCTURE.md §12.4)', () => {
  it('removes cookies, headers, body, query string, IP and personal user fields', () => {
    const event = scrubEvent({
      message: 'boom',
      request: {
        method: 'POST',
        url: 'https://api.example.com/api/v1/auth/login?email=a@example.com',
        cookies: { __Host_orbit_sid: 'secret' },
        headers: { authorization: 'Bearer x', cookie: 'y' },
        data: { password: 'p' },
        query_string: 'email=a@example.com',
      },
      user: { id: '0192f3a4-5b6c-7d8e-9f01-23456789abcd', email: 'a@example.com', ip_address: '1.2.3.4' },
    });

    expect(event).toEqual({
      message: 'boom',
      request: { method: 'POST', url: 'https://api.example.com/api/v1/auth/login' },
      user: { id: '0192f3a4-5b6c-7d8e-9f01-23456789abcd' },
    });
  });

  it('drops a user without an id', () => {
    expect(scrubEvent({ message: 'x', user: { email: 'a@example.com' } })).toEqual({ message: 'x' });
  });

  it('does not report anything without a DSN', () => {
    const reporter = createErrorReporter({ SENTRY_DSN: undefined } as unknown as Env);

    expect(reporter).toBe(NOOP_ERROR_REPORTER);
    expect(() => {
      reporter.capture(new Error('ignored'), { requestId: 'r' });
    }).not.toThrow();
  });
});
