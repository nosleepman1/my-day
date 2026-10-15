import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { captureQueue } from '@/lib/offline/capture-queue';
import { apiError, mockSession, USER_ID } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';

import { captureBody, sendCapture, submitCapture } from './capture.api';

const ID = '0192f3a4-5b6c-7d8e-9f01-000000000099';
const capture = {
  id: ID,
  ownerId: USER_ID,
  kind: 'idea' as const,
  body: { id: ID, title: 'x' },
  createdAt: '2026-10-14T10:00:00.000Z',
  error: null,
};

afterEach(async () => {
  await Promise.all((await captureQueue.pending()).map((item) => captureQueue.discard(item.id)));
});

describe('quick capture API (PHASE-04 T15)', () => {
  it('turns the first line into the title and the rest into the description', () => {
    expect(captureBody({ kind: 'idea', text: ' Titre \nSuite du texte ' }, ID)).toEqual({
      id: ID,
      title: 'Titre',
      description: 'Suite du texte',
      source: 'QUICK_CAPTURE',
    });
    expect(captureBody({ kind: 'task', text: 'Payer', dueDate: '2026-10-15' }, ID)).toMatchObject({
      dueDate: '2026-10-15',
    });
    expect(captureBody({ kind: 'task', text: 'Payer', dueDate: '' }, ID)).not.toHaveProperty('dueDate');
    expect(captureBody({ kind: 'note', text: 'Ligne 1\nLigne 2' }, ID)).toEqual({
      id: ID,
      content: 'Ligne 1\nLigne 2',
      source: 'QUICK_CAPTURE',
    });
    const long = captureBody({ kind: 'idea', text: 'a'.repeat(250) }, ID);
    expect(String(long['title'])).toHaveLength(200);
    expect(String(long['description'])).toHaveLength(50);
  });

  it.each([
    [() => HttpResponse.json({ data: {} }, { status: 201 }), 'sent'],
    [() => apiError(422, 'VALIDATION_FAILED'), 'failed'],
    [() => apiError(500, 'INTERNAL_ERROR'), 'retry'],
    [() => apiError(401, 'UNAUTHENTICATED'), 'retry'],
    [() => HttpResponse.error(), 'retry'],
  ] as const)('maps the replay response to an outcome (%#)', async (respond, expected) => {
    server.use(http.post('/api/v1/ideas', respond));
    expect((await sendCapture(capture)).status).toBe(expected);
  });

  it('sends online, queues on a network failure and surfaces business errors', async () => {
    server.use(http.post('/api/v1/ideas', () => HttpResponse.json({ data: {} }, { status: 201 })));
    expect(await submitCapture({ kind: 'idea', text: 'En ligne' }, 'user-a')).toBe('sent');

    server.use(http.post('/api/v1/ideas', () => HttpResponse.error()));
    expect(await submitCapture({ kind: 'idea', text: 'Réseau coupé' }, 'user-a')).toBe('queued');
    expect((await captureQueue.pending()).map((item) => item.body['title'])).toEqual(['Réseau coupé']);

    server.use(http.post('/api/v1/ideas', () => apiError(422, 'VALIDATION_FAILED')));
    await expect(submitCapture({ kind: 'idea', text: 'Refusée' }, 'user-a')).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('shows captures refused on replay and lets the user discard them', async () => {
    mockSession();
    server.use(http.post('/api/v1/ideas', () => apiError(422, 'VALIDATION_FAILED')));
    await captureQueue.enqueue({ ...capture, body: { id: ID, title: 'Invalide' } });
    const user = userEvent.setup();
    renderApp('/');

    expect(
      await screen.findByText('Non synchronisée : « Invalide » (VALIDATION_FAILED)'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Abandonner' }));
    expect(await captureQueue.pending()).toEqual([]);
  });
});
