import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/platform/database/prisma.service';
import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';

const STRONG = 'thiéboudienne au poisson 2026';
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0';

describe('POST /auth/email/verify', () => {
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

  async function registerAndGetToken(): Promise<{ email: string; token: string }> {
    const email = `verify-${randomUUID()}@example.test`;
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: STRONG })
      .expect(202);
    return { email, token: mail.lastTokenFor(email) ?? '' };
  }

  const verify = (token: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .set('User-Agent', USER_AGENT)
      .send({ token });

  it('verifies the address once, records EMAIL_VERIFIED, then answers 410 GONE', async () => {
    const { email, token } = await registerAndGetToken();

    const first = await verify(token).expect(200);
    const second = await verify(token).expect(410);

    expect(first.body).toEqual({ data: { status: 'verified' } });
    expect(second.body.error.code).toBe('GONE');
    const user = await prisma.user.findFirstOrThrow({ where: { email } });
    expect(user.emailVerifiedAt).toBeInstanceOf(Date);
    const events = await prisma.loginEvent.findMany({ where: { userId: user.id } });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ eventType: 'EMAIL_VERIFIED', userAgentLabel: USER_AGENT });
    expect(events[0]?.ip).toMatch(/127\.0\.0\.1|::1/);
  });

  it('refuses a token replaced by a resend, and accepts the new one', async () => {
    const { email, token: first } = await registerAndGetToken();
    await request(app.getHttpServer()).post('/api/v1/auth/email/verify/resend').send({ email }).expect(202);
    const second = mail.lastTokenFor(email) ?? '';

    await verify(first).expect(410);
    await verify(second).expect(200);
  });

  it('refuses an expired token', async () => {
    const { email, token } = await registerAndGetToken();
    const past = new Date(Date.now() - 48 * 3_600_000);
    await prisma.emailVerificationToken.updateMany({
      where: { targetEmail: email },
      data: { createdAt: past, expiresAt: new Date(past.getTime() + 3_600_000) },
    });

    await verify(token).expect(410);
    expect((await prisma.user.findFirstOrThrow({ where: { email } })).emailVerifiedAt).toBeNull();
  });

  it('answers 410 for an unknown token and 400 for a malformed one', async () => {
    await verify('UnknownTokenUnknownTokenUnknownTokenUnknown').expect(410);
    const malformed = await verify('not a token!').expect(400);

    expect(malformed.body.error.code).toBe('VALIDATION_FAILED');
  });
});
