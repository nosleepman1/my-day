import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { mockSession } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import { emptyLists, ID, idea, page, task } from '@/test/organization-fixtures';
import { renderApp } from '@/test/render';

/** Paramètres de requête reçus par une route de liste. */
function listSpy(path: string, rows: unknown[]) {
  const seen: URLSearchParams[] = [];
  return {
    seen,
    handler: http.get(path, ({ request }) => {
      seen.push(new URL(request.url).searchParams);
      return HttpResponse.json(page(rows));
    }),
  };
}

describe('organization interactions (PHASE-04)', () => {
  it('filters ideas by text, status and archive state', async () => {
    mockSession();
    const ideas = listSpy('/api/v1/ideas', [idea()]);
    server.use(ideas.handler, ...emptyLists);
    const user = userEvent.setup();
    renderApp('/ideas');

    await user.type(await screen.findByRole('searchbox', { name: 'Rechercher' }), 'wax');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Statut' }), 'SELECTED');
    await user.click(screen.getByRole('switch', { name: 'Afficher les éléments archivés' }));
    await waitFor(() => {
      const last = ideas.seen.at(-1);
      expect([last?.get('q'), last?.get('status'), last?.get('archived')]).toEqual([
        'wax',
        'SELECTED',
        'true',
      ]);
    });
  });

  it('switches task views and adds a task due today in the dated views', async () => {
    mockSession();
    const tasks = listSpy('/api/v1/tasks', []);
    const posted: unknown[] = [];
    server.use(
      tasks.handler,
      http.post('/api/v1/tasks', async ({ request }) => {
        posted.push(await request.json());
        return HttpResponse.json({ data: task() }, { status: 201 });
      }),
      ...emptyLists,
    );
    const user = userEvent.setup();
    const { router } = renderApp('/tasks');

    expect(await screen.findByText('Rien à faire ici.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nouvelle tâche…' }), 'Payer Senelec');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => {
      expect(posted).toEqual([
        expect.objectContaining({ title: 'Payer Senelec', dueDate: expect.any(String) as unknown }),
      ]);
    });

    await user.click(screen.getByRole('button', { name: 'Sans échéance' }));
    await waitFor(() => {
      expect(router.state.location.search).toContain('view=NO_DUE_DATE');
    });
    await user.type(screen.getByRole('textbox', { name: 'Nouvelle tâche…' }), 'Lire');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));
    await waitFor(() => {
      expect(posted[1]).not.toHaveProperty('dueDate');
    });
    await user.click(screen.getByRole('button', { name: 'Toutes' }));
    await waitFor(() => {
      expect(tasks.seen.at(-1)?.get('view')).toBeNull();
    });
  });

  it('moves a task by drag and drop and reopens a done task', async () => {
    mockSession();
    const calls: string[] = [];
    const done = task({
      id: ID(20),
      title: 'Déjà faite',
      status: 'DONE',
      completedAt: '2026-10-14T09:00:00.000Z',
    });
    server.use(
      http.get('/api/v1/tasks', () => HttpResponse.json(page([task(), done]))),
      http.post('/api/v1/tasks/:id/complete', ({ params }) => {
        calls.push(`complete ${String(params['id'])}`);
        return HttpResponse.json({
          data: {
            task: { ...task(), status: 'DONE', completedAt: '2026-10-14T10:00:00.000Z' },
            nextOccurrence: null,
          },
        });
      }),
      http.post('/api/v1/tasks/:id/reopen', ({ params }) => {
        calls.push(`reopen ${String(params['id'])}`);
        return HttpResponse.json({ data: { ...done, status: 'TODO', completedAt: null } });
      }),
      http.patch('/api/v1/tasks/:id', ({ params }) => {
        calls.push(`patch ${String(params['id'])}`);
        return HttpResponse.json({ data: { ...done, status: 'BLOCKED', completedAt: null } });
      }),
      ...emptyLists,
    );
    renderApp('/tasks?display=kanban');

    const card = (await screen.findByRole('link', { name: 'Appeler Moussa' })).closest('li') as HTMLElement;
    const store = new Map<string, string>();
    const dataTransfer = {
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? '',
      effectAllowed: 'none',
    };
    fireEvent.dragStart(card, { dataTransfer });
    const doneColumn = screen.getByRole('region', { name: 'Terminée' });
    fireEvent.dragOver(doneColumn, { dataTransfer });
    fireEvent.drop(doneColumn, { dataTransfer });

    const user = userEvent.setup();
    const blocked = within(screen.getByRole('region', { name: 'Terminée' }));
    await user.selectOptions(
      blocked.getByRole('combobox', { name: 'Déplacer « Déjà faite » vers' }),
      'BLOCKED',
    );
    await waitFor(() => {
      expect(calls).toEqual([`complete ${ID(2)}`, `reopen ${ID(20)}`, `patch ${ID(20)}`]);
    });
  });
});
