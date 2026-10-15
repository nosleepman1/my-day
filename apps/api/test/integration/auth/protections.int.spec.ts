import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/platform/database/prisma.service';
import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';
const WRONG = 'mauvais mot de passe 2026';

const uniqueEmail = (): string => `protect-${randomUUID()}@example.test`;

describe('CSRF protection (SECURITY.md §3.9)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open' });
  });

  afterAll(async () => {
    await app.close();
  });

  const login = () => request(app.getHttpServer()).post('/api/v1/auth/login');
  const body = { email: uniqueEmail(), password: STRONG };

  it('refuses a mutation without X-Requested-With, before any other check', async () => {
    const response = await login().set('Origin', CSRF_HEADERS.Origin).send(body).expect(403);

    expect(response.body.error.code).toBe('CSRF_REJECTED');
    const logout = await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(403);
    expect(logout.body.error.code).toBe('CSRF_REJECTED');
  });

  it('refuses a mutation from another origin', async () => {
    const response = await login()
      .set({ ...CSRF_HEADERS, Origin: 'https://evil.example' })
      .send(body)
      .expect(403);

    expect(response.body.error.code).toBe('CSRF_REJECTED');
  });

  it('accepts a same-origin fetch that carries no Origin header', async () => {
    await login()
      .set({ 'X-Requested-With': 'orbit', 'Sec-Fetch-Site': 'same-origin' })
      .send(body)
      .expect(401);
  });

  it('leaves safe methods alone', async () => {
    await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
  });
});

describe('rate limits per route (SECURITY.md §3.7)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open', RATE_LIMIT_ENABLED: 'true' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows 3 registrations per e-mail and hour, then answers 429 with Retry-After', async () => {
    const email = uniqueEmail();
    const register = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set(CSRF_HEADERS)
        .send({ email, password: STRONG });

    for (let attempt = 0; attempt < 3; attempt += 1) await register().expect(202);
    const limited = await register().expect(429);

    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('allows 20 logins per IP and 10 minutes, whatever the e-mail', async () => {
    const login = () =>
      request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set(CSRF_HEADERS)
        .send({ email: uniqueEmail(), password: WRONG });

    for (let attempt = 0; attempt < 20; attempt += 1) await login().expect(401);
    const limited = await login().expect(429);

    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
  });
});

describe('login lockout computed from login_events (SECURITY.md §3.7, §3.8)', () => {
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

  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').set(CSRF_HEADERS).send({ email, password });

  async function verifiedUser(): Promise<string> {
    const email = uniqueEmail();
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(CSRF_HEADERS)
      .send({ email, password: STRONG })
      .expect(202);
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .set(CSRF_HEADERS)
      .send({ token: mail.lastTokenFor(email) })
      .expect(200);
    return email;
  }

  it('locks an address for 15 minutes after 10 wrong passwords, even with the right one', async () => {
    const email = await verifiedUser();

    for (let attempt = 0; attempt < 10; attempt += 1) await login(email, WRONG).expect(401);
    const locked = await login(email, STRONG).expect(429);

    expect(locked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(14 * 60);
    expect(Number(locked.headers['retry-after'])).toBeLessThanOrEqual(15 * 60);
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    expect(await prisma.loginEvent.count({ where: { userId: user.id, eventType: 'ACCOUNT_LOCKED' } })).toBe(
      1,
    );
  });

  it('locks an unknown address exactly the same way (no account enumeration)', async () => {
    const unknown = uniqueEmail();

    for (let attempt = 0; attempt < 10; attempt += 1) await login(unknown, WRONG).expect(401);
    const locked = await login(unknown, WRONG).expect(429);

    expect(locked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(locked.headers['retry-after'])).toBeGreaterThan(14 * 60);
  });

  it('never stores the e-mail in clear in login_events', async () => {
    const email = await verifiedUser();
    await login(email, WRONG).expect(401);

    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    const [event] = await prisma.loginEvent.findMany({
      where: { userId: user.id, eventType: 'LOGIN_FAILED' },
    });
    expect(event?.emailHmac).toHaveLength(32);
    expect(JSON.stringify(event)).not.toContain(email);
  });
});
