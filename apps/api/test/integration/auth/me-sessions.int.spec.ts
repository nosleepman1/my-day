import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';

describe('session management and login history (API.md §14.3)', () => {
  let app: INestApplication;
  let mail: CapturingMailAdapter;

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open' });
    mail = app.get<CapturingMailAdapter>(MAIL);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const post = (url: string, cookie?: string) => {
    const call = http().post(url).set(CSRF_HEADERS);
    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  async function account(): Promise<{ email: string; login: () => Promise<string> }> {
    const email = `sessions-${randomUUID()}@example.test`;
    await post('/api/v1/auth/register').send({ email, password: STRONG }).expect(202);
    await post('/api/v1/auth/email/verify')
      .send({ token: mail.lastTokenFor(email) })
      .expect(200);
    const login = async () => {
      const response = await post('/api/v1/auth/login')
        .set('User-Agent', 'Firefox/131.0')
        .send({ email, password: STRONG })
        .expect(200);
      return (([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '').split(';')[0] ?? '';
    };
    return { email, login };
  }

  it('lists active sessions with the current one flagged, then revokes the others', async () => {
    const { login } = await account();
    const first = await login();
    const second = await login();

    const listed = await http().get('/api/v1/me/sessions').set('Cookie', first).expect(200);

    expect(listed.body.data).toHaveLength(2);
    const rows = listed.body.data as { current: boolean }[];
    expect(rows.filter((row) => row.current)).toHaveLength(1);
    expect(listed.body.data[0]).toMatchObject({ device: 'Firefox/131.0' });
    await post('/api/v1/me/sessions/revoke-others', first).expect(204);
    await http().get('/api/v1/me/sessions').set('Cookie', second).expect(401);
    await http().get('/api/v1/me/sessions').set('Cookie', first).expect(200);
  });

  it("revokes one session by id, and answers 404 for another user's or an unknown one", async () => {
    const alice = await account();
    const bob = await account();
    const aliceCookie = await alice.login();
    const aliceOther = await alice.login();
    const bobCookie = await bob.login();
    const bobSessions = await http().get('/api/v1/me/sessions').set('Cookie', bobCookie).expect(200);
    const aliceSessions = await http().get('/api/v1/me/sessions').set('Cookie', aliceCookie).expect(200);
    const otherId = (aliceSessions.body.data as { id: string; current: boolean }[]).find(
      (row) => !row.current,
    )?.id;

    const remove = (id: string) =>
      http().delete(`/api/v1/me/sessions/${id}`).set(CSRF_HEADERS).set('Cookie', aliceCookie);
    await remove(bobSessions.body.data[0].id as string).expect(404);
    await remove('01928f4e-8c2a-7b3d-9e4f-0123456789ab').expect(404);
    await remove('not-a-uuid').expect(400);
    await remove(otherId ?? '').expect(204);
    await http().get('/api/v1/me/sessions').set('Cookie', aliceOther).expect(401);
    await http().get('/api/v1/me/sessions').set('Cookie', bobCookie).expect(200);
  });

  it('pages through the login history with an opaque cursor', async () => {
    const { login } = await account();
    const cookie = await login();
    await login();

    const first = await http().get('/api/v1/me/login-events?limit=1').set('Cookie', cookie).expect(200);
    const next = await http()
      .get(`/api/v1/me/login-events?limit=1&cursor=${first.body.meta.nextCursor as string}`)
      .set('Cookie', cookie)
      .expect(200);

    expect(first.body.meta).toMatchObject({ limit: 1, hasMore: true });
    expect(first.body.data[0].eventType).toBe('LOGIN_SUCCEEDED');
    expect(next.body.data[0].id).not.toBe(first.body.data[0].id);
    const invalid = await http().get('/api/v1/me/login-events?cursor=nope').set('Cookie', cookie).expect(400);
    expect(invalid.body.error.code).toBe('INVALID_CURSOR');
  });
});
