import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { addDays, civilDateIn } from '../../../src/modules/organization/domain/calendar';
import { PrismaService } from '../../../src/platform/database/prisma.service';
import type { IdGeneratorPort } from '../../../src/platform/ids/id-generator.port';
import { ID_GENERATOR } from '../../../src/platform/ids/ids.module';
import { createTestApp } from '../../helpers/create-test-app';
import { asUser, signIn, type UserClient } from '../../helpers/signed-in';

/** PHASE-04 §8 : comportements M03 de bout en bout, à travers l'API et la base réelle. */
describe('organization module (PHASE-04)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ids: IdGeneratorPort;
  let a: UserClient;
  let b: UserClient;

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open' });
    prisma = app.get(PrismaService);
    ids = app.get<IdGeneratorPort>(ID_GENERATOR);
    a = asUser(app, await signIn(app));
    b = asUser(app, await signIn(app));
  });

  afterAll(async () => {
    await app.close();
  });

  const idOf = (response: { body: { data: { id: string } } }) => response.body.data.id;
  /** Identifiants d'une liste de la réponse (`body` est non typé avec supertest). */
  const idsIn = (rows: unknown): string[] => (rows as { id: string }[]).map((row) => row.id);

  it('creates an item once per client id and never reveals another user’s id', async () => {
    const id = ids.next();
    const first = await a
      .post('/ideas', { id, title: 'Capture hors ligne', source: 'QUICK_CAPTURE' })
      .expect(201);
    expect(first.headers['location']).toBe(`/api/v1/ideas/${id}`);
    const replay = await a.post('/ideas', { id, title: 'Capture hors ligne' }).expect(200);
    expect(replay.body.data).toMatchObject({ id, source: 'QUICK_CAPTURE' });
    const stolen = await b.post('/ideas', { id, title: 'Vol' }).expect(409);
    expect(stolen.body.error.code).toBe('CONFLICT');
    await b.get(`/ideas/${id}`).expect(404);
  });

  it('keeps tag names unique case-insensitively and merges tags', async () => {
    const urgent = idOf(await a.post('/tags', { name: 'Urgent' }).expect(201));
    expect((await a.post('/tags', { name: 'urgent' }).expect(409)).body.error.details).toEqual({
      field: 'name',
    });
    const priority = idOf(await a.post('/tags', { name: 'Priorité' }).expect(201));
    const idea = idOf(await a.post('/ideas', { title: 'Taguée', tagIds: [urgent] }).expect(201));
    const merged = await a.post(`/tags/${urgent}/merge`, { targetTagId: priority }).expect(200);
    expect(merged.body.data.usage.ideas).toBe(1);
    expect((await a.get(`/ideas/${idea}`).expect(200)).body.data.tagIds).toEqual([priority]);
    expect(idsIn((await a.get('/tags').expect(200)).body.data)).not.toContain(urgent);
  });

  it('answers 404 to references pointing at another user’s data', async () => {
    const theirTag = idOf(await b.post('/tags', { name: 'chez-b' }).expect(201));
    const theirProject = idOf(await b.post('/projects', { name: 'Projet de B' }).expect(201));
    const theirTask = idOf(await b.post('/tasks', { title: 'Tâche de B' }).expect(201));
    const myTask = idOf(await a.post('/tasks', { title: 'Tâche de A' }).expect(201));
    const myNote = idOf(await a.post('/notes', { content: 'Note de A' }).expect(201));

    await a.post('/ideas', { title: 'x', tagIds: [theirTag] }).expect(404);
    await a.put(`/tasks/${myTask}/tags`, { tagIds: [theirTag] }).expect(404);
    await a.post('/tasks', { title: 'x', projectId: theirProject }).expect(404);
    await a.post('/tasks', { title: 'x', parentTaskId: theirTask }).expect(404);
    await a.post(`/tasks/${myTask}/dependencies`, { dependsOnTaskId: theirTask }).expect(404);
    await a.post(`/notes/${myNote}/links`, { taskId: theirTask }).expect(404);
    await a.get(`/notes?taskId=${theirTask}`).expect(200);
  });

  it('converts an idea into a project exactly once, even under concurrency', async () => {
    const idea = idOf(
      await a.post('/ideas', { title: 'Boutique en ligne de wax', priority: 'HIGH' }).expect(201),
    );
    const [one, two] = await Promise.all([
      a.post(`/ideas/${idea}/convert-to-project`).expect(200),
      a.post(`/ideas/${idea}/convert-to-project`).expect(200),
    ]);
    expect(one.body.data.project.id).toBe(two.body.data.project.id);
    expect([one.body.data.created, two.body.data.created].sort()).toEqual([false, true]);
    expect(one.body.data.idea).toMatchObject({
      status: 'IN_PROGRESS',
      convertedProjectId: one.body.data.project.id,
    });
    expect(one.body.data.project).toMatchObject({ name: 'Boutique en ligne de wax', priority: 'HIGH' });
    const summary = await a.get(`/projects/${one.body.data.project.id}/summary`).expect(200);
    expect(summary.body.data.sourceIdea).toEqual({ id: idea, title: 'Boutique en ligne de wax' });

    const abandoned = idOf(await a.post('/ideas', { title: 'Abandonnée' }).expect(201));
    await a.patch(`/ideas/${abandoned}`, { status: 'ABANDONED' }).expect(200);
    await a.post(`/ideas/${abandoned}/convert-to-project`).expect(409);
  });

  it('suggests similar ideas without accents or case', async () => {
    const base = idOf(await a.post('/ideas', { title: 'Café solidaire à Dakar' }).expect(201));
    const near = idOf(await a.post('/ideas', { title: 'cafe solidaire dakar plateau' }).expect(201));
    await a.post('/ideas', { title: 'Jardinage urbain' }).expect(201);
    const similar = await a.get(`/ideas/${base}/similar`).expect(200);
    expect(idsIn(similar.body.data)).toEqual([near]);
  });

  it('validates idea status transitions', async () => {
    const idea = idOf(await a.post('/ideas', { title: 'Transitions' }).expect(201));
    const refused = await a.patch(`/ideas/${idea}`, { status: 'REALIZED' }).expect(422);
    expect(refused.body.error).toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      details: { from: 'INBOX' },
    });
  });

  it('completes a daily task once under concurrency and schedules the next day', async () => {
    const today = civilDateIn(new Date(), 'Africa/Dakar');
    const task = idOf(
      await a
        .post('/tasks', { title: 'Boire de l’eau', dueDate: today, recurrence: { rule: 'FREQ=DAILY' } })
        .expect(201),
    );
    const [one, two] = await Promise.all([
      a.post(`/tasks/${task}/complete`),
      a.post(`/tasks/${task}/complete`),
    ]);
    expect([one.status, two.status]).toEqual([200, 200]);
    await a.post(`/tasks/${task}/reopen`).expect(200);
    await a.post(`/tasks/${task}/complete`).expect(200);

    const occurrences = await prisma.task.findMany({ where: { recurrenceSeriesId: task } });
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.dueDate?.toISOString().slice(0, 10)).toBe(addDays(today, 1));
    expect(occurrences[0]?.source).toBe('RECURRENCE');

    const history = await a.get(`/tasks/${task}/history`).expect(200);
    const entries = history.body.data as { kind: string; to: string | null }[];
    expect(entries.map((entry) => `${entry.kind}:${entry.to ?? ''}`)).toEqual([
      'STATUS:DONE',
      'STATUS:TODO',
      'STATUS:DONE',
      'CREATED:',
    ]);
  });

  it('refuses dependency cycles with 422 CIRCULAR_DEPENDENCY', async () => {
    const [x, y, z] = await Promise.all(
      ['X', 'Y', 'Z'].map(async (title) => idOf(await a.post('/tasks', { title }))),
    );
    await a.post(`/tasks/${x}/dependencies`, { dependsOnTaskId: y }).expect(201);
    await a.post(`/tasks/${y}/dependencies`, { dependsOnTaskId: z }).expect(201);
    expect(
      (await a.post(`/tasks/${z}/dependencies`, { dependsOnTaskId: x }).expect(422)).body.error.code,
    ).toBe('CIRCULAR_DEPENDENCY');
    await a.post(`/tasks/${x}/dependencies`, { dependsOnTaskId: x }).expect(422);
    const detail = await a.get(`/tasks/${y}`).expect(200);
    expect(idsIn(detail.body.data.dependsOn)).toEqual([z]);
    expect(idsIn(detail.body.data.blocks)).toEqual([x]);
  });

  it('allows a single level of subtasks', async () => {
    const parent = idOf(await a.post('/tasks', { title: 'Parent' }).expect(201));
    const child = idOf(await a.post('/tasks', { title: 'Enfant', parentTaskId: parent }).expect(201));
    const refused = await a.post('/tasks', { title: 'Petit-enfant', parentTaskId: child }).expect(422);
    expect(refused.body.error.details).toEqual({ rule: 'SUBTASK_DEPTH' });
    expect((await a.get(`/tasks/${parent}`).expect(200)).body.data.subtasks).toHaveLength(1);
  });

  it('computes task views in the user’s timezone', async () => {
    const user = asUser(app, await signIn(app));
    await user.patch('/me/preferences', { timezone: 'Pacific/Kiritimati' }).expect(200);
    const today = civilDateIn(new Date(), 'Pacific/Kiritimati');
    const create = async (title: string, dueDate?: string) =>
      idOf(await user.post('/tasks', dueDate === undefined ? { title } : { title, dueDate }).expect(201));
    const overdue = await create('En retard', addDays(today, -1));
    const due = await create('Aujourd’hui', today);
    const none = await create('Sans échéance');
    const view = async (name: string) => idsIn((await user.get(`/tasks?view=${name}`).expect(200)).body.data);

    expect(await view('OVERDUE')).toEqual([overdue]);
    expect(await view('TODAY')).toEqual([due]);
    expect(await view('NO_DUE_DATE')).toEqual([none]);
    const all = await user.get('/tasks').expect(200);
    const rows = all.body.data as { id: string; overdue: boolean }[];
    expect(rows.find((task) => task.id === overdue)?.overdue).toBe(true);
  });

  it('requires If-Match on notes and reports version conflicts', async () => {
    const created = await a.post('/notes', { title: 'Réunion', content: '# Ordre du jour' }).expect(201);
    const note = idOf(created);
    expect(created.headers['etag']).toBe('W/"1"');
    expect((await a.patch(`/notes/${note}`, { content: 'v2' }).expect(428)).body.error.code).toBe(
      'PRECONDITION_REQUIRED',
    );
    const updated = await a.patch(`/notes/${note}`, { content: 'v2' }, 'W/"1"').expect(200);
    expect(updated.headers['etag']).toBe('W/"2"');
    const conflict = await a.patch(`/notes/${note}`, { content: 'v3' }, 'W/"1"').expect(412);
    expect(conflict.body.error).toMatchObject({ code: 'VERSION_CONFLICT', details: { currentVersion: 2 } });
    await a.delete(`/notes/${note}`).expect(428);
    await a.delete(`/notes/${note}`, '"2"').expect(204);
    await a.get(`/notes/${note}`).expect(404);
  });

  it('links a note to one item and lists notes by linked item', async () => {
    const project = idOf(await a.post('/projects', { name: 'Site vitrine' }).expect(201));
    const note = idOf(await a.post('/notes', { content: 'Brief client' }).expect(201));
    const link = await a.post(`/notes/${note}/links`, { projectId: project }).expect(201);
    expect(link.body.data).toMatchObject({
      targetType: 'PROJECT',
      targetId: project,
      targetTitle: 'Site vitrine',
    });
    const again = await a.post(`/notes/${note}/links`, { projectId: project }).expect(201);
    expect(again.body.data.id).toBe(link.body.data.id);
    const listed = await a.get(`/notes?projectId=${project}`).expect(200);
    expect(idsIn(listed.body.data)).toEqual([note]);
    await a.post(`/notes/${note}/links`, { projectId: project, taskId: project }).expect(400);
  });

  it('paginates with a cursor bound to its sort key', async () => {
    const user = asUser(app, await signIn(app));
    for (const title of ['un', 'deux', 'trois', 'quatre', 'cinq'])
      await user.post('/ideas', { title }).expect(201);
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = cursor === null ? '' : `&cursor=${cursor}`;
      const page = await user.get(`/ideas?limit=2${query}`).expect(200);
      seen.push(...idsIn(page.body.data));
      cursor = page.body.meta.nextCursor as string | null;
      if (cursor !== null) {
        const wrongSort = await user.get(`/ideas?limit=2&sort=-priority&cursor=${cursor}`).expect(400);
        expect(wrongSort.body.error.code).toBe('INVALID_CURSOR');
      }
    } while (cursor !== null);
    expect(new Set(seen).size).toBe(5);
  });

  it('marks a completed project with the user’s day and derives progress', async () => {
    const project = idOf(await a.post('/projects', { name: 'Progression' }).expect(201));
    const done = idOf(await a.post('/tasks', { title: 'Faite', projectId: project }).expect(201));
    await a.post('/tasks', { title: 'Ouverte', projectId: project }).expect(201);
    const cancelled = idOf(await a.post('/tasks', { title: 'Annulée', projectId: project }).expect(201));
    await a.post(`/tasks/${done}/complete`).expect(200);
    await a.patch(`/tasks/${cancelled}`, { status: 'CANCELLED' }).expect(200);
    const summary = await a.get(`/projects/${project}/summary`).expect(200);
    expect(summary.body.data).toMatchObject({
      progressPercent: 50,
      tasks: { total: 3, done: 1, cancelled: 1, open: 1 },
    });
    const completed = await a.patch(`/projects/${project}`, { status: 'COMPLETED' }).expect(200);
    expect(completed.body.data.completedOn).toBe(civilDateIn(new Date(), 'Africa/Dakar'));
    await a.post(`/projects/${project}/archive`).expect(200);
    await a.post('/tasks', { title: 'x', projectId: project }).expect(422);
  });

  it('drops the due time when only the due date moves', async () => {
    const task = idOf(
      await a
        .post('/tasks', { title: 'Rendez-vous', dueDate: '2026-10-10', dueAt: '2026-10-10T14:00:00Z' })
        .expect(201),
    );
    const moved = await a.patch(`/tasks/${task}`, { dueDate: '2026-10-20' }).expect(200);
    expect(moved.body.data).toMatchObject({ dueDate: '2026-10-20', dueAt: null });
  });
});
