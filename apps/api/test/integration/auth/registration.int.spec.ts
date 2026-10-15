import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { USER_MODULES } from '@orbit/contracts';

import { hashOpaqueToken } from '../../../src/platform/auth/session-token';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';
const ACCEPTED = { data: { status: 'accepted' } };

function uniqueEmail(): string {
  return `user-${randomUUID()}@example.test`;
}

describe('POST /auth/register and /auth/email/verify/resend (open mode)', () => {
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

  const register = (body: object) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').set(CSRF_HEADERS).send(body);

  it('creates the user, default preferences and a verification token, then mails the link', async () => {
    const email = uniqueEmail();

    const response = await register({ email: email.toUpperCase(), password: STRONG }).expect(202);

    expect(response.body).toEqual(ACCEPTED);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { preferences: true, emailVerificationTokens: true },
    });
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$/);
    expect(user.preferences).toMatchObject({
      timezone: 'Africa/Dakar',
      defaultCurrency: 'XOF',
      locale: 'fr',
      enabledModules: [...USER_MODULES],
      onboardingCompletedAt: null,
    });
    expect(user.emailVerificationTokens).toHaveLength(1);
    const token = mail.lastTokenFor(email) ?? '';
    const stored = Buffer.from(user.emailVerificationTokens[0]?.tokenHash ?? new Uint8Array());
    expect(stored.equals(hashOpaqueToken(token))).toBe(true);
  });

  it('answers identically for an existing address and changes nothing', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG }).expect(202);

    const response = await register({ email, password: `${STRONG} bis` }).expect(202);

    expect(response.body).toEqual(ACCEPTED);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect(mail.lastTo(email)?.template).toBe('registration-attempt');
  });

  it('rejects a weak password with a field-level VALIDATION_FAILED', async () => {
    const response = await register({ email: uniqueEmail(), password: 'password1234' }).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(response.body.error.details).toEqual([
      expect.objectContaining({ path: ['password'], code: 'COMMON' }),
    ]);
  });

  it('rejects unknown keys (strict input schema)', async () => {
    const response = await register({ email: uniqueEmail(), password: STRONG, role: 'ADMIN' }).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('resend replaces the active token and answers 202 for unknown addresses too', async () => {
    const email = uniqueEmail();
    await register({ email, password: STRONG }).expect(202);
    const firstToken = mail.lastTokenFor(email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify/resend')
      .set(CSRF_HEADERS)
      .send({ email })
      .expect(202);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify/resend')
      .set(CSRF_HEADERS)
      .send({ email: uniqueEmail() })
      .expect(202);

    expect(unknown.body).toEqual(ACCEPTED);
    expect(mail.lastTokenFor(email)).not.toBe(firstToken);
    const tokens = await prisma.emailVerificationToken.findMany({ where: { targetEmail: email } });
    expect(tokens).toHaveLength(2);
    expect(tokens.filter((token) => token.consumedAt === null)).toHaveLength(1);
  });
});

describe('POST /auth/register (allowlist mode, the default)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const listed = uniqueEmail();

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_ALLOWLIST: ` ${listed.toUpperCase()} , other@example.test` });
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 202 but creates nothing for an address outside the allowlist', async () => {
    const outsider = uniqueEmail();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(CSRF_HEADERS)
      .send({ email: outsider, password: STRONG })
      .expect(202);

    expect(await prisma.user.count({ where: { email: outsider } })).toBe(0);
  });

  it('creates the account of an allowlisted address', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set(CSRF_HEADERS)
      .send({ email: listed, password: STRONG })
      .expect(202);

    expect(await prisma.user.count({ where: { email: listed } })).toBe(1);
  });
});
