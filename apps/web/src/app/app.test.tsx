import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiError, mockAnonymous, mockSession, preferences, sessionUser } from '@/test/api-fixtures';
import { server } from '@/test/msw-server';
import { renderApp } from '@/test/render';

import { isPublicPath, loginPathFor, safeNextPath } from './session/session';

function useDesktop(matches: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: matches && query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('session helpers', () => {
  it('only accepts relative next paths (anti open-redirect)', () => {
    expect(safeNextPath('/settings/profile')).toBe('/settings/profile');
    expect(safeNextPath('//evil.example')).toBe('/');
    expect(safeNextPath('/\\evil.example')).toBe('/');
    expect(safeNextPath('https://evil.example')).toBe('/');
    expect(safeNextPath('/\t/evil.example')).toBe('/');
    expect(safeNextPath('/\n/evil.example')).toBe('/');
    expect(safeNextPath('/%5Cevil.example')).toBe('/');
    expect(safeNextPath('/%E0%A4%A')).toBe('/');
    expect(safeNextPath(null)).toBe('/');
  });

  it('builds the login path and recognizes public routes', () => {
    expect(loginPathFor('/')).toBe('/login');
    expect(loginPathFor('/settings?x=1')).toBe('/login?next=%2Fsettings%3Fx%3D1');
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/settings')).toBe(false);
  });
});

describe('guards', () => {
  it('redirects an anonymous visitor to /login with next', async () => {
    mockAnonymous();
    const { router } = renderApp('/settings/profile');

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?next=%2Fsettings%2Fprofile');
  });

  it('sends a signed-in user away from the login page', async () => {
    mockSession();
    const { router } = renderApp('/login?next=%2Fmore');

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/more');
    });
  });

  it('shows an error state with retry when /me fails', async () => {
    server.use(http.get('/api/v1/me', () => apiError(500, 'INTERNAL_ERROR')));
    renderApp('/');

    expect(await screen.findByText('Référence : req-test')).toBeInTheDocument();
  });

  it('runs onboarding first, then lands on the home page', async () => {
    const session = mockSession(sessionUser(), preferences({ onboardingCompletedAt: null }));
    const user = userEvent.setup();
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Bienvenue dans ORBIT' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    expect(screen.getByLabelText('Fuseau horaire')).toHaveValue('Africa/Dakar');
    await user.click(screen.getByRole('button', { name: 'Suivant' }));
    await user.click(screen.getByRole('switch', { name: 'Pro (clients, factures)' }));
    await user.click(screen.getByRole('button', { name: 'Commencer' }));

    expect(await screen.findByRole('heading', { name: 'Bonjour Awa' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(session.current().enabledModules).toContain('pro');
  });
});

describe('shell and navigation', () => {
  it('shows the mobile bottom navigation with labels and the More menu', async () => {
    useDesktop(false);
    mockSession();
    const user = userEvent.setup();
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Navigation rapide' });
    expect(within(nav).getByRole('link', { name: 'Finances' })).toBeInTheDocument();
    await user.click(within(nav).getByRole('link', { name: 'Plus' }));

    expect(await screen.findByRole('heading', { name: 'Plus' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: 'Idées' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('replaces disabled modules in the bottom bar and hides them', async () => {
    mockSession(sessionUser(), preferences({ enabledModules: ['ideas', 'notes'] }));
    renderApp('/');

    const nav = await screen.findByRole('navigation', { name: 'Navigation rapide' });
    expect(within(nav).getByRole('link', { name: 'Idées' })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Notes et documents' })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: 'Finances' })).not.toBeInTheDocument();
  });

  it('shows the ADMIN zone only to an ADMIN', async () => {
    useDesktop(false);
    mockSession(sessionUser({ role: 'ADMIN' }));
    renderApp('/more');

    expect(await screen.findByRole('heading', { name: 'Plus' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).getByText('ADMIN')).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Admin' })).toBeInTheDocument();
  });

  it('answers « not found » to a USER on /admin', async () => {
    mockSession();
    renderApp('/admin');

    expect(await screen.findByText('Page introuvable')).toBeInTheDocument();
  });

  it('shows « coming soon » for an enabled module and « disabled » otherwise', async () => {
    mockSession();
    const { router } = renderApp('/finance');

    expect(await screen.findByText('Bientôt disponible')).toBeInTheDocument();
    await router.navigate('/pro');
    expect(await screen.findByText('Ce module est désactivé')).toBeInTheDocument();
    await router.navigate('/nowhere');
    expect(await screen.findByText('Page introuvable')).toBeInTheDocument();
  });

  it('renders the desktop sidebar and opens quick capture with N', async () => {
    useDesktop(true);
    mockSession();
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByText('Organisation')).toBeInTheDocument();
    await user.keyboard('n');

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Capture rapide')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('radio', { name: 'Dépense' }));
    expect(within(dialog).getByRole('status')).toHaveTextContent('phase 05');
  });

  it('opens quick capture from the + button on mobile', async () => {
    mockSession();
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Capture rapide' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Capturer' })).toBeInTheDocument();
  });

  it('logs out from the user menu and clears the cache', async () => {
    mockSession();
    server.use(
      http.post('/api/v1/auth/logout', () => {
        mockAnonymous();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { router, queryClient } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Menu du compte' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Se déconnecter' }));

    expect(await screen.findByRole('heading', { name: 'Connexion' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(queryClient.getQueryData(['me', 'preferences'])).toBeUndefined();
  });

  it('changes the theme from the user menu and saves it', async () => {
    const session = mockSession();
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Menu du compte' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Sombre' }));

    await waitFor(() => {
      expect(session.current().theme).toBe('DARK');
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('returns to login with an « expired » notice on a 401 during navigation', async () => {
    mockSession();
    const { router } = renderApp('/');
    await screen.findByRole('heading', { name: 'Bonjour Awa' });
    mockAnonymous();
    server.use(
      http.get('/api/v1/me/sessions', () => apiError(401, 'UNAUTHENTICATED')),
      http.get('/api/v1/me/login-events', () => apiError(401, 'UNAUTHENTICATED')),
    );

    await router.navigate('/settings/security');

    // Deux requêtes en 401 redirigent chacune : la page de connexion peut être remontée une fois.
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
      expect(screen.getByText('Votre session a expiré. Reconnectez-vous.')).toBeInTheDocument();
    });
  });
});
