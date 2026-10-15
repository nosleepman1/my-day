import { randomUUID } from 'node:crypto';

import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PrismaService } from '../../src/platform/database/prisma.service';
import type { CapturingMailAdapter } from '../../src/platform/mail/capturing-mail.adapter';
import { MAIL } from '../../src/platform/mail/mail.port';
import { createTestApp } from '../helpers/create-test-app';
import { CSRF_HEADERS } from '../helpers/csrf';

import { CROSS_USER_EXEMPTIONS, PUBLIC_ROUTES } from './exemptions';
import { listRoutes, type RouteEntry } from './route-registry';

const STRONG = 'thiéboudienne au poisson 2026';
const SOME_ID = '01928f4e-8c2a-7b3d-9e4f-0123456789ab';

type Verb = 'get' | 'post' | 'put' | 'patch' | 'delete';
type SignedInUser = Readonly<{ userId: string; cookie: string }>;
type CrossUserCase = (
  context: Readonly<{ owner: SignedInUser; intruder: SignedInUser }>,
) => Promise<request.Response>;

describe('generated isolation harness (ADR-007, ADR-021, PHASE-01 T14)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: CapturingMailAdapter;
  let routes: RouteEntry[];

  const http = () => request(app.getHttpServer());

  async function signedIn(): Promise<SignedInUser> {
    const email = `isolation-${randomUUID()}@example.test`;
    await http()
      .post('/api/v1/auth/register')
      .set(CSRF_HEADERS)
      .send({ email, password: STRONG })
      .expect(202);
    await http()
      .post('/api/v1/auth/email/verify')
      .set(CSRF_HEADERS)
      .send({ token: mail.lastTokenFor(email) })
      .expect(200);
    const response = await http()
      .post('/api/v1/auth/login')
      .set(CSRF_HEADERS)
      .send({ email, password: STRONG })
      .expect(200);
    const cookie =
      (([] as string[]).concat(response.headers['set-cookie'] ?? [])[0] ?? '').split(';')[0] ?? '';
    return { userId: response.body.data.user.id as string, cookie };
  }

  /** Ressources M03 de A créées par l'API : chaque cas les vise ensuite avec la session de B. */
  type OrganizationFixture = Readonly<{
    idea: string;
    project: string;
    task: string;
    otherTask: string;
    note: string;
    tag: string;
    otherTag: string;
    link: string;
  }>;

  async function createAs(
    user: SignedInUser,
    path: string,
    body: object,
    extraHeaders: Record<string, string> = {},
  ): Promise<string> {
    const response = await http()
      .post(`/api/v1${path}`)
      .set(CSRF_HEADERS)
      .set('Cookie', user.cookie)
      .set(extraHeaders)
      .send(body)
      .expect((res) => {
        if (res.status !== 200 && res.status !== 201) throw new Error(`${path} → ${res.status}`);
      });
    return response.body.data.id as string;
  }

  async function organizationFixture(owner: SignedInUser): Promise<OrganizationFixture> {
    const task = await createAs(owner, '/tasks', { title: 'Tâche de A' });
    const otherTask = await createAs(owner, '/tasks', { title: 'Autre tâche de A' });
    const note = await createAs(owner, '/notes', { content: 'Note de A' });
    await http()
      .post(`/api/v1/tasks/${task}/dependencies`)
      .set(CSRF_HEADERS)
      .set('Cookie', owner.cookie)
      .send({ dependsOnTaskId: otherTask })
      .expect(201);
    return {
      idea: await createAs(owner, '/ideas', { title: 'Idée de A' }),
      project: await createAs(owner, '/projects', { name: 'Projet de A' }),
      task,
      otherTask,
      note,
      tag: await createAs(owner, '/tags', { name: `a-${randomUUID().slice(0, 8)}` }),
      otherTag: await createAs(owner, '/tags', { name: `b-${randomUUID().slice(0, 8)}` }),
      link: await createAs(owner, `/notes/${note}/links`, { taskId: task }),
    };
  }

  type OrganizationCase = Readonly<{
    verb: Verb;
    path: (fixture: OrganizationFixture) => string;
    body?: (fixture: OrganizationFixture) => object;
    ifMatch?: boolean;
  }>;

  const at = (
    verb: Verb,
    path: OrganizationCase['path'],
    extra: Omit<OrganizationCase, 'verb' | 'path'> = {},
  ): OrganizationCase => ({ verb, path, ...extra });

  const ORGANIZATION_CASES: Readonly<Record<string, OrganizationCase>> = {
    'GET /api/v1/ideas/:id': at('get', (f) => `/ideas/${f.idea}`),
    'PATCH /api/v1/ideas/:id': at('patch', (f) => `/ideas/${f.idea}`, { body: () => ({ title: 'B' }) }),
    'DELETE /api/v1/ideas/:id': at('delete', (f) => `/ideas/${f.idea}`),
    'POST /api/v1/ideas/:id/archive': at('post', (f) => `/ideas/${f.idea}/archive`),
    'POST /api/v1/ideas/:id/restore': at('post', (f) => `/ideas/${f.idea}/restore`),
    'PUT /api/v1/ideas/:id/tags': at('put', (f) => `/ideas/${f.idea}/tags`, { body: () => ({ tagIds: [] }) }),
    'POST /api/v1/ideas/:id/convert-to-project': at('post', (f) => `/ideas/${f.idea}/convert-to-project`),
    'GET /api/v1/ideas/:id/similar': at('get', (f) => `/ideas/${f.idea}/similar`),
    'GET /api/v1/projects/:id': at('get', (f) => `/projects/${f.project}`),
    'GET /api/v1/projects/:id/summary': at('get', (f) => `/projects/${f.project}/summary`),
    'PATCH /api/v1/projects/:id': at('patch', (f) => `/projects/${f.project}`, {
      body: () => ({ name: 'B' }),
    }),
    'DELETE /api/v1/projects/:id': at('delete', (f) => `/projects/${f.project}`),
    'POST /api/v1/projects/:id/archive': at('post', (f) => `/projects/${f.project}/archive`),
    'POST /api/v1/projects/:id/restore': at('post', (f) => `/projects/${f.project}/restore`),
    'PUT /api/v1/projects/:id/tags': at('put', (f) => `/projects/${f.project}/tags`, {
      body: () => ({ tagIds: [] }),
    }),
    'GET /api/v1/tasks/:id': at('get', (f) => `/tasks/${f.task}`),
    'GET /api/v1/tasks/:id/history': at('get', (f) => `/tasks/${f.task}/history`),
    'PATCH /api/v1/tasks/:id': at('patch', (f) => `/tasks/${f.task}`, { body: () => ({ title: 'B' }) }),
    'DELETE /api/v1/tasks/:id': at('delete', (f) => `/tasks/${f.task}`),
    'POST /api/v1/tasks/:id/complete': at('post', (f) => `/tasks/${f.task}/complete`),
    'POST /api/v1/tasks/:id/reopen': at('post', (f) => `/tasks/${f.task}/reopen`),
    'POST /api/v1/tasks/:id/recurrence/stop': at('post', (f) => `/tasks/${f.task}/recurrence/stop`),
    'PUT /api/v1/tasks/:id/tags': at('put', (f) => `/tasks/${f.task}/tags`, { body: () => ({ tagIds: [] }) }),
    'POST /api/v1/tasks/:id/dependencies': at('post', (f) => `/tasks/${f.otherTask}/dependencies`, {
      body: (f) => ({ dependsOnTaskId: f.task }),
    }),
    'DELETE /api/v1/tasks/:id/dependencies/:dependsOnTaskId': at(
      'delete',
      (f) => `/tasks/${f.task}/dependencies/${f.otherTask}`,
    ),
    'GET /api/v1/notes/:id': at('get', (f) => `/notes/${f.note}`),
    'PATCH /api/v1/notes/:id': at('patch', (f) => `/notes/${f.note}`, {
      body: () => ({ content: 'B' }),
      ifMatch: true,
    }),
    'DELETE /api/v1/notes/:id': at('delete', (f) => `/notes/${f.note}`, { ifMatch: true }),
    'POST /api/v1/notes/:id/archive': at('post', (f) => `/notes/${f.note}/archive`),
    'POST /api/v1/notes/:id/restore': at('post', (f) => `/notes/${f.note}/restore`),
    'PUT /api/v1/notes/:id/tags': at('put', (f) => `/notes/${f.note}/tags`, { body: () => ({ tagIds: [] }) }),
    'POST /api/v1/notes/:id/links': at('post', (f) => `/notes/${f.note}/links`, {
      body: (f) => ({ taskId: f.task }),
    }),
    'DELETE /api/v1/notes/:id/links/:linkId': at('delete', (f) => `/notes/${f.note}/links/${f.link}`),
    'PATCH /api/v1/tags/:id': at('patch', (f) => `/tags/${f.tag}`, { body: () => ({ color: '#112233' }) }),
    'DELETE /api/v1/tags/:id': at('delete', (f) => `/tags/${f.tag}`),
    'POST /api/v1/tags/:id/merge': at('post', (f) => `/tags/${f.tag}/merge`, {
      body: (f) => ({ targetTagId: f.otherTag }),
    }),
  };

  function organizationCase(spec: OrganizationCase): CrossUserCase {
    return async ({ owner, intruder }) => {
      const fixture = await organizationFixture(owner);
      const agent = http();
      const pending = agent[spec.verb](`/api/v1${spec.path(fixture)}`)
        .set(CSRF_HEADERS)
        .set('Cookie', intruder.cookie);
      if (spec.ifMatch === true) pending.set('If-Match', 'W/"1"');
      return pending.send(spec.body?.(fixture) ?? {});
    };
  }

  type FinanceFixture = Readonly<{
    account: string;
    category: string;
    counterparty: string;
    transaction: string;
    transfer: string;
  }>;

  async function financeFixture(owner: SignedInUser): Promise<FinanceFixture> {
    const account = await createAs(owner, '/finance/accounts', {
      name: `Compte ${randomUUID().slice(0, 8)}`,
      type: 'BANK',
      currency: 'XOF',
      openedOn: '2026-01-01',
    });
    const account2 = await createAs(owner, '/finance/accounts', {
      name: `Compte Dest ${randomUUID().slice(0, 8)}`,
      type: 'CASH',
      currency: 'XOF',
      openedOn: '2026-01-01',
    });
    const category = await createAs(owner, '/finance/categories', {
      name: `Catégorie ${randomUUID().slice(0, 8)}`,
      kind: 'EXPENSE',
      defaultEconomicClass: 'EXPENSE_OPERATING',
    });
    const counterparty = await createAs(owner, '/finance/counterparties', {
      name: `Contrepartie ${randomUUID().slice(0, 8)}`,
      kind: 'PERSON',
    });
    const transaction = await createAs(
      owner,
      '/finance/transactions',
      {
        type: 'INCOME',
        status: 'PENDING',
        accountId: account,
        amountMinor: '10000',
        currency: 'XOF',
        occurredAt: '2026-02-01T10:00:00.000Z',
        valueDate: '2026-02-01',
      },
      { 'Idempotency-Key': randomUUID() },
    );
    const transfer = await createAs(
      owner,
      '/finance/transfers',
      {
        fromAccountId: account,
        toAccountId: account2,
        fromAmountMinor: '5000',
        occurredAt: '2026-02-01T10:00:00.000Z',
        valueDate: '2026-02-01',
      },
      { 'Idempotency-Key': randomUUID() },
    );
    return { account, category, counterparty, transaction, transfer };
  }

  type FinanceCase = Readonly<{
    verb: Verb;
    path: (fixture: FinanceFixture) => string;
    body?: (fixture: FinanceFixture) => object;
  }>;

  const atFinance = (
    verb: Verb,
    path: FinanceCase['path'],
    extra: Omit<FinanceCase, 'verb' | 'path'> = {},
  ): FinanceCase => ({ verb, path, ...extra });

  const FINANCE_CASES: Readonly<Record<string, FinanceCase>> = {
    'GET /api/v1/finance/accounts/:id': atFinance('get', (f) => `/finance/accounts/${f.account}`),
    'PATCH /api/v1/finance/accounts/:id': atFinance('patch', (f) => `/finance/accounts/${f.account}`, {
      body: () => ({ name: 'Nouveau nom' }),
    }),
    'POST /api/v1/finance/accounts/:id/close': atFinance(
      'post',
      (f) => `/finance/accounts/${f.account}/close`,
    ),
    'POST /api/v1/finance/accounts/:id/reopen': atFinance(
      'post',
      (f) => `/finance/accounts/${f.account}/reopen`,
    ),
    'POST /api/v1/finance/accounts/:id/adjustments': atFinance(
      'post',
      (f) => `/finance/accounts/${f.account}/adjustments`,
      {
        body: () => ({
          amountMinor: '1000',
          direction: 'CREDIT',
          reason: 'Ajustement intrus',
        }),
      },
    ),
    'GET /api/v1/finance/accounts/:id/reconciliations': atFinance(
      'get',
      (f) =>
        `/finance/accounts/${f.account}/reconciliations?statementDate=2026-10-15&statementEndingBalanceMinor=100000`,
    ),
    'POST /api/v1/finance/accounts/:id/reconciliations': atFinance(
      'post',
      (f) => `/finance/accounts/${f.account}/reconciliations`,
      {
        body: () => ({
          statementDate: '2026-10-15',
          statementEndingBalanceMinor: '100000',
          createAdjustmentIfNeeded: false,
        }),
      },
    ),
    'GET /api/v1/finance/categories/:id': atFinance('get', (f) => `/finance/categories/${f.category}`),
    'PATCH /api/v1/finance/categories/:id': atFinance('patch', (f) => `/finance/categories/${f.category}`, {
      body: () => ({ name: 'Nouveau nom catégorie' }),
    }),
    'DELETE /api/v1/finance/categories/:id': atFinance('delete', (f) => `/finance/categories/${f.category}`),
    'GET /api/v1/finance/counterparties/:id': atFinance(
      'get',
      (f) => `/finance/counterparties/${f.counterparty}`,
    ),
    'PATCH /api/v1/finance/counterparties/:id': atFinance(
      'patch',
      (f) => `/finance/counterparties/${f.counterparty}`,
      {
        body: () => ({ name: 'Nouveau nom contrepartie' }),
      },
    ),
    'POST /api/v1/finance/counterparties/:id/archive': atFinance(
      'post',
      (f) => `/finance/counterparties/${f.counterparty}/archive`,
    ),
    'POST /api/v1/finance/counterparties/:id/unarchive': atFinance(
      'post',
      (f) => `/finance/counterparties/${f.counterparty}/unarchive`,
    ),
    'DELETE /api/v1/finance/counterparties/:id': atFinance(
      'delete',
      (f) => `/finance/counterparties/${f.counterparty}`,
    ),
    'GET /api/v1/finance/transactions/:id': atFinance('get', (f) => `/finance/transactions/${f.transaction}`),
    'PATCH /api/v1/finance/transactions/:id': atFinance(
      'patch',
      (f) => `/finance/transactions/${f.transaction}`,
      {
        body: () => ({ description: 'Nouveau libellé' }),
      },
    ),
    'POST /api/v1/finance/transactions/:id/validate': atFinance(
      'post',
      (f) => `/finance/transactions/${f.transaction}/validate`,
    ),
    'POST /api/v1/finance/transactions/:id/cancel': atFinance(
      'post',
      (f) => `/finance/transactions/${f.transaction}/cancel`,
      {
        body: () => ({ reason: 'Annulation cross-user' }),
      },
    ),
    'GET /api/v1/finance/transfers/:id': atFinance('get', (f) => `/finance/transfers/${f.transfer}`),
  };

  function financeCase(spec: FinanceCase): CrossUserCase {
    return async ({ owner, intruder }) => {
      const fixture = await financeFixture(owner);
      const agent = http();
      return agent[spec.verb](`/api/v1${spec.path(fixture)}`)
        .set(CSRF_HEADERS)
        .set('Cookie', intruder.cookie)
        .send(spec.body?.(fixture) ?? {});
    };
  }

  /** « L'utilisateur B obtient 404 sur la ressource de A », une entrée par route privée avec `:id`. */
  const CROSS_USER_CASES: Readonly<Record<string, CrossUserCase>> = {
    ...Object.fromEntries(
      Object.entries(ORGANIZATION_CASES).map(([key, spec]) => [key, organizationCase(spec)]),
    ),
    ...Object.fromEntries(Object.entries(FINANCE_CASES).map(([key, spec]) => [key, financeCase(spec)])),
    'DELETE /api/v1/me/sessions/:id': async ({ owner, intruder }) => {
      const session = await prisma.session.findFirstOrThrow({
        where: { userId: owner.userId, revokedAt: null },
      });
      return http()
        .delete(`/api/v1/me/sessions/${session.id}`)
        .set(CSRF_HEADERS)
        .set('Cookie', intruder.cookie);
    },
  };

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open' });
    prisma = app.get(PrismaService);
    mail = app.get<CapturingMailAdapter>(MAIL);
    routes = listRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const privateRoutes = (): RouteEntry[] => routes.filter((route) => !route.isPublic);

  it('discovers the HTTP routes of the application', () => {
    expect(routes.length).toBeGreaterThan(20);
  });

  it('exposes exactly the whitelisted public routes (API.md §14.1)', () => {
    expect(routes.filter((route) => route.isPublic).map((route) => route.key)).toEqual(
      [...PUBLIC_ROUTES].sort(),
    );
  });

  it('answers 401 UNAUTHENTICATED on every private route without a session', async () => {
    const failures: string[] = [];
    for (const route of privateRoutes()) {
      const verb = route.method.toLowerCase() as Verb;
      const agent = http();
      const target = route.path.replace(/:[A-Za-z]+/g, SOME_ID);
      const response = await agent[verb](target).set(CSRF_HEADERS).send({});
      if (response.status !== 401 || response.body.error?.code !== 'UNAUTHENTICATED') {
        failures.push(`${route.key} → ${response.status}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('covers or explicitly exempts every private route with an :id parameter', () => {
    const uncovered = privateRoutes()
      .filter((route) => route.path.includes(':'))
      .map((route) => route.key)
      .filter((key) => !(key in CROSS_USER_CASES) && !(key in CROSS_USER_EXEMPTIONS));
    const stale = [...Object.keys(CROSS_USER_CASES), ...Object.keys(CROSS_USER_EXEMPTIONS)].filter(
      (key) => !routes.some((route) => route.key === key),
    );
    expect({ uncovered, stale }).toEqual({ uncovered: [], stale: [] });
  });

  it.each(Object.entries(CROSS_USER_CASES))("%s answers 404 to another user's request", async (_key, run) => {
    const owner = await signedIn();
    const intruder = await signedIn();

    const response = await run({ owner, intruder });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
