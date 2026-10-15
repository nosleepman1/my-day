import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CapturingMailAdapter } from '../../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../../src/platform/mail/mail.port';
import { createTestApp } from '../../helpers/create-test-app';
import { CSRF_HEADERS } from '../../helpers/csrf';

const STRONG = 'thiéboudienne au poisson 2026';

class LogCapture extends Writable {
  private readonly chunks: string[] = [];

  override _write(chunk: unknown, _encoding: BufferEncoding, callback: () => void): void {
    this.chunks.push(String(chunk));
    callback();
  }

  text(): string {
    return this.chunks.join('');
  }
}

describe('security regressions (PHASE-01 T15)', () => {
  describe('logs never contain secrets (SECURITY.md §17, CODING_STANDARDS §7)', () => {
    const logs = new LogCapture();
    let app: INestApplication;
    let mail: CapturingMailAdapter;

    beforeAll(async () => {
      app = await createTestApp({ REGISTRATION_MODE: 'open', LOG_LEVEL: 'trace' }, { logDestination: logs });
      mail = app.get<CapturingMailAdapter>(MAIL);
    });

    afterAll(async () => {
      await app.close();
    });

    it('logs a full registration and login without password, e-mail, token or cookie', async () => {
      const email = `logs-${randomUUID()}@example.test`;
      const post = (url: string) => request(app.getHttpServer()).post(url).set(CSRF_HEADERS);
      await post('/api/v1/auth/register').send({ email, password: STRONG }).expect(202);
      const token = mail.lastTokenFor(email) ?? '';
      await post('/api/v1/auth/email/verify').send({ token }).expect(200);
      await post('/api/v1/auth/login').send({ email, password: 'mauvais mot de passe 2026' }).expect(401);
      const login = await post('/api/v1/auth/login').send({ email, password: STRONG }).expect(200);
      const cookie =
        (([] as string[]).concat(login.headers['set-cookie'] ?? [])[0] ?? '').split(';')[0] ?? '';
      await request(app.getHttpServer()).get('/api/v1/me').set('Cookie', cookie).expect(200);

      const written = logs.text();
      expect(written.length).toBeGreaterThan(0);
      for (const secret of [STRONG, 'mauvais mot de passe', email, token, cookie.split('=')[1] ?? '']) {
        expect(secret.length).toBeGreaterThan(0);
        expect(written).not.toContain(secret);
      }
    });
  });

  describe('uniform responses (SECURITY.md §3.8)', () => {
    let app: INestApplication;
    let mail: CapturingMailAdapter;
    const FLOOR_MS = 200;

    beforeAll(async () => {
      app = await createTestApp({ REGISTRATION_MODE: 'open', AUTH_UNIFORM_RESPONSE_MS: String(FLOOR_MS) });
      mail = app.get<CapturingMailAdapter>(MAIL);
    });

    afterAll(async () => {
      await app.close();
    });

    async function timed(url: string, body: object, status: number): Promise<number> {
      const started = performance.now();
      await request(app.getHttpServer()).post(url).set(CSRF_HEADERS).send(body).expect(status);
      return performance.now() - started;
    }

    it('takes at least the floor for known and unknown addresses alike', async () => {
      const known = `uniform-${randomUUID()}@example.test`;
      await timed('/api/v1/auth/register', { email: known, password: STRONG }, 202);
      await request(app.getHttpServer())
        .post('/api/v1/auth/email/verify')
        .set(CSRF_HEADERS)
        .send({ token: mail.lastTokenFor(known) })
        .expect(200);
      const unknown = `absent-${randomUUID()}@example.test`;

      const durations = [
        await timed('/api/v1/auth/password/forgot', { email: known }, 202),
        await timed('/api/v1/auth/password/forgot', { email: unknown }, 202),
        await timed('/api/v1/auth/email/verify/resend', { email: known }, 202),
        await timed('/api/v1/auth/email/verify/resend', { email: unknown }, 202),
      ];

      for (const duration of durations) expect(duration).toBeGreaterThanOrEqual(FLOOR_MS - 5);
    });

    it.each(['/api/v1/auth/register', '/api/v1/auth/password/forgot'])(
      'refuses an e-mail carrying a header injection on %s',
      async (url) => {
        const response = await request(app.getHttpServer())
          .post(url)
          .set(CSRF_HEADERS)
          .send({ email: 'victim@example.test\r\nBcc: attacker@example.test', password: STRONG });

        expect(response.status).toBe(400);
        expect(response.body.error.code).toBe('VALIDATION_FAILED');
      },
    );
  });
});
