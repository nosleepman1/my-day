import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { hashOpaqueToken } from '../../../src/platform/auth/session-token';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';
const NEW_PASSWORD = 'yassa au poulet et attiéké 2026';

describe('password reset and re-authentication (SECURITY.md §3.5, §4)', () => {
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

  const post = (url: string, cookie?: string) => {
    const call = request(app.getHttpServer()).post(url).set(CSRF_HEADERS);
    return cookie === undefined ? call : call.set('Cookie', cookie);
  };

  async function verifiedUser(): Promise<string> {
    const email = `password-${randomUUID()}@example.test`;
    await post('/api/v1/auth/register').send({ email, password: STRONG }).expect(202);
    await post('/api/v1/auth/email/verify')
      .send({ token: mail.lastTokenFor(email) })
      .expect(200);
    return email;
  }

  async function loginCookie(email: string, password = STRONG): Promise<string> {
    const response = await post('/api/v1/auth/login').send({ email, password }).expect(200);
    const header = ([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '';
    return header.split(';')[0] ?? '';
  }

  it('answers 202 for an unknown address without sending anything', async () => {
    const unknown = `absent-${randomUUID()}@example.test`;

    const response = await post('/api/v1/auth/password/forgot').send({ email: unknown }).expect(202);

    expect(response.body).toEqual({ data: { status: 'accepted' } });
    expect(mail.lastTo(unknown)).toBeUndefined();
  });

  it('resets the password once, revokes every session and notifies the owner', async () => {
    const email = await verifiedUser();
    const cookie = await loginCookie(email);

    await post('/api/v1/auth/password/forgot').send({ email: email.toUpperCase() }).expect(202);
    const sent = mail.lastTo(email);
    expect(sent?.template).toBe('password-reset');
    expect(sent?.text).toContain('/reset-password#token=');
    const token = mail.lastTokenFor(email) ?? '';
    const stored = await prisma.passwordResetToken.findFirstOrThrow({
      where: { tokenHash: new Uint8Array(hashOpaqueToken(token)) },
    });
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBe(30 * 60_000);

    const weak = await post('/api/v1/auth/password/reset').send({ token, newPassword: 'court' }).expect(400);
    expect(weak.body.error.details[0].path).toEqual(['newPassword']);
    await post('/api/v1/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(204);

    expect(mail.lastTo(email)?.template).toBe('password-changed');
    await post('/api/v1/auth/logout', cookie).expect(401);
    await post('/api/v1/auth/login').send({ email, password: STRONG }).expect(401);
    await loginCookie(email, NEW_PASSWORD);
    expect(
      (await post('/api/v1/auth/password/reset').send({ token, newPassword: NEW_PASSWORD }).expect(410)).body
        .error.code,
    ).toBe('GONE');
  });

  it('invalidates an earlier link when a new one is requested', async () => {
    const email = await verifiedUser();
    await post('/api/v1/auth/password/forgot').send({ email }).expect(202);
    const first = mail.lastTokenFor(email) ?? '';
    await post('/api/v1/auth/password/forgot').send({ email }).expect(202);

    await post('/api/v1/auth/password/reset').send({ token: first, newPassword: NEW_PASSWORD }).expect(410);
  });

  it('answers 202 to concurrent requests for the same account, never 409 (no enumeration)', async () => {
    const email = await verifiedUser();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => post('/api/v1/auth/password/forgot').send({ email })),
    );

    expect(responses.map((response) => response.status)).toEqual([202, 202, 202, 202, 202]);
  });

  it('re-authenticates the current session with the password', async () => {
    const email = await verifiedUser();
    const cookie = await loginCookie(email);

    const wrong = await post('/api/v1/auth/reauth', cookie)
      .send({ password: 'mauvais mot de passe' })
      .expect(403);
    await post('/api/v1/auth/reauth', cookie).send({ password: STRONG }).expect(204);

    expect(wrong.body.error.code).toBe('REAUTH_FAILED');
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id, revokedAt: null } });
    expect(session.reauthAt).toBeInstanceOf(Date);
    await post('/api/v1/auth/reauth').send({ password: STRONG }).expect(401);
  });
});
