import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { addDays, civilDateIn } from '../../../src/modules/organization/domain/calendar';
import { createTestApp } from '../../helpers/create-test-app';
import { asUser, signIn, type UserClient } from '../../helpers/signed-in';

/** PHASE-04 : filtres, tris et cycle de vie (archivage, suppression, tags) des listes M03. */
describe('organization lists and lifecycles (PHASE-04)', () => {
  let app: INestApplication;
  let user: UserClient;

  beforeAll(async () => {
    app = await createTestApp({ REGISTRATION_MODE: 'open' });
    user = asUser(app, await signIn(app));
  });

  afterAll(async () => {
    await app.close();
  });

  const idOf = (response: { body: { data: { id: string } } }) => response.body.data.id;
  const idsIn = (rows: unknown): string[] => (rows as { id: string }[]).map((row) => row.id);
  const list = async (path: string) => idsIn((await user.get(path).expect(200)).body.data);

  it('renames, recolors and deletes tags, and refuses a duplicate rename', async () => {
    const first = idOf(await user.post('/tags', { name: 'maison' }).expect(201));
    await user.post('/tags', { name: 'bureau', color: '#112233' }).expect(201);
    const renamed = await user.patch(`/tags/${first}`, { name: 'Foyer', color: null }).expect(200);
    expect(renamed.body.data).toMatchObject({ name: 'Foyer', color: null });
    expect((await user.patch(`/tags/${first}`, { name: 'BUREAU' }).expect(409)).body.error.code).toBe(
      'CONFLICT',
    );
    await user.post(`/tags/${first}/merge`, { targetTagId: first }).expect(422);
    await user.delete(`/tags/${first}`).expect(204);
    await user.delete(`/tags/${first}`).expect(404);
  });

  it('filters, sorts, archives, restores, tags and deletes ideas', async () => {
    const tag = idOf(await user.post('/tags', { name: 'idées' }).expect(201));
    const urgent = idOf(
      await user
        .post('/ideas', { title: 'Épicerie fine', priority: 'URGENT', domain: 'Commerce' })
        .expect(201),
    );
    const low = idOf(
      await user.post('/ideas', { title: 'Podcast', priority: 'LOW', tagIds: [tag] }).expect(201),
    );
    const none = idOf(await user.post('/ideas', { title: 'Sans priorité', status: 'TO_REVIEW' }).expect(201));

    expect(await list('/ideas?sort=-priority&limit=100')).toEqual(
      expect.arrayContaining([urgent, low, none]),
    );
    const byPriority = await list('/ideas?sort=-priority');
    expect(byPriority.indexOf(urgent)).toBeLessThan(byPriority.indexOf(low));
    expect(byPriority.indexOf(low)).toBeLessThan(byPriority.indexOf(none));
    expect(await list('/ideas?priority=URGENT,LOW&sort=-updatedAt')).toEqual(
      expect.arrayContaining([urgent, low]),
    );
    expect(await list('/ideas?status=TO_REVIEW')).toEqual([none]);
    expect(await list(`/ideas?tagId=${tag}`)).toEqual([low]);
    expect(await list('/ideas?domain=commerce&source=MANUAL')).toEqual([urgent]);
    expect(await list('/ideas?q=podc')).toEqual([low]);

    await user.post(`/ideas/${low}/archive`).expect(200);
    expect(await list('/ideas?archived=true')).toEqual([low]);
    expect(await list('/ideas')).not.toContain(low);
    await user.post(`/ideas/${low}/restore`).expect(200);
    const untagged = await user.put(`/ideas/${low}/tags`, { tagIds: [] }).expect(200);
    expect(untagged.body.data.tagIds).toEqual([]);
    await user.patch(`/ideas/${low}`, { title: 'Podcast v2' }, 'W/"99"').expect(412);
    await user.delete(`/ideas/${low}`).expect(204);
    await user.get(`/ideas/${low}`).expect(404);
  });

  it('filters and sorts projects, keeps explicit slugs unique and manages their lifecycle', async () => {
    const tag = idOf(await user.post('/tags', { name: 'clients' }).expect(201));
    const alpha = idOf(
      await user
        .post('/projects', {
          name: 'Alpha',
          slug: 'alpha',
          type: 'FREELANCE',
          targetOn: '2026-12-01',
          tagIds: [tag],
        })
        .expect(201),
    );
    const beta = idOf(await user.post('/projects', { name: 'Beta', status: 'ACTIVE' }).expect(201));
    await user.post('/projects', { name: 'Autre', slug: 'alpha' }).expect(409);
    const twin = await user.post('/projects', { name: 'Alpha' }).expect(201);
    expect(twin.body.data.slug).toBe('alpha-2');

    expect((await list('/projects?sort=name')).slice(0, 2)).toEqual([alpha, twin.body.data.id]);
    expect((await list('/projects?sort=targetOn'))[0]).toBe(alpha);
    expect(await list('/projects?status=ACTIVE')).toEqual([beta]);
    expect(await list('/projects?type=FREELANCE')).toEqual([alpha]);
    expect(await list(`/projects?tagId=${tag}&q=alp`)).toEqual([alpha]);

    await user.patch(`/projects/${alpha}`, { startsOn: '2027-01-01' }).expect(400);
    await user.patch(`/projects/${alpha}`, { status: 'COMPLETED' }).expect(200);
    const reopened = await user.patch(`/projects/${alpha}`, { status: 'ACTIVE' }).expect(200);
    expect(reopened.body.data.completedOn).toBeNull();
    await user.put(`/projects/${alpha}/tags`, { tagIds: [] }).expect(200);
    await user.post(`/projects/${beta}/archive`).expect(200);
    expect(await list('/projects?archived=all&status=ACTIVE')).toContain(beta);
    await user.post(`/projects/${beta}/restore`).expect(200);
    await user.delete(`/projects/${beta}`).expect(204);
    await user.get(`/projects/${beta}/summary`).expect(404);
  });

  it('serves the week and no-due-date views, sorts tasks and deletes subtasks with their parent', async () => {
    const today = civilDateIn(new Date(), 'Africa/Dakar');
    const week = idOf(
      await user.post('/tasks', { title: 'Cette semaine', dueDate: today, priority: 'HIGH' }).expect(201),
    );
    const later = idOf(
      await user.post('/tasks', { title: 'Plus tard', dueDate: addDays(today, 30) }).expect(201),
    );
    const undated = idOf(
      await user.post('/tasks', { title: 'Un jour', startsOn: addDays(today, -1) }).expect(201),
    );
    const child = idOf(await user.post('/tasks', { title: 'Sous-tâche', parentTaskId: undated }).expect(201));

    expect(await list('/tasks?view=THIS_WEEK')).toContain(week);
    expect(await list('/tasks?view=THIS_WEEK')).not.toContain(later);
    expect(await list('/tasks?view=NO_DUE_DATE&parentTaskId=none')).toEqual([undated]);
    expect(await list('/tasks?view=TODAY')).toContain(undated);
    expect((await list('/tasks?sort=-priority'))[0]).toBe(week);
    expect(await list('/tasks?sort=-createdAt&q=sous')).toEqual([child]);
    expect(await list(`/tasks?parentTaskId=${undated}&status=TODO`)).toEqual([child]);

    await user.put(`/tasks/${week}/tags`, { tagIds: [] }).expect(200);
    await user.post(`/tasks/${week}/reopen`).expect(422);
    await user.patch(`/tasks/${week}`, { status: 'CANCELLED' }).expect(200);
    await user.patch(`/tasks/${week}`, { status: 'TODO' }).expect(422);
    await user.post(`/tasks/${week}/complete`).expect(422);
    await user.delete(`/tasks/${undated}`).expect(204);
    await user.get(`/tasks/${child}`).expect(404);
    await user.delete(`/tasks/${undated}/dependencies/${later}`).expect(404);
  });

  it('filters notes by pin, kind, text and archive state, and manages tags and links', async () => {
    const pinned = idOf(
      await user
        .post('/notes', { title: 'Épinglée', content: 'Liste de courses', pinned: true, kind: 'CHECKLIST' })
        .expect(201),
    );
    const plain = idOf(await user.post('/notes', { content: 'Compte rendu du lundi' }).expect(201));
    const idea = idOf(await user.post('/ideas', { title: 'Cible' }).expect(201));

    expect(await list('/notes?pinned=true')).toEqual([pinned]);
    expect(await list('/notes?pinned=false&kind=NOTE')).toEqual([plain]);
    expect(await list('/notes?q=lundi&sort=title')).toEqual([plain]);

    const unpinned = await user.patch(`/notes/${pinned}`, { pinned: false, title: '' }, '"1"').expect(200);
    expect(unpinned.body.data).toMatchObject({ pinnedAt: null, title: null });
    await user.put(`/notes/${plain}/tags`, { tagIds: [] }).expect(200);
    const link = idOf(await user.post(`/notes/${plain}/links`, { ideaId: idea }).expect(201));
    expect(await list(`/notes?ideaId=${idea}`)).toEqual([plain]);
    await user.delete(`/notes/${plain}/links/${link}`).expect(204);
    await user.delete(`/notes/${plain}/links/${link}`).expect(404);

    await user.post(`/notes/${plain}/archive`).expect(200);
    expect(await list('/notes?archived=true')).toEqual([plain]);
    await user.post(`/notes/${plain}/restore`).expect(200);
    await user.patch(`/notes/${plain}`, { content: 'x' }, 'pas-une-version').expect(400);
  });
});
