import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import type { Idea, Note, Task } from '@orbit/contracts';

import { captureQueue } from '@/lib/offline/capture-queue';
import { apiError, mockSession } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';

const NOW = '2026-10-14T10:00:00.000Z';
const ID = (n: number): string => `0192f3a4-5b6c-7d8e-9f01-0000000000${String(n).padStart(2, '0')}`;
const page = <T,>(data: T[]) => ({ data, meta: { limit: 25, nextCursor: null, hasMore: false } });

function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: ID(1),
    title: 'Boutique de wax en ligne',
    description: null,
    status: 'INBOX',
    priority: null,
    domain: null,
    potentialScore: null,
    decisionNote: null,
    capturedAt: NOW,
    source: 'MANUAL',
    convertedProjectId: null,
    tagIds: [],
    version: 1,
    archivedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: ID(2),
    title: 'Appeler Moussa',
    description: null,
    status: 'TODO',
    priority: null,
    projectId: null,
    ideaId: null,
    parentTaskId: null,
    startsOn: null,
    dueDate: '2026-10-14',
    dueAt: null,
    completedAt: null,
    estimatedMinutes: null,
    actualMinutes: null,
    recurrence: null,
    recurrenceSeriesId: null,
    occurrenceDate: null,
    source: 'MANUAL',
    overdue: false,
    tagIds: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function note(overrides: Partial<Note> = {}): Note {
  return {
    id: ID(3),
    title: 'Réunion client',
    content: '# Ordre du jour',
    contentFormat: 'MARKDOWN',
    kind: 'MEETING',
    source: 'MANUAL',
    pinnedAt: null,
    archivedAt: null,
    tagIds: [],
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    links: [],
    ...overrides,
  };
}

const noTags = http.get('/api/v1/tags', () => HttpResponse.json({ data: [] }));

describe('organization pages (PHASE-04)', () => {
  it('lists ideas and captures a new one with a client UUIDv7', async () => {
    mockSession();
    let posted: Record<string, unknown> | null = null;
    server.use(
      http.get('/api/v1/ideas', () => HttpResponse.json(page([idea()]))),
      http.post('/api/v1/ideas', async ({ request }) => {
        posted = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { data: idea({ id: String(posted['id']), title: 'Nouvelle' }) },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp('/ideas');

    expect(await screen.findByRole('link', { name: 'Boutique de wax en ligne' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Nouvelle idée' }), 'Nouvelle');
    await user.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(posted).toMatchObject({ title: 'Nouvelle' });
    });
    expect((posted as unknown as { id: string }).id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
  });

  it('completes a task from the today view and announces the next occurrence', async () => {
    mockSession();
    const recurring = task({
      recurrence: {
        rule: 'FREQ=DAILY',
        anchorOn: '2026-10-14',
        timezone: 'Africa/Dakar',
        nextOccurrenceAt: null,
      },
    });
    server.use(
      http.get('/api/v1/tasks', ({ request }) => {
        expect(new URL(request.url).searchParams.get('view')).toBe('TODAY');
        return HttpResponse.json(page([recurring]));
      }),
      http.post(`/api/v1/tasks/${recurring.id}/complete`, () =>
        HttpResponse.json({
          data: {
            task: { ...recurring, status: 'DONE', completedAt: NOW },
            nextOccurrence: task({
              id: ID(4),
              dueDate: '2026-10-15',
              recurrenceSeriesId: recurring.id,
              occurrenceDate: '2026-10-15',
            }),
          },
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp('/tasks');

    await user.click(await screen.findByRole('checkbox', { name: 'Terminer « Appeler Moussa »' }));
    expect(await screen.findByText('Prochaine occurrence prévue le 15/10/2026.')).toBeInTheDocument();
  });

  it('moves a task between Kanban columns without drag and drop', async () => {
    mockSession();
    let patched: unknown = null;
    server.use(
      http.get('/api/v1/tasks', () => HttpResponse.json(page([task()]))),
      http.patch(`/api/v1/tasks/${ID(2)}`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ data: task({ status: 'IN_PROGRESS' }) });
      }),
    );
    const user = userEvent.setup();
    renderApp('/tasks?display=kanban');

    const column = await screen.findByRole('region', { name: 'À faire' });
    await user.selectOptions(
      within(column).getByRole('combobox', { name: 'Déplacer « Appeler Moussa » vers' }),
      'IN_PROGRESS',
    );
    await waitFor(() => {
      expect(patched).toEqual({ status: 'IN_PROGRESS' });
    });
  });

  it('saves a note with If-Match and offers to reload on a version conflict', async () => {
    mockSession();
    const ifMatch: (string | null)[] = [];
    server.use(
      noTags,
      http.get(`/api/v1/notes/${ID(3)}`, () => HttpResponse.json({ data: note() })),
      http.get('/api/v1/tasks', () => HttpResponse.json(page([]))),
      http.patch(`/api/v1/notes/${ID(3)}`, ({ request }) => {
        ifMatch.push(request.headers.get('If-Match'));
        return apiError(412, 'VERSION_CONFLICT', { currentVersion: 2 });
      }),
    );
    const user = userEvent.setup();
    renderApp(`/notes/${ID(3)}`);

    const content = await screen.findByRole('textbox', { name: 'Contenu' });
    await user.type(content, ' modifié');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByRole('heading', { name: 'Modification concurrente' })).toBeInTheDocument();
    expect(ifMatch).toEqual(['W/"1"']);
    await user.click(screen.getByRole('button', { name: 'Garder ma saisie' }));
    await waitFor(() => {
      expect(ifMatch).toEqual(['W/"1"', 'W/"2"']);
    });
  });

  it('renders note previews safely', async () => {
    mockSession();
    server.use(
      noTags,
      http.get(`/api/v1/notes/${ID(3)}`, () =>
        HttpResponse.json({
          data: note({ content: '<img src=x onerror="alert(1)"> [lien](javascript:alert(1))' }),
        }),
      ),
      http.get('/api/v1/tasks', () => HttpResponse.json(page([]))),
    );
    const user = userEvent.setup();
    renderApp(`/notes/${ID(3)}`);

    await user.click(await screen.findByRole('button', { name: 'Aperçu' }));
    expect(document.querySelector('main img')).toBeNull();
    expect(screen.queryByRole('link', { name: 'lien' })).toBeNull();
  });

  it('queues a quick capture offline and shows it as pending', async () => {
    mockSession();
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
    try {
      const user = userEvent.setup();
      renderApp('/');
      await user.click(await screen.findByRole('button', { name: 'Capture rapide' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByRole('textbox', { name: 'Texte à capturer' }), 'Idée du métro');
      await user.click(within(dialog).getByRole('button', { name: 'Capturer' }));

      expect(await screen.findByText('1 capture en attente de synchronisation')).toBeInTheDocument();
      const pending = await captureQueue.pending();
      expect(pending.map((item) => item.body['title'])).toEqual(['Idée du métro']);
      await Promise.all(pending.map((item) => captureQueue.discard(item.id)));
    } finally {
      if (online !== undefined) Object.defineProperty(navigator, 'onLine', online);
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });
});
