import { createContext, useContext } from 'react';

import type { Preferences, SessionUser } from '@orbit/contracts';

export type Session = Readonly<{ user: SessionUser; preferences: Preferences }>;

export const SessionContext = createContext<Session | null>(null);

/** Utilisateur et préférences de la session ; disponible sous `RequireAuth` uniquement (FRONTEND.md §5). */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) throw new Error('useSession must be used under RequireAuth');
  return session;
}

/** Variante tolérante pour les composants partagés entre zones publique et privée. */
export function useOptionalSession(): Session | null {
  return useContext(SessionContext);
}

/** Routes publiques : un 401 n'y déclenche aucune redirection. */
export const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/confirm-email-change',
  '/status',
] as const;

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

const DELETE_CHAR = 0x7f;
const FIRST_PRINTABLE = 0x20;

/** Caractère de contrôle (tabulation, retour à la ligne…) ou antislash : interprétés par le navigateur. */
function hasUnsafeChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < FIRST_PRINTABLE || code === DELETE_CHAR || value.charAt(index) === '\\') return true;
  }
  return false;
}

/**
 * `next` n'accepte qu'un chemin relatif de l'application (anti open-redirect, FRONTEND.md §3.4) :
 * pas de `//hôte`, pas de `/\hôte`, pas de caractère de contrôle (le navigateur retire tabulations
 * et retours à la ligne : `/\t/evil` deviendrait `//evil`), et la résolution doit rester sur l'origine.
 */
export function safeNextPath(next: string | null): string {
  if (next === null || !next.startsWith('/') || next.startsWith('//')) return '/';
  if (hasUnsafeChar(next) || hasUnsafeChar(safeDecode(next))) return '/';
  const resolved = new URL(next, 'https://orbit.invalid');
  return resolved.origin === 'https://orbit.invalid' && !resolved.pathname.startsWith('//') ? next : '/';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return '\\';
  }
}

export function loginPathFor(currentPath: string): string {
  return currentPath === '/' ? '/login' : `/login?next=${encodeURIComponent(currentPath)}`;
}
