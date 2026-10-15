import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Argon2PasswordHasher } from '../../../src/platform/auth/argon2-password-hasher';
import { hashOpaqueToken } from '../../../src/platform/auth/session-token';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';
const COOKIE =
  /^__Host-orbit_sid=([A-Za-z0-9_-]{43}); Path=\/; Max-Age=(\d+); Secure; HttpOnly; SameSite=Lax$/;

describe('login, session cookie, global guard and logout', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: CapturingMailAdapter;

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open' });
    prisma = app.get(PrismaService);
    mail = app.get<CapturingMailAdapter>(MAIL);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function registeredUser(verified = true): Promise<string> {
    const email = `session-${randomUUID()}@example.test`;
    await http()
      .post('/api/v1/auth/register')
      .set(CSRF_HEADERS)
      .send({ email, password: STRONG })
      .expect(202);
    if (verified) {
      await http()
        .post('/api/v1/auth/email/verify')
        .set(CSRF_HEADERS)
        .send({ token: mail.lastTokenFor(email) })
        .expect(200);
    }
    return email;
  }

  function sessionCookie(response: request.Response): { header: string; token: string; maxAge: number } {
    const header = ([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '';
    const match = COOKIE.exec(header);
    expect(match, header).not.toBeNull();
    return { header, token: match?.[1] ?? '', maxAge: Number(match?.[2]) };
  }

  const login = (email: string, password = STRONG, cookie?: string) => {
    const call = http().post('/api/v1/auth/login').set(CSRF_HEADERS).set('User-Agent', 'Firefox/131.0');
    return (cookie === undefined ? call : call.set('Cookie', cookie)).send({ email, password });
  };

  it('logs in with a __Host- cookie whose token is stored only as SHA-256', async () => {
    const email = await registeredUser();

    const response = await login(email.toUpperCase()).expect(200);

    const { token, maxAge } = sessionCookie(response);
    expect(maxAge).toBe(30 * 86_400);
    expect(response.body.data).toMatchObject({
      user: { email, role: 'USER', mfaEnabled: false, displayName: expect.any(String) as unknown },
      mfaRequired: false,
    });
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    const session = await prisma.session.findFirstOrThrow({
      where: { tokenHash: new Uint8Array(hashOpaqueToken(token)) },
    });
    expect(session.ip).toMatch(/^(127\.0\.0\.0|::)$/);
    const events = await prisma.loginEvent.findMany({
      where: { userId: session.userId, eventType: 'LOGIN_SUCCEEDED' },
    });
    expect(events.map((event) => event.sessionId)).toEqual([session.id]);
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('answers the same 401 INVALID_CREDENTIALS for an unknown e-mail and a wrong password', async () => {
    const email = await registeredUser();

    const wrong = await login(email, 'mauvais mot de passe 2026').expect(401);
    const unknown = await login(`absent-${randomUUID()}@example.test`).expect(401);

    const strip = (body: { error: Record<string, unknown> }) => ({ ...body.error, requestId: undefined });
    expect(strip(wrong.body)).toEqual(strip(unknown.body));
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrong.headers['set-cookie']).toBeUndefined();
    const failures = await prisma.loginEvent.count({ where: { eventType: 'LOGIN_FAILED', userId: null } });
    expect(failures).toBeGreaterThan(0);
  });

  it('answers 403 EMAIL_NOT_VERIFIED only when the password is right', async () => {
    const email = await registeredUser(false);

    expect((await login(email).expect(403)).body.error.code).toBe('EMAIL_NOT_VERIFIED');
    expect((await login(email, 'mauvais mot de passe 2026').expect(401)).body.error.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });

  it('hides a suspended account behind INVALID_CREDENTIALS and invalidates its sessions', async () => {
    const email = await registeredUser();
    const { header } = sessionCookie(await login(email).expect(200));
    await prisma.user.updateMany({ where: { email }, data: { status: 'SUSPENDED' } });

    expect((await login(email).expect(401)).body.error.code).toBe('INVALID_CREDENTIALS');
    await http()
      .post('/api/v1/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', header.split(';')[0] ?? '')
      .expect(401);
  });

  it('protects private routes with the global guard and keeps public ones open', async () => {
    const response = await http().post('/api/v1/auth/logout').set(CSRF_HEADERS).expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
    await http().get('/api/v1/health/live').expect(200);
  });

  it('logs out: revokes the session, expires the cookie and clears the cache', async () => {
    const email = await registeredUser();
    const { header, token } = sessionCookie(await login(email).expect(200));
    const cookie = header.split(';')[0] ?? '';

    const response = await http()
      .post('/api/v1/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', cookie)
      .expect(204);

    expect(response.headers['set-cookie']).toEqual([
      '__Host-orbit_sid=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax',
    ]);
    expect(response.headers['clear-site-data']).toBe('"cache"');
    const session = await prisma.session.findFirstOrThrow({
      where: { tokenHash: new Uint8Array(hashOpaqueToken(token)) },
    });
    expect(session.revokeReason).toBe('LOGOUT');
    await http().post('/api/v1/auth/logout').set(CSRF_HEADERS).set('Cookie', cookie).expect(401);
  });

  it('rotates the token at login and revokes the session presented by the browser (anti-fixation)', async () => {
    const email = await registeredUser();
    const first = sessionCookie(await login(email).expect(200));

    const second = sessionCookie(await login(email, STRONG, first.header.split(';')[0]).expect(200));

    expect(second.token).not.toBe(first.token);
    await http()
      .post('/api/v1/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', first.header.split(';')[0] ?? '')
      .expect(401);
    await http()
      .post('/api/v1/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', second.header.split(';')[0] ?? '')
      .expect(204);
  });

  it('refuses an idle-expired session', async () => {
    const email = await registeredUser();
    const { header, token } = sessionCookie(await login(email).expect(200));
    await prisma.session.updateMany({
      where: { tokenHash: new Uint8Array(hashOpaqueToken(token)) },
      data: { idleExpiresAt: new Date(Date.now() - 1_000) },
    });

    await http()
      .post('/api/v1/auth/logout')
      .set(CSRF_HEADERS)
      .set('Cookie', header.split(';')[0] ?? '')
      .expect(401);
  });

  it('keeps at most 20 active sessions per user, revoking the oldest with LIMIT', async () => {
    const email = await registeredUser();
    for (let index = 0; index < 21; index += 1) await login(email).expect(200);

    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    const active = await prisma.session.count({ where: { userId: user.id, revokedAt: null } });
    const limited = await prisma.session.count({ where: { userId: user.id, revokeReason: 'LIMIT' } });
    expect(active).toBe(20);
    expect(limited).toBe(1);
  });

  it('rehashes a password stored with outdated parameters at the next login', async () => {
    const email = await registeredUser();
    const outdated = await new Argon2PasswordHasher({ memoryCost: 2048, timeCost: 1, parallelism: 1 }).hash(
      STRONG,
    );
    await prisma.user.updateMany({ where: { email }, data: { passwordHash: outdated } });

    await login(email).expect(200);

    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=1024,t=1,p=1\$/);
  });
});
