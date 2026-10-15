/**
 * Forme canonique d'une adresse e-mail (SECURITY.md §3.4) : trim, NFC, minuscules (partie locale et domaine).
 * Clé unique de `users.email`, de la liste d'autorisation et des compteurs anti-abus.
 */
export function normalizeEmail(email: string): string {
  return email.trim().normalize('NFC').toLowerCase();
}
