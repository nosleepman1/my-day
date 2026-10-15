/**
 * En-têtes anti-CSRF qu'envoie le front sur toute mutation (SECURITY.md §3.9) ; `Origin` est l'`APP_ORIGIN`
 * de `createTestApp`. Les tests qui vérifient le refus CSRF les omettent volontairement.
 */
export const CSRF_HEADERS = {
  'X-Requested-With': 'orbit',
  Origin: 'http://localhost:5173',
} as const;
