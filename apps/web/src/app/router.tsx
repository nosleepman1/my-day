import type { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router';

import { appRoutes } from '@/routes/app.routes';
import { publicRoutes } from '@/routes/public.routes';

import { isPublicPath, loginPathFor } from './session/session';

export type AppRouter = ReturnType<typeof createBrowserRouter>;

/** Routeur de données (FRONTEND.md §9) : routes publiques puis routes authentifiées. */
export function createAppRouter(): AppRouter {
  return createBrowserRouter([...publicRoutes, ...appRoutes]);
}

/**
 * Réaction globale au 401 hors pages publiques : cache vidé (aucune donnée d'un compte précédent),
 * retour à la connexion avec `next` et le message « session expirée ».
 */
export function handleUnauthorized(router: AppRouter, queryClient: QueryClient): void {
  const { pathname, search } = router.state.location;
  // Plusieurs 401 simultanés : une seule redirection.
  if (isPublicPath(pathname) || router.state.navigation.location?.pathname === '/login') return;
  queryClient.clear();
  void router.navigate(loginPathFor(`${pathname}${search}`), { replace: true, state: { notice: 'expired' } });
}
