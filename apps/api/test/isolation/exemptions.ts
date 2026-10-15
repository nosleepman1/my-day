/**
 * Liste blanche des routes publiques (API.md §14.1), limitée aux routes livrées à ce stade.
 * Toute route `@Public()` absente d'ici fait échouer `test:isolation`.
 */
export const PUBLIC_ROUTES: readonly string[] = [
  'GET /api/v1/health/live',
  'GET /api/v1/health/ready',
  'POST /api/v1/auth/email/change/confirm',
  'POST /api/v1/auth/email/verify',
  'POST /api/v1/auth/email/verify/resend',
  'POST /api/v1/auth/login',
  'POST /api/v1/auth/password/forgot',
  'POST /api/v1/auth/password/reset',
  'POST /api/v1/auth/register',
];

/**
 * Routes privées avec paramètre `:id` volontairement non couvertes par un test d'accès croisé.
 * Chaque exemption porte sa justification (TESTING.md §11). Vide en PHASE-01.
 */
export const CROSS_USER_EXEMPTIONS: Readonly<Record<string, string>> = {};
