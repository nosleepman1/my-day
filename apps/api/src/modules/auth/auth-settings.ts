import type { Env } from '../../platform/config/env.schema';

import type { RegistrationMode } from './domain/registration';

/** Jeton d'injection des réglages du module auth, dérivés de la configuration validée. */
export const AUTH_SETTINGS = Symbol('AUTH_SETTINGS');

export type AuthSettings = Readonly<{
  /** Origine du front, pour les liens des e-mails (ADR-038). */
  appOrigin: string;
  registrationMode: RegistrationMode;
  registrationAllowlist: ReadonlySet<string>;
  /** Durée plancher des réponses uniformes (SECURITY.md §3.8) ; 0 dans les tests. */
  uniformResponseMs: number;
}>;

export function authSettingsFrom(env: Env): AuthSettings {
  return {
    appOrigin: env.APP_ORIGIN,
    registrationMode: env.REGISTRATION_MODE,
    registrationAllowlist: new Set(env.REGISTRATION_ALLOWLIST),
    uniformResponseMs: env.AUTH_UNIFORM_RESPONSE_MS,
  };
}
