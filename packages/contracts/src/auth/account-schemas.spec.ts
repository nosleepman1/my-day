import { describe, expect, it } from 'vitest';

import {
  ForgotPasswordRequestSchema,
  ReauthRequestSchema,
  ResetPasswordRequestSchema,
} from './password.schema';
import {
  LoginEventListResponseSchema,
  SessionIdParamSchema,
  SessionListResponseSchema,
} from './sessions.schema';

const ID = '01928f4e-8c2a-7b3d-9e4f-0123456789ab';
const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCd';
const AT = '2026-10-13T09:30:00.000Z';

describe('password schemas (API.md §14.3)', () => {
  it('accept well-formed requests', () => {
    expect(ForgotPasswordRequestSchema.parse({ email: 'a@example.test' })).toEqual({
      email: 'a@example.test',
    });
    expect(ResetPasswordRequestSchema.parse({ token: TOKEN, newPassword: 'x' })).toEqual({
      token: TOKEN,
      newPassword: 'x',
    });
    expect(ReauthRequestSchema.parse({ password: 'x' })).toEqual({ password: 'x' });
  });

  it.each([
    ['forgot with an unknown key', ForgotPasswordRequestSchema, { email: 'a@example.test', x: 1 }],
    ['reset with a malformed token', ResetPasswordRequestSchema, { token: 'a b', newPassword: 'x' }],
    ['reauth with an empty password', ReauthRequestSchema, { password: '' }],
  ])('reject %s', (_label, schema, input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});

describe('session schemas', () => {
  it('describe the session list and the paginated login history', () => {
    const session = { id: ID, current: true, createdAt: AT, lastSeenAt: AT, ip: '203.0.113.0', device: null };
    const event = {
      id: ID,
      eventType: 'LOGIN_SUCCEEDED',
      failureCode: null,
      occurredAt: AT,
      ip: null,
      device: 'Firefox',
    };

    expect(SessionListResponseSchema.parse({ data: [session] })).toEqual({ data: [session] });
    expect(
      LoginEventListResponseSchema.parse({
        data: [event],
        meta: { limit: 25, nextCursor: null, hasMore: false },
      }).data,
    ).toEqual([event]);
  });

  it('only accepts a UUIDv7 session id', () => {
    expect(SessionIdParamSchema.safeParse({ id: ID }).success).toBe(true);
    expect(SessionIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});
