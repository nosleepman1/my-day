/** Événement réduit aux parties nettoyées avant envoi. */
type ScrubbableEvent = Readonly<{ request?: object | undefined; user?: object | undefined }>;

/**
 * Aucune donnée personnelle n'est envoyée : ni requête (URL avec paramètres, en-têtes, cookies), ni
 * utilisateur hors UUID (INFRASTRUCTURE.md §12.4).
 */
export function scrubWebEvent<T extends ScrubbableEvent>(event: T): T {
  // Les breadcrumbs portent les URL visitées (fragments de jetons compris) et les appels réseau.
  const {
    request: _request,
    user: rawUser,
    breadcrumbs: _breadcrumbs,
    extra: _extra,
    ...rest
  } = event as T & { breadcrumbs?: unknown; extra?: unknown };
  const user = rawUser as Readonly<Record<string, unknown>> | undefined;
  return {
    ...rest,
    ...(typeof user?.['id'] === 'string' ? { user: { id: user['id'] } } : {}),
  } as unknown as T;
}

/**
 * Suivi d'erreurs du front (Sentry SaaS, région UE) : le SDK n'est chargé que si `VITE_SENTRY_DSN`
 * est défini (staging, production), dans son propre chunk ; erreurs seulement, sans replay ni trace.
 */
type PublicEnv = Pick<ImportMetaEnv, 'VITE_SENTRY_DSN' | 'VITE_APP_ENV' | 'VITE_APP_VERSION'>;

export async function initErrorReporting(env: PublicEnv = import.meta.env): Promise<boolean> {
  const dsn = env.VITE_SENTRY_DSN;
  if (dsn === undefined || dsn === '') return false;
  const Sentry = await import('@sentry/react');
  Sentry.init({
    dsn,
    environment: env.VITE_APP_ENV ?? 'production',
    release: env.VITE_APP_VERSION ?? 'dev',
    tracesSampleRate: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    beforeSend: (event) => scrubWebEvent(event),
  });
  return true;
}
