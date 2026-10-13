import type { Env } from '../../platform/config/env.schema';

import type { RegistrationMode } from './domain/registration';

/** Jeton d'injection des réglages du module auth, dérivés de la configuration validée. */
export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');

const DAY_MS = 86_400_000;

export type AuthSettings = Readonly<{
  /** Origine du front, pour les liens des e-mails (ADR-038). */
  appOrigin: string;
  registrationMode: RegistrationMode;
  registrationAllowlist: ReadonlySet<string>;
  /** Durée plancher des réponses uniformes (SECURITY.md §3.8) ; 0 dans les tests. */
  uniformResponseMs: number;
  /** SECURITY.md §3.2 : 7 jours d'inactivité, 30 jours au total. */
  sessionIdleMs: number;
  sessionAbsoluteMs: number;
}>;

export function authSettingsFrom(env: Env): AuthSettings {
  return {
    appOrigin: env.APP_ORIGIN,
    registrationMode: env.REGISTRATION_MODE,
    registrationAllowlist: new Set(env.REGISTRATION_ALLOWLIST),
    uniformResponseMs: env.AUTH_UNIFORM_RESPONSE_MS,
    sessionIdleMs: env.SESSION_IDLE_DAYS * DAY_MS,
    sessionAbsoluteMs: env.SESSION_ABSOLUTE_DAYS * DAY_MS,
  };
}
