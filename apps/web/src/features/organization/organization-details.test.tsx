import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { captureQueue } from '@/lib/offline/capture-queue';
import { apiError, mockSession, preferences, sessionUser, USER_ID } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import {
  emptyLists,
  ID,
  NOW,
  idea,
  note,
  noteSummary,
  page,
  project,
  summary,
  tag,
  task,
  taskDetail,
} from '@/test/organization-fixtures';
import { renderApp } from '@/test/render';

/** Corps reçus par route : `record('PATCH /ideas/x')`. */
function recorder() {
  const calls: { key: string; body: unknown }[] = [];
  const record =
    (key: string) =>
    async ({ request }: { request: Request }) => {
      const text = await request.text();
      calls.push({ key, body: text === '' ? null : (JSON.parse(text) as unknown) });
    };
  return {
    calls,
    record,
    bodies: (key: string) => calls.filter((call) => call.key === key).map((call) => call.body),
  };
}

/** Session avec le module Projets activé (absent des préférences par défaut des tests). */
function withProjects(): void {
  mockSession(sessionUser(), preferences({ enabledModules: ['ideas', 'tasks', 'notes', 'projects'] }));
}

describe('organization detail pages (PHASE-04)', () => {
  it('edits an idea, toggles a tag and converts it into a project', async () => {
    withProjects();
    const log = recorder();
    server.use(
      http.get('/api/v1/tags', () => HttpResponse.json({ data: [tag()] })),
      http.get(`/api/v1/ideas/${ID(1)}`, () => HttpResponse.json({ data: idea() })),
      http.get(`/api/v1/ideas/${ID(1)}/similar`, () =>
        HttpResponse.json({ data: [{ id: ID(9), title: 'Wax à Dakar', status: 'INBOX', similarity: 0.6 }] }),
      ),
      http.patch(`/api/v1/ideas/${ID(1)}`, async (info) => {
        await log.record('PATCH idea')(info);
        return HttpResponse.json({ data: idea({ title: 'Wax premium', version: 2 }) });
      }),
      http.put(`/api/v1/ideas/${ID(1)}/tags`, async (info) => {
        await log.record('PUT tags')(info);
        return HttpResponse.json({ data: idea({ tagIds: [ID(7)] }) });
      }),
      http.post(`/api/v1/ideas/${ID(1)}/convert-to-project`, () =>
        HttpResponse.json({
          data: {
            idea: idea({ status: 'IN_PROGRESS', convertedProjectId: ID(5) }),
            project: project(),
            created: true,
          },
        }),
      ),
      http.get(`/api/v1/projects/${ID(5)}`, () => HttpResponse.json({ data: project() })),
      http.get(`/api/v1/projects/${ID(5)}/summary`, () => HttpResponse.json({ data: summary() })),
      ...emptyLists,
    );
    const user = userEvent.setup();
    const { router } = renderApp(`/ideas/${ID(1)}`);

    expect(await screen.findByRole('link', { name: 'Wax à Dakar' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Titre' });
    await user.clear(title);
    await user.type(title, 'Wax premium');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => {
      expect(log.bodies('PATCH idea')).toEqual([
        expect.objectContaining({ title: 'Wax premium', priority: null }),
      ]);
    });
    await user.click(screen.getByRole('button', { name: 'urgent' }));
    await waitFor(() => {
      expect(log.bodies('PUT tags')).toEqual([{ tagIds: [ID(7)] }]);
    });

    await user.click(screen.getByRole('button', { name: 'Transformer en projet' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/projects/${ID(5)}`);
    });
    expect(await screen.findByText('Progression : 33 %')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: "Idée d'origine : Boutique de wax en ligne" }),
    ).toBeInTheDocument();
  });

  it('archives an idea and deletes it after confirmation', async () => {
    withProjects();
    const log = recorder();
    server.use(
      http.get(`/api/v1/ideas/${ID(1)}`, () => HttpResponse.json({ data: idea() })),
      http.get(`/api/v1/ideas/${ID(1)}/similar`, () => HttpResponse.json({ data: [] })),
      http.post(`/api/v1/ideas/${ID(1)}/archive`, async (info) => {
        await log.record('archive')(info);
        return HttpResponse.json({ data: idea({ archivedAt: '2026-10-14T11:00:00.000Z' }) });
      }),
      http.delete(`/api/v1/ideas/${ID(1)}`, () => new HttpResponse(null, { status: 204 })),
      ...emptyLists,
    );
    const user = userEvent.setup();
    const { router } = renderApp(`/ideas/${ID(1)}`);

    await user.click(await screen.findByRole('button', { name: 'Archiver' }));
    await waitFor(() => {
      expect(log.calls.map((call) => call.key)).toEqual(['archive']);
    });
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmer' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/ideas');
    });
  });

  it('shows a project with its tasks and adds one', async () => {
    withProjects();
    const log = recorder();
    server.use(
      http.get(`/api/v1/projects/${ID(5)}`, () => HttpResponse.json({ data: project() })),
      http.get(`/api/v1/projects/${ID(5)}/summary`, () =>
        HttpResponse.json({ data: summary({ progressPercent: null, sourceIdea: null }) }),
      ),
      http.get('/api/v1/tasks', () => HttpResponse.json(page([task({ projectId: ID(5), overdue: true })]))),
      http.post('/api/v1/tasks', async (info) => {
        await log.record('POST task')(info);
        return HttpResponse.json({ data: task({ id: ID(6), title: 'Maquette' }) }, { status: 201 });
      }),
      http.patch(`/api/v1/projects/${ID(5)}`, async (info) => {
        await log.record('PATCH project')(info);
        return HttpResponse.json({
          data: project({ status: 'COMPLETED', completedOn: '2026-10-14', version: 2 }),
        });
      }),
      ...emptyLists,
    );
    const user = userEvent.setup();
    renderApp(`/projects/${ID(5)}`);

    expect(await screen.findByText("Aucune tâche pour l'instant")).toBeInTheDocument();
    expect(await screen.findByText('En retard')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nouvelle tâche…' }), 'Maquette');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => {
      expect(log.bodies('POST task')).toEqual([
        expect.objectContaining({ title: 'Maquette', projectId: ID(5) }),
      ]);
    });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), 'COMPLETED');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => {
      expect(log.bodies('PATCH project')).toEqual([
        expect.objectContaining({ status: 'COMPLETED', targetOn: '2026-12-01' }),
      ]);
    });
  });

  it('manages subtasks, dependencies, recurrence and history of a task', async () => {
    withProjects();
    const log = recorder();
    const blocker = task({ id: ID(8), title: 'Obtenir le devis' });
    server.use(
      http.get(`/api/v1/tasks/${ID(2)}`, () =>
        HttpResponse.json({
          data: taskDetail({
            subtasks: [{ id: ID(10), title: 'Préparer le brief', status: 'TODO', dueDate: null }],
          }),
        }),
      ),
      http.get(`/api/v1/tasks/${ID(2)}/history`, () =>
        HttpResponse.json({
          data: [
            { id: ID(11), kind: 'DUE_DATE', from: null, to: '2026-10-14', occurredAt: NOW },
            { id: ID(2), kind: 'CREATED', from: null, to: null, occurredAt: NOW },
          ],
        }),
      ),
      http.get('/api/v1/tasks', () => HttpResponse.json(page([blocker]))),
      http.post(`/api/v1/tasks/${ID(2)}/dependencies`, () => apiError(422, 'CIRCULAR_DEPENDENCY')),
      http.post('/api/v1/tasks', async (info) => {
        await log.record('POST subtask')(info);
        return HttpResponse.json({ data: task({ id: ID(12) }) }, { status: 201 });
      }),
      http.patch(`/api/v1/tasks/${ID(2)}`, async (info) => {
        await log.record('PATCH task')(info);
        return HttpResponse.json({ data: task({ version: 2 }) });
      }),
      ...emptyLists,
    );
    const user = userEvent.setup();
    renderApp(`/tasks/${ID(2)}`);

    expect(await screen.findByRole('link', { name: 'Préparer le brief' })).toBeInTheDocument();
    expect(await screen.findByText('Échéance : aucune → 14/10/2026')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nouvelle sous-tâche…' }), 'Relire');
    await user.click(screen.getAllByRole('button', { name: 'Ajouter' })[0]!);
    await waitFor(() => {
      expect(log.bodies('POST subtask')).toEqual([
        expect.objectContaining({ title: 'Relire', parentTaskId: ID(2) }),
      ]);
    });

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Choisir une tâche' }), ID(8));
    await user.click(screen.getAllByRole('button', { name: 'Ajouter' })[1]!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Récurrence' }), 'WEEKLY');
    await user.clear(screen.getByRole('spinbutton', { name: 'Intervalle' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Intervalle' }), '2');
    await user.click(screen.getAllByRole('button', { name: 'Enregistrer' })[1]!);
    await waitFor(() => {
      expect(log.bodies('PATCH task')).toEqual([{ recurrence: { rule: 'FREQ=WEEKLY;INTERVAL=2' } }]);
    });
  });

  it('lists projects and notes, and creates them', async () => {
    withProjects();
    server.use(
      http.get('/api/v1/projects', () => HttpResponse.json(page([project()]))),
      http.post('/api/v1/projects', () =>
        HttpResponse.json({ data: project({ id: ID(13), name: 'Blog' }) }, { status: 201 }),
      ),
      http.get('/api/v1/notes', ({ request }) => {
        const pinned = new URL(request.url).searchParams.get('pinned') === 'true';
        return HttpResponse.json(
          page([noteSummary(pinned ? { pinnedAt: NOW } : { id: ID(14), title: null })]),
        );
      }),
      http.post('/api/v1/notes', () =>
        HttpResponse.json({ data: note({ id: ID(15), title: null, content: '' }) }, { status: 201 }),
      ),
      http.get(`/api/v1/notes/${ID(15)}`, () =>
        HttpResponse.json({ data: note({ id: ID(15), title: null, content: '' }) }),
      ),
      ...emptyLists,
    );
    const user = userEvent.setup();
    const { router } = renderApp('/projects');

    expect(await screen.findByRole('link', { name: 'Site vitrine' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nouveau projet' }), 'Blog');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    await router.navigate('/notes');
    expect(await screen.findByRole('heading', { name: 'Épinglées' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sans titre' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nouvelle note' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/notes/${ID(15)}`);
    });
  });

  it('renames, merges and deletes tags', async () => {
    withProjects();
    const log = recorder();
    server.use(
      http.get('/api/v1/tags', () =>
        HttpResponse.json({ data: [tag(), tag({ id: ID(16), name: 'client', color: null })] }),
      ),
      http.patch(`/api/v1/tags/${ID(7)}`, async (info) => {
        await log.record('PATCH tag')(info);
        return HttpResponse.json({ data: tag({ name: 'prioritaire' }) });
      }),
      http.post(`/api/v1/tags/${ID(7)}/merge`, async (info) => {
        await log.record('merge')(info);
        return HttpResponse.json({ data: tag({ id: ID(16), name: 'client' }) });
      }),
      http.delete(`/api/v1/tags/${ID(16)}`, async (info) => {
        await log.record('delete')(info);
        return new HttpResponse(null, { status: 204 });
      }),
      http.post('/api/v1/tags', () => apiError(409, 'CONFLICT', { field: 'name' })),
    );
    const user = userEvent.setup();
    renderApp('/settings/tags');

    const name = await screen.findByRole('textbox', { name: 'Nom urgent' });
    await user.clear(name);
    await user.type(name, 'prioritaire');
    await user.tab();
    await waitFor(() => {
      expect(log.bodies('PATCH tag')).toEqual([{ name: 'prioritaire' }]);
    });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Fusionner dans urgent' }), ID(16));
    await user.click(screen.getAllByRole('button', { name: 'Fusionner' })[0]!);
    await waitFor(() => {
      expect(log.bodies('merge')).toEqual([{ targetTagId: ID(16) }]);
    });
    await user.click(screen.getAllByRole('button', { name: 'Supprimer' })[1]!);
    await user.click(await screen.findByRole('button', { name: 'Confirmer' }));
    await waitFor(() => {
      expect(log.calls.map((call) => call.key)).toContain('delete');
    });
    await user.type(screen.getByRole('textbox', { name: 'Nouveau tag' }), 'urgent');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('replays queued captures once the app starts online', async () => {
    withProjects();
    const sent: unknown[] = [];
    await captureQueue.enqueue({
      id: ID(17),
      ownerId: USER_ID,
      kind: 'task',
      body: { id: ID(17), title: 'Hors ligne' },
      createdAt: NOW,
    });
    server.use(
      http.post('/api/v1/tasks', async ({ request }) => {
        sent.push(await request.json());
        return HttpResponse.json({ data: task({ id: ID(17) }) }, { status: 201 });
      }),
      ...emptyLists,
    );
    renderApp('/');
    await waitFor(async () => {
      expect(await captureQueue.pending()).toEqual([]);
    });
    expect(sent).toEqual([{ id: ID(17), title: 'Hors ligne' }]);
  });
});
