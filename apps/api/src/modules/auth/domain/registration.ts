export type RegistrationMode = 'closed' | 'allowlist' | 'open';

const MAX_DISPLAY_NAME_LENGTH = 80;

/** SECURITY.md §3.4 : trim, NFC, minuscules (partie locale et domaine). Clé unique de `users.email`. */
export { normalizeEmail } from '@orbit/contracts';

/** ADR-026 : `closed` refuse tout, `allowlist` n'accepte que les adresses listées, `open` accepte tout. */
export function isRegistrationAllowed(
  mode: RegistrationMode,
  allowlist: ReadonlySet<string>,
  normalizedEmail: string,
): boolean {
  if (mode === 'open') return true;
  if (mode === 'allowlist') return allowlist.has(normalizedEmail);
  return false;
}

/** Nom affiché par défaut : la partie locale de l'adresse, modifiable ensuite (`PATCH /me`). */
export function defaultDisplayName(normalizedEmail: string): string {
  const localPart = normalizedEmail.split('@')[0] ?? normalizedEmail;
  return localPart.slice(0, MAX_DISPLAY_NAME_LENGTH);
}
