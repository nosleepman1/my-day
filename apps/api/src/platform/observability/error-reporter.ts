import * as Sentry from '@sentry/node';

import type { Env } from '../config/env.schema';

export const ERROR_REPORTER = Symbol('ERROR_REPORTER');

export type ErrorContext = Readonly<{ requestId?: string; code?: string; userId?: string }>;

/** Signalement des erreurs inattendues (5xx, échecs du worker) au suivi d'erreurs (INFRASTRUCTURE.md §12.4). */
export interface ErrorReporter {
  capture(error: unknown, context: ErrorContext): void;
}

/** Local et tests : aucun envoi. */
export const NOOP_ERROR_REPORTER: ErrorReporter = { capture: () => undefined };

/** Événement Sentry réduit aux deux parties que l'on nettoie. */
type ScrubbableEvent = Readonly<{ request?: object | undefined; user?: object | undefined }>;

/**
 * Aucune donnée personnelle ne quitte le serveur : ni cookie, ni en-tête, ni corps, ni chaîne de
 * requête, ni IP ; de l'utilisateur ne reste que l'UUID (INFRASTRUCTURE.md §12.4).
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  // Breadcrumbs (requêtes sortantes, logs), données libres et nom d'hôte : jamais envoyés.
  const {
    request: rawRequest,
    user: rawUser,
    breadcrumbs: _breadcrumbs,
    extra: _extra,
    server_name: _serverName,
    ...rest
  } = event as T & { breadcrumbs?: unknown; extra?: unknown; server_name?: unknown };
  const request = rawRequest as Readonly<Record<string, unknown>> | undefined;
  const user = rawUser as Readonly<Record<string, unknown>> | undefined;
  const scrubbed: Record<string, unknown> = { ...rest };
  if (request !== undefined) {
    scrubbed['request'] = {
      ...(typeof request['method'] === 'string' ? { method: request['method'] } : {}),
      ...(typeof request['url'] === 'string' ? { url: request['url'].split('?')[0] } : {}),
    };
  }
  if (typeof user?.['id'] === 'string') scrubbed['user'] = { id: user['id'] };
  return scrubbed as T;
}

class SentryErrorReporter implements ErrorReporter {
  capture(error: unknown, context: ErrorContext): void {
    Sentry.withScope((scope) => {
      if (context.requestId !== undefined) scope.setTag('requestId', context.requestId);
      if (context.code !== undefined) scope.setTag('errorCode', context.code);
      if (context.userId !== undefined) scope.setUser({ id: context.userId });
      Sentry.captureException(error);
    });
  }
}

/** Sentry SaaS (région UE) si `SENTRY_DSN` est défini : erreurs seulement, aucune trace, aucun PII. */
export function createErrorReporter(env: Env): ErrorReporter {
  if (env.SENTRY_DSN === undefined) return NOOP_ERROR_REPORTER;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT ?? env.APP_ENV,
    release: env.APP_VERSION,
    // Sentry 11 : `dataCollection` remplace `sendDefaultPii` ; rien n'est collecté hors message et pile.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
    },
    tracesSampleRate: 0,
    beforeSend: (event) => scrubEvent(event),
  });
  return new SentryErrorReporter();
}
