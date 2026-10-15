/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker d'ORBIT (FRONTEND.md §10) : seule la coquille de l'application est précachée. Aucune
 * réponse `/api` n'est jamais mise en cache (confidentialité, fraîcheur des soldes) : ces requêtes ne
 * sont pas interceptées et partent toujours au réseau.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation hors ligne : toute page de l'application retombe sur index.html, jamais une route d'API.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Mise à jour sur invite (`registerType: 'prompt'`) : la nouvelle version n'est activée qu'à la demande.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
