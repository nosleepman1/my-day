import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import type { CapturingMailAdapter } from '../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../src/platform/mail/mail.port';

import { CSRF_HEADERS } from './csrf';

const PASSWORD = 'thiéboudienne au poisson 2026';

export type SignedInUser = Readonly<{ userId: string; cookie: string }>;

/** Inscrit, vérifie et connecte un nouvel utilisateur (application lancée avec `REGISTRATION_MODE=open`). */
export async function signIn(app: INestApplication): Promise<SignedInUser> {
  const http = () => request(app.getHttpServer());
  const mail = app.get<CapturingMailAdapter>(MAIL);
  const email = `user-${randomUUID()}@example.test`;
  await http()
    .post('/api/v1/auth/register')
    .set(CSRF_HEADERS)
    .send({ email, password: PASSWORD })
    .expect(202);
  await http()
    .post('/api/v1/auth/email/verify')
    .set(CSRF_HEADERS)
    .send({ token: mail.lastTokenFor(email) })
    .expect(200);
  const response = await http()
    .post('/api/v1/auth/login')
    .set(CSRF_HEADERS)
    .send({ email, password: PASSWORD })
    .expect(200);
  const cookie = (([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '').split(';')[0] ?? '';
  return { userId: response.body.data.user.id as string, cookie };
}

/** Client HTTP authentifié sur `/api/v1` : cookie de session et en-têtes CSRF sur chaque requête. */
export function asUser(app: INestApplication, user: SignedInUser) {
  const server = app.getHttpServer();
  const auth = (test: request.Test) => test.set(CSRF_HEADERS).set('Cookie', user.cookie);
  return {
    get: (path: string) => auth(request(server).get(`/api/v1${path}`)),
    post: (path: string, body: object = {}) => auth(request(server).post(`/api/v1${path}`)).send(body),
    put: (path: string, body: object = {}) => auth(request(server).put(`/api/v1${path}`)).send(body),
    patch: (path: string, body: object = {}, ifMatch?: string) => {
      const test = auth(request(server).patch(`/api/v1${path}`));
      return (ifMatch === undefined ? test : test.set('If-Match', ifMatch)).send(body);
    },
    delete: (path: string, ifMatch?: string) => {
      const test = auth(request(server).delete(`/api/v1${path}`));
      return ifMatch === undefined ? test : test.set('If-Match', ifMatch);
    },
  };
}

export type UserClient = ReturnType<typeof asUser>;
