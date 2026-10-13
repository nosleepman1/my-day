/** Routes du front (PHASE-02) qui reçoivent un jeton : le front le lit dans le fragment puis le poste à l'API. */
export type TokenRoute = '/verify-email' | '/reset-password' | '/confirm-email-change';

/**
 * Lien `${APP_ORIGIN}${route}#token=<jeton>` (SECURITY.md §3.4) : le fragment n'est jamais envoyé au
 * serveur, donc le jeton n'apparaît ni dans les journaux d'accès ni dans l'en-tête `Referer`.
 */
export function buildTokenLink(appOrigin: string, route: TokenRoute, token: string): string {
  return `${appOrigin}${route}#token=${encodeURIComponent(token)}`;
}
