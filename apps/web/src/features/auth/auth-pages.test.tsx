import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ACCEPTED, apiError, mockAnonymous, sessionUser } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';

const TOKEN = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG';

function withFragmentToken(path: string): string {
  window.history.replaceState(null, '', `${path}#token=${TOKEN}`);
  return path;
}

beforeEach(() => {
  mockAnonymous();
});

afterEach(() => {
  window.history.replaceState(null, '', '/');
});

describe('login page', () => {
  it('signs in and goes to next', async () => {
    let signedIn = false;
    server.use(
      http.post('/api/v1/auth/login', () => {
        signedIn = true;
        return HttpResponse.json({ data: { user: sessionUser(), mfaRequired: false } });
      }),
      http.get('/api/v1/me', () =>
        signedIn ? HttpResponse.json({ data: sessionUser() }) : apiError(401, 'UNAUTHENTICATED'),
      ),
      http.get('/api/v1/me/preferences', () => apiError(500, 'INTERNAL_ERROR')),
    );
    const user = userEvent.setup();
    const { router } = renderApp('/login?next=%2Fsettings%2Fprofile');

    await user.type(await screen.findByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'phrase de passe solide');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings/profile');
    });
  });

  it('shows the generic message on bad credentials and validates fields', async () => {
    server.use(http.post('/api/v1/auth/login', () => apiError(401, 'INVALID_CREDENTIALS')));
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Se connecter' }));
    expect(screen.getByLabelText('Adresse e-mail')).toHaveAttribute('aria-invalid', 'true');

    await user.type(screen.getByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'faux');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Adresse e-mail ou mot de passe incorrect.')).toBeInTheDocument();
  });

  it('shows the 429 delay', async () => {
    server.use(
      http.post('/api/v1/auth/login', () => apiError(429, 'RATE_LIMITED', { retryAfterSeconds: 90 })),
    );
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'x');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Trop de tentatives. Réessayez dans 90 s.')).toBeInTheDocument();
  });

  it('offers to resend the verification e-mail for an unverified account', async () => {
    server.use(
      http.post('/api/v1/auth/login', () => apiError(403, 'EMAIL_NOT_VERIFIED')),
      http.post('/api/v1/auth/email/verify/resend', () => HttpResponse.json(ACCEPTED, { status: 202 })),
    );
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'x');
    await user.click(screen.getByRole('button', { name: 'Se connecter' }));
    await user.click(await screen.findByRole('button', { name: "Renvoyer l'e-mail de confirmation" }));

    expect(await screen.findByText(/un nouvel e-mail vient d'être envoyé/)).toBeInTheDocument();
  });
});

describe('register and forgot password', () => {
  it('confirms registration generically and omits an empty name', async () => {
    let body: unknown = null;
    server.use(
      http.post('/api/v1/auth/register', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(ACCEPTED, { status: 202 });
      }),
    );
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'phrase de passe solide');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText(/Si cette inscription est possible/)).toBeInTheDocument();
    expect(body).toEqual({ email: 'awa@example.test', password: 'phrase de passe solide' });
  });

  it('maps a weak password onto its field', async () => {
    server.use(
      http.post('/api/v1/auth/register', () =>
        apiError(400, 'VALIDATION_FAILED', [
          { path: ['password'], code: 'too_short', message: 'Trop court.' },
        ]),
      ),
    );
    const user = userEvent.setup();
    renderApp('/register');

    await user.type(await screen.findByLabelText('Votre prénom (facultatif)'), 'Awa');
    await user.type(screen.getByLabelText('Adresse e-mail'), 'awa@example.test');
    await user.type(screen.getByLabelText('Mot de passe'), 'court');
    await user.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('Trop court.')).toBeInTheDocument();
  });

  it('answers the same way whether or not the account exists', async () => {
    server.use(http.post('/api/v1/auth/password/forgot', () => HttpResponse.json(ACCEPTED, { status: 202 })));
    const user = userEvent.setup();
    renderApp('/forgot-password');

    await user.type(await screen.findByLabelText('Adresse e-mail'), 'inconnu@example.test');
    await user.click(screen.getByRole('button', { name: 'Envoyer le lien' }));

    expect(await screen.findByText(/Si un compte existe pour cette adresse/)).toBeInTheDocument();
  });
});

describe('links with a token', () => {
  it('verifies the e-mail from the fragment token and removes it from the URL', async () => {
    let received: unknown = null;
    server.use(
      http.post('/api/v1/auth/email/verify', async ({ request }) => {
        received = await request.json();
        return HttpResponse.json({ data: { status: 'verified' } });
      }),
    );
    renderApp(withFragmentToken('/verify-email'));

    expect(await screen.findByText('Adresse confirmée. Vous pouvez vous connecter.')).toBeInTheDocument();
    expect(received).toEqual({ token: TOKEN });
    expect(window.location.hash).toBe('');
  });

  it('offers a resend form when the link is invalid or missing', async () => {
    server.use(http.post('/api/v1/auth/email/verify', () => apiError(410, 'GONE')));
    renderApp(withFragmentToken('/verify-email'));

    expect(await screen.findByText(/Ce lien est invalide ou a expiré/)).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse e-mail')).toBeInTheDocument();
  });

  it('resets the password, then returns to login with a notice', async () => {
    server.use(http.post('/api/v1/auth/password/reset', () => new HttpResponse(null, { status: 204 })));
    const user = userEvent.setup();
    const { router } = renderApp(withFragmentToken('/reset-password'));

    await user.type(await screen.findByLabelText('Nouveau mot de passe'), 'nouvelle phrase solide');
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'autre chose');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));
    expect(await screen.findByText('Les deux mots de passe ne correspondent pas.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Confirmer le mot de passe'));
    await user.type(screen.getByLabelText('Confirmer le mot de passe'), 'nouvelle phrase solide');
    await user.click(screen.getByRole('button', { name: 'Changer le mot de passe' }));

    expect(
      await screen.findByText('Mot de passe modifié. Connectez-vous avec le nouveau.'),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows an invalid reset link without a token', async () => {
    renderApp('/reset-password');

    expect(
      await screen.findByText('Ce lien est invalide ou a expiré. Demandez-en un nouveau.'),
    ).toBeInTheDocument();
  });

  it('confirms an e-mail change', async () => {
    server.use(http.post('/api/v1/auth/email/change/confirm', () => new HttpResponse(null, { status: 204 })));
    renderApp(withFragmentToken('/confirm-email-change'));

    expect(await screen.findByText('Votre nouvelle adresse est confirmée.')).toBeInTheDocument();
  });

  it('reports an invalid e-mail change link', async () => {
    renderApp('/confirm-email-change');

    expect(await screen.findByText('Ce lien est invalide ou a expiré.')).toBeInTheDocument();
  });
});
