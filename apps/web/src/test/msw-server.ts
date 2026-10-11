import { setupServer } from 'msw/node';

/** Serveur MSW partagé : toute requête sans gestionnaire fait échouer le test (TESTING.md §3.1). */
export const server = setupServer();
