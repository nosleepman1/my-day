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

describe('audit_logs (SECURITY.md §18, ADR-007-7)', () => {
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

  async function signedIn(): Promise<{ email: string; cookie: string; userId: string }> {
    const email = `audit-${randomUUID()}@example.test`;
    await post('/api/v1/auth/register').send({ email, password: STRONG }).expect(202);
    await post('/api/v1/auth/email/verify')
      .send({ token: mail.lastTokenFor(email) })
      .expect(200);
    const response = await post('/api/v1/auth/login').send({ email, password: STRONG }).expect(200);
    const cookie =
      (([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '').split(';')[0] ?? '';
    return { email, cookie, userId: response.body.data.user.id as string };
  }

  it('audits a successful action with its request id and truncated IP', async () => {
    const { cookie, userId } = await signedIn();

    const response = await request(app.getHttpServer())
      .patch('/api/v1/me')
      .set(CSRF_HEADERS)
      .set('Cookie', cookie)
      .send({ displayName: 'Audité' })
      .expect(200);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { userId, action: 'users.profile.update' },
    });
    expect(entry).toMatchObject({ outcome: 'SUCCESS', actorType: 'USER', actorUserId: userId });
    expect(entry.requestId).toBe(response.headers['x-request-id']);
    expect(entry.ip).toMatch(/^(127\.0\.0\.0|::)$/);
  });

  it('audits a failure with its error code and never a secret', async () => {
    const { email } = await signedIn();
    const response = await post('/api/v1/auth/login')
      .send({ email, password: 'mauvais mot de passe 2026' })
      .expect(401);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { requestId: response.headers['x-request-id']! },
    });
    expect(entry).toMatchObject({
      action: 'auth.login',
      outcome: 'FAILURE',
      metadata: { code: 'INVALID_CREDENTIALS' },
    });
    expect(JSON.stringify(entry)).not.toContain('mauvais mot de passe');
  });

  it("answers 404 and audits DENIED when a user targets another user's session", async () => {
    const alice = await signedIn();
    const bob = await signedIn();
    const bobSession = await prisma.session.findFirstOrThrow({
      where: { userId: bob.userId, revokedAt: null },
    });

    await request(app.getHttpServer())
      .delete(`/api/v1/me/sessions/${bobSession.id}`)
      .set(CSRF_HEADERS)
      .set('Cookie', alice.cookie)
      .expect(404);

    const entry = await prisma.auditLog.findFirstOrThrow({
      where: { action: 'authz.cross_user_attempt', entityId: bobSession.id },
    });
    expect(entry).toMatchObject({
      outcome: 'DENIED',
      userId: bob.userId,
      actorUserId: alice.userId,
      entityType: 'sessions',
    });
  });
});
