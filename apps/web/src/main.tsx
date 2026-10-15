import './styles/globals.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';

import { AppProviders } from './app/providers';
import { createQueryClient } from './app/query-client';
import { createAppRouter, handleUnauthorized, type AppRouter } from './app/router';
import { createI18n } from './lib/i18n';
import { initErrorReporting } from './lib/observability/sentry';
import { registerServiceWorker } from './lib/pwa/register-sw';

const container = document.getElementById('root');
if (container === null) throw new Error('Missing #root element in index.html');

let router: AppRouter | null = null;
const queryClient = createQueryClient({
  onUnauthorized: () => {
    if (router !== null) handleUnauthorized(router, queryClient);
  },
});
router = createAppRouter();
const i18n = createI18n();
registerServiceWorker(i18n);
void initErrorReporting();

createRoot(container).render(
  <StrictMode>
    <AppProviders queryClient={queryClient} i18n={i18n}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
