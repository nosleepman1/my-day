import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { createI18n } from '@/lib/i18n';

import { server } from './msw-server';

// Instance i18n `fr` globale pour les composants rendus sans fournisseur.
createI18n();

// Les pages sont chargées à la demande (React.lazy) : sous couverture et en CI parallèle, le premier
// import d'un chunk instrumenté prend plusieurs secondes.
configure({ asyncUtilTimeout: 8_000 });

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => {
  server.close();
});
