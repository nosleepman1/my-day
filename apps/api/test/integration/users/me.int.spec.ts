import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';
const NEW_PASSWORD = 'mafé au boeuf et riz blanc 2026';

describe('/me, preferences, e-mail and password change (API.md §14.3)', () => {
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
  const send = (method: 'post' | 'patch', url: string, cookie?: string) => {
    const call = http()[method](url).set(CSRF_HEADERS);
    return cookie === undefined ? call : call.set('Cookie', cookie);
  };
  const get = (url: string, cookie: string) => http().get(url).set('Cookie', cookie);

  function cookieOf(response: request.Response): string {
    const header = ([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '';
    return header.split(';')[0] ?? '';
  }

  async function signedIn(): Promise<{ email: string; cookie: string }> {
    const email = `me-${randomUUID()}@example.test`;
    await send('post', '/api/v1/auth/register').send({ email, password: STRONG }).expect(202);
    await send('post', '/api/v1/auth/email/verify')
      .send({ token: mail.lastTokenFor(email) })
      .expect(200);
    const response = await send('post', '/api/v1/auth/login').send({ email, password: STRONG }).expect(200);
    return { email, cookie: cookieOf(response) };
  }

  it('returns and updates the profile of the signed-in user only', async () => {
    const { email, cookie } = await signedIn();

    await http().get('/api/v1/me').expect(401);
    const me = await get('/api/v1/me', cookie).expect(200);
    const renamed = await send('patch', '/api/v1/me', cookie)
      .send({ displayName: '  Aminata  ' })
      .expect(200);

    expect(me.body.data).toMatchObject({ email, role: 'USER', mfaEnabled: false });
    expect(renamed.body.data.displayName).toBe('Aminata');
  });

  it('reads and updates preferences with validation', async () => {
    const { cookie } = await signedIn();

    const initial = await get('/api/v1/me/preferences', cookie).expect(200);
    const updated = await send('patch', '/api/v1/me/preferences', cookie)
      .send({ timezone: 'Europe/Paris', enabledModules: ['finance', 'tasks'], onboardingCompleted: true })
      .expect(200);

    expect(initial.body.data).toMatchObject({
      timezone: 'Africa/Dakar',
      defaultCurrency: 'XOF',
      onboardingCompletedAt: null,
    });
    expect(updated.body.data).toMatchObject({
      timezone: 'Europe/Paris',
      enabledModules: ['finance', 'tasks'],
    });
    expect(updated.body.data.onboardingCompletedAt).toEqual(expect.any(String));
    await send('patch', '/api/v1/me/preferences', cookie).send({ timezone: 'Mars/Olympus' }).expect(400);
    await send('patch', '/api/v1/me/preferences', cookie).send({}).expect(400);
  });

  it('changes the e-mail after a recent re-authentication and a confirmation link', async () => {
    const { email, cookie } = await signedIn();
    const newEmail = `moved-${randomUUID()}@example.test`;

    const refused = await send('post', '/api/v1/me/email', cookie).send({ newEmail }).expect(403);
    expect(refused.body.error).toMatchObject({ code: 'REAUTH_REQUIRED', details: { maxAgeSeconds: 600 } });

    await send('post', '/api/v1/auth/reauth', cookie).send({ password: STRONG }).expect(204);
    await send('post', '/api/v1/me/email', cookie).send({ newEmail }).expect(202);
    expect(mail.lastTo(newEmail)?.template).toBe('email-change-verification');
    expect(mail.lastTo(email)?.template).toBe('email-change-notice');

    const token = mail.lastTokenFor(newEmail) ?? '';
    await send('post', '/api/v1/auth/email/change/confirm').send({ token }).expect(204);
    await send('post', '/api/v1/auth/email/change/confirm').send({ token }).expect(410);
    expect((await get('/api/v1/me', cookie).expect(200)).body.data.email).toBe(newEmail);
    await send('post', '/api/v1/auth/login').send({ email: newEmail, password: STRONG }).expect(200);
  });

  it('answers 202 for an address already taken and warns its owner', async () => {
    const { cookie } = await signedIn();
    const other = await signedIn();
    await send('post', '/api/v1/auth/reauth', cookie).send({ password: STRONG }).expect(204);

    await send('post', '/api/v1/me/email', cookie).send({ newEmail: other.email }).expect(202);

    expect(mail.lastTo(other.email)?.template).toBe('email-change-conflict');
  });

  it('changes the password, rotates the current session and revokes the others', async () => {
    const { email, cookie } = await signedIn();

    const wrong = await send('post', '/api/v1/me/password', cookie)
      .send({ currentPassword: 'mauvais mot de passe', newPassword: NEW_PASSWORD })
      .expect(403);
    const changed = await send('post', '/api/v1/me/password', cookie)
      .send({ currentPassword: STRONG, newPassword: NEW_PASSWORD })
      .expect(204);

    expect(wrong.body.error.code).toBe('REAUTH_FAILED');
    const rotated = cookieOf(changed);
    expect(rotated).not.toBe(cookie);
    await get('/api/v1/me', cookie).expect(401);
    await get('/api/v1/me', rotated).expect(200);
    expect(mail.lastTo(email)?.template).toBe('password-changed');
  });
});
