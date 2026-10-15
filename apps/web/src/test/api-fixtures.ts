import { http, HttpResponse, type JsonBodyType } from 'msw';

import type { Preferences, SessionUser } from '@orbit/contracts';

import { server } from './msw-server';

/** Données synthétiques de session (aucune donnée réelle). */
export const USER_ID = '0192f3a4-5b6c-7d8e-9f01-23456789abcd';
export const OTHER_SESSION_ID = '0192f3a4-5b6c-7d8e-9f01-23456789abce';
export const CURRENT_SESSION_ID = '0192f3a4-5b6c-7d8e-9f01-23456789abcf';
const INSTANT = '2026-10-01T10:00:00.000Z';

export function sessionUser(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: USER_ID,
    email: 'awa@example.test',
    displayName: 'Awa',
    role: 'USER',
    emailVerifiedAt: INSTANT,
    mfaEnabled: false,
    ...overrides,
  };
}

export function preferences(overrides: Partial<Preferences> = {}): Preferences {
  return {
    locale: 'fr',
    timezone: 'Africa/Dakar',
    defaultCurrency: 'XOF',
    dateFormat: 'dd/MM/yyyy',
    weekStartsOn: 1,
    theme: 'SYSTEM',
    enabledModules: ['ideas', 'tasks', 'notes', 'finance'],
    onboardingCompletedAt: INSTANT,
    ...overrides,
  };
}

export function apiError(status: number, code: string, details?: unknown): HttpResponse<JsonBodyType> {
  return HttpResponse.json(
    { error: { code, message: code, requestId: 'req-test', ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

export const ACCEPTED = { data: { status: 'accepted' } } as const;

/** Session connectée : `/me` et `/me/preferences` (lecture et mise à jour, état conservé). */
export function mockSession(
  user: SessionUser = sessionUser(),
  initial: Preferences = preferences(),
): { current: () => Preferences } {
  let state = initial;
  server.use(
    http.get('/api/v1/me', () => HttpResponse.json({ data: user })),
    http.get('/api/v1/me/preferences', () => HttpResponse.json({ data: state })),
    http.patch('/api/v1/me/preferences', async ({ request }) => {
      const { onboardingCompleted, ...patch } = (await request.json()) as Partial<Preferences> & {
        onboardingCompleted?: true;
      };
      state = {
        ...state,
        ...patch,
        ...(onboardingCompleted === true ? { onboardingCompletedAt: INSTANT } : {}),
      };
      return HttpResponse.json({ data: state });
    }),
  );
  return { current: () => state };
}

export function mockAnonymous(): void {
  server.use(http.get('/api/v1/me', () => apiError(401, 'UNAUTHENTICATED')));
}
