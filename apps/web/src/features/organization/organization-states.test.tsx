import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiError, mockSession } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import {
  emptyLists,
  ID,
  idea,
  note,
  noteSummary,
  NOW,
  page,
  task,
  taskDetail,
} from '@/test/organization-fixtures';
import { renderApp } from '@/test/render';

describe('organization states (PHASE-04)', () => {
  it('shows not found for an unknown or foreign item', async () => {
    mockSession();
    server.use(
      http.get(`/api/v1/ideas/${ID(1)}`, () => apiError(404, 'NOT_FOUND')),
      http.get(`/api/v1/tasks/${ID(2)}`, () => apiError(404, 'NOT_FOUND')),
      http.get(`/api/v1/notes/${ID(3)}`, () => apiError(500, 'INTERNAL_ERROR')),
      ...emptyLists,
    );
    const { router } = renderApp(`/ideas/${ID(1)}`);
    expect(await screen.findByText('Page introuvable')).toBeInTheDocument();
    await router.navigate(`/tasks/${ID(2)}`);
    expect(await screen.findByText('Page introuvable')).toBeInTheDocument();
    await router.navigate(`/notes/${ID(3)}`);
    expect(await screen.findByText('Impossible de charger ces données')).toBeInTheDocument();
  });

  it('renders an archived idea read-only with its linked notes, and restores it', async () => {
    mockSession();
    let restored = false;
    server.use(
      http.get(`/api/v1/ideas/${ID(1)}`, () =>
        HttpResponse.json({
          data: idea({ archivedAt: NOW, convertedProjectId: ID(5), status: 'IN_PROGRESS' }),
        }),
      ),
      http.get(`/api/v1/ideas/${ID(1)}/similar`, () => HttpResponse.json({ data: [] })),
      http.get('/api/v1/notes', () => HttpResponse.json(page([noteSummary()]))),
      http.post(`/api/v1/ideas/${ID(1)}/restore`, () => {
        restored = true;
        return HttpResponse.json({ data: idea() });
      }),
      ...emptyLists,
    );
    const user = userEvent.setup();
    renderApp(`/ideas/${ID(1)}`);

    expect(await screen.findByRole('link', { name: 'Réunion client' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Voir le projet issu de cette idée' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Titre' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Enregistrer' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Restaurer' }));
    await waitFor(() => {
      expect(restored).toBe(true);
    });
  });

  it('links a note to a task and removes the link', async () => {
    mockSession();
    const calls: string[] = [];
    server.use(
      http.get(`/api/v1/notes/${ID(3)}`, () =>
        HttpResponse.json({
          data: note({
            links: [{ id: ID(30), targetType: 'IDEA', targetId: ID(1), targetTitle: 'Wax', createdAt: NOW }],
          }),
        }),
      ),
      http.get('/api/v1/tasks', () => HttpResponse.json(page([task()]))),
      http.post(`/api/v1/notes/${ID(3)}/links`, async ({ request }) => {
        calls.push(`link ${JSON.stringify(await request.json())}`);
        return HttpResponse.json(
          {
            data: {
              id: ID(31),
              targetType: 'TASK',
              targetId: ID(2),
              targetTitle: 'Appeler Moussa',
              createdAt: NOW,
            },
          },
          { status: 201 },
        );
      }),
      http.delete(`/api/v1/notes/${ID(3)}/links/${ID(30)}`, () => {
        calls.push('unlink');
        return new HttpResponse(null, { status: 204 });
      }),
      ...emptyLists,
    );
    const user = userEvent.setup();
    renderApp(`/notes/${ID(3)}`);

    expect(await screen.findByRole('link', { name: 'Wax' })).toHaveAttribute('href', `/ideas/${ID(1)}`);
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Élément' }), ID(2));
    await user.click(screen.getByRole('button', { name: 'Relier' }));
    await user.click(screen.getByRole('button', { name: 'Retirer Wax' }));
    await waitFor(() => {
      expect(calls).toEqual([`link {"taskId":"${ID(2)}"}`, 'unlink']);
    });
  });

  it('shows a generated occurrence, completes it and deletes it', async () => {
    mockSession();
    const calls: string[] = [];
    server.use(
      http.get(`/api/v1/tasks/${ID(2)}`, () =>
        HttpResponse.json({
          data: taskDetail({
            recurrenceSeriesId: ID(40),
            occurrenceDate: '2026-10-15',
            dueDate: '2026-10-15',
            blocks: [{ id: ID(41), title: 'Livrer', status: 'BLOCKED', dueDate: null }],
            dependsOn: [{ id: ID(42), title: 'Valider', status: 'TODO', dueDate: null }],
          }),
        }),
      ),
      http.get(`/api/v1/tasks/${ID(2)}/history`, () => HttpResponse.json({ data: [] })),
      http.post(`/api/v1/tasks/${ID(2)}/complete`, () => {
        calls.push('complete');
        return HttpResponse.json({
          data: { task: task({ status: 'DONE', completedAt: NOW }), nextOccurrence: null },
        });
      }),
      http.delete(`/api/v1/tasks/${ID(2)}/dependencies/${ID(42)}`, () => {
        calls.push('undepend');
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(`/api/v1/tasks/${ID(2)}`, () => {
        calls.push('delete');
        return new HttpResponse(null, { status: 204 });
      }),
      ...emptyLists,
    );
    const user = userEvent.setup();
    const { router } = renderApp(`/tasks/${ID(2)}`);

    expect(await screen.findByText('Occurrence du 15/10/2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Livrer' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retirer Valider' }));
    await user.click(screen.getByRole('button', { name: 'Terminer' }));
    await user.click(screen.getByRole('button', { name: 'Supprimer' }));
    await user.click(await screen.findByRole('button', { name: 'Confirmer' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/tasks');
    });
    expect(calls).toEqual(['undepend', 'complete', 'delete']);
  });
});
