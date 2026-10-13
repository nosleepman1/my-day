/** `__Host-` : Secure, Path=/ et aucun Domain imposés par le navigateur (SECURITY.md §3.2, ADR-006). */
export const SESSION_COOKIE = '__Host-orbit_sid';

const ATTRIBUTES = 'Path=/; Max-Age=%MAX_AGE%; Secure; HttpOnly; SameSite=Lax';
/** Jeton de `generateOpaqueToken` : 32 octets en base64url. Tout autre format est ignoré. */
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{43}$/;

function withAttributes(value: string, maxAgeSeconds: number): string {
  return `${SESSION_COOKIE}=${value}; ${ATTRIBUTES.replace('%MAX_AGE%', String(maxAgeSeconds))}`;
}

/** `Max-Age` = durée absolue restante de la session. */
export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  return withAttributes(token, maxAgeSeconds);
}

export function clearSessionCookie(): string {
  return withAttributes('', 0);
}

/** Jeton de session présent dans l'en-tête `Cookie`, ou `null` s'il est absent ou mal formé. */
export function readSessionToken(cookieHeader: string | undefined): string | null {
  if (cookieHeader === undefined) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) {
      const value = rest.join('=');
      return TOKEN_FORMAT.test(value) ? value : null;
    }
  }
  return null;
}
