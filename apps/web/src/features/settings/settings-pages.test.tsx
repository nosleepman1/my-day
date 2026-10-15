import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  ACCEPTED,
  apiError,
  CURRENT_SESSION_ID,
  mockSession,
  OTHER_SESSION_ID,
  sessionUser,
} from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';

const SEEN = '2026-10-12T09:30:00.000Z';

function mockSecurityData(): { revoked: string[] } {
  const revoked: string[] = [];
  server.use(
    http.get('/api/v1/me/sessions', () =>
      HttpResponse.json({
        data: [
          {
            id: CURRENT_SESSION_ID,
            current: true,
            createdAt: SEEN,
            lastSeenAt: SEEN,
            ip: '127.0.0.0',
            device: 'Chrome · Windows',
          },
          { id: OTHER_SESSION_ID, current: false, createdAt: SEEN, lastSeenAt: SEEN, ip: null, device: null },
        ].filter((session) => !revoked.includes(session.id)),
      }),
    ),
    http.delete('/api/v1/me/sessions/:id', ({ params }) => {
      revoked.push(String(params['id']));
      return new HttpResponse(null, { status: 204 });
    }),
    http.post('/api/v1/me/sessions/revoke-others', () => {
      revoked.push(OTHER_SESSION_ID);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/v1/me/login-events', ({ request }) => {
      const cursor = new URL(request.url).searchParams.get('cursor');
      const event = (id: string, eventType: string) => ({
        id,
        eventType,
        failureCode: null,
        occurredAt: SEEN,
        ip: '127.0.0.0',
        device: 'Chrome · Windows',
      });
      return cursor === null
        ? HttpResponse.json({
            data: [event(CURRENT_SESSION_ID, 'LOGIN_SUCCEEDED')],
            meta: { limit: 25, nextCursor: 'next-page', hasMore: true },
          })
        : HttpResponse.json({
            data: [event(OTHER_SESSION_ID, 'SOMETHING_NEW')],
            meta: { limit: 25, nextCursor: null, hasMore: false },
          });
    }),
  );
  return { revoked };
}

describe('profile, preferences and modules', () => {
  it('saves the display name', async () => {
    mockSession();
    server.use(
      http.patch('/api/v1/me', async ({ request }) => {
        const body = (await request.json()) as { displayName: string };
        return HttpResponse.json({ data: sessionUser({ displayName: body.displayName }) });
      }),
    );
    const user = userEvent.setup();
    renderApp('/settings');

    const name = await screen.findByLabelText('Nom affiché');
    await user.clear(name);
    await user.type(name, 'Awa Diop');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument();
  });

  it('saves only changed preferences and rejects an unknown time zone', async () => {
    const session = mockSession();
    const user = userEvent.setup();
    renderApp('/settings/preferences');

    const zone = await screen.findByLabelText('Fuseau horaire');
    const save = screen.getByRole('button', { name: 'Enregistrer' });
    expect(save).toBeDisabled();

    fireEvent.change(zone, { target: { value: 'Mars/Olympus' } });
    expect(screen.getByText('Fuseau horaire inconnu.')).toBeInTheDocument();

    fireEvent.change(zone, { target: { value: 'Europe/Paris' } });
    await user.click(save);

    await waitFor(() => {
      expect(session.current().timezone).toBe('Europe/Paris');
    });
  });

  it('toggles a module immediately', async () => {
    const session = mockSession();
    const user = userEvent.setup();
    renderApp('/settings/modules');

    await user.click(await screen.findByRole('switch', { name: 'Finances' }));

    await waitFor(() => {
      expect(session.current().enabledModules).not.toContain('finance');
    });
  });
});

describe('security', () => {
  it('lists sessions, revokes one and the others, and pages the login history', async () => {
    mockSession();
    const data = mockSecurityData();
    const user = userEvent.setup();
    renderApp('/settings/security');

    expect(await screen.findByText('Cet appareil')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Déconnecter la session Appareil inconnu' }));
    await waitFor(() => {
      expect(data.revoked).toEqual([OTHER_SESSION_ID]);
    });
    expect(await screen.findByText('Aucune autre session active.')).toBeInTheDocument();

    expect(screen.getByText('Connexion réussie')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Afficher plus' }));
    expect(await screen.findByText('Événement de sécurité')).toBeInTheDocument();
  });

  it('revokes all other sessions at once', async () => {
    mockSession();
    const data = mockSecurityData();
    const user = userEvent.setup();
    renderApp('/settings/security');

    await user.click(await screen.findByRole('button', { name: 'Déconnecter les autres appareils' }));

    await waitFor(() => {
      expect(data.revoked).toEqual([OTHER_SESSION_ID]);
    });
  });

  it('changes the password and reports a wrong current password', async () => {
    mockSession();
    mockSecurityData();
    let attempts = 0;
    server.use(
      http.post('/api/v1/me/password', () => {
        attempts += 1;
        return attempts === 1 ? apiError(403, 'REAUTH_FAILED') : new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp('/settings/security');

    await user.type(await screen.findByLabelText('Mot de passe actuel'), 'ancien');
    await user.type(screen.getByLabelText('Nouveau mot de passe'), 'nouvelle phrase solide');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'nouvelle phrase solide');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByText('Mot de passe incorrect.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByText(/Vos autres appareils ont été déconnectés/)).toBeInTheDocument();
  });

  it('asks for re-authentication, then replays the e-mail change once', async () => {
    mockSession();
    mockSecurityData();
    let reauthenticated = false;
    let calls = 0;
    server.use(
      http.post('/api/v1/me/email', () => {
        calls += 1;
        return reauthenticated
          ? HttpResponse.json(ACCEPTED, { status: 202 })
          : apiError(403, 'REAUTH_REQUIRED', { maxAgeSeconds: 600 });
      }),
      http.post('/api/v1/auth/reauth', async ({ request }) => {
        const { password } = (await request.json()) as { password: string };
        if (password !== 'bon') return apiError(403, 'REAUTH_FAILED');
        reauthenticated = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp('/settings/security');

    await user.type(await screen.findByLabelText('Nouvelle adresse'), 'nouvelle@example.test');
    await user.click(screen.getByRole('button', { name: "Changer d'adresse" }));

    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Mot de passe'), 'faux');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));
    expect(await within(dialog).findByText('Mot de passe incorrect.')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Mot de passe'));
    await user.type(within(dialog).getByLabelText('Mot de passe'), 'bon');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmer' }));

    expect(await screen.findByText(/Un lien de confirmation a été envoyé/)).toBeInTheDocument();
    expect(calls).toBe(2);
  });

  it('cancels re-authentication without an error message', async () => {
    mockSession();
    mockSecurityData();
    server.use(http.post('/api/v1/me/email', () => apiError(403, 'REAUTH_REQUIRED')));
    const user = userEvent.setup();
    renderApp('/settings/security');

    await user.type(await screen.findByLabelText('Nouvelle adresse'), 'nouvelle@example.test');
    await user.click(screen.getByRole('button', { name: "Changer d'adresse" }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Annuler' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
