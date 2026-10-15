import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';

import { AppProviders } from '@/app/providers';
import { createQueryClient } from '@/app/query-client';
import { handleUnauthorized } from '@/app/router';
import { createI18n } from '@/lib/i18n';
import { appRoutes } from '@/routes/app.routes';
import { publicRoutes } from '@/routes/public.routes';

const i18n = createI18n();

type AppHarness = Readonly<{ router: ReturnType<typeof createMemoryRouter>; queryClient: QueryClient }>;

/** Application complète (fournisseurs, routes, 401 global) dans un routeur mémoire, à partir de `path`. */
export function renderApp(path: string): AppHarness {
  let harness: AppHarness | null = null;
  const queryClient = createQueryClient({
    onUnauthorized: () => {
      if (harness !== null) handleUnauthorized(harness.router, harness.queryClient);
    },
  });
  queryClient.setDefaultOptions({
    queries: { retry: false, staleTime: 30_000 },
    mutations: { retry: false },
  });
  const router = createMemoryRouter([...publicRoutes, ...appRoutes], { initialEntries: [path] });
  harness = { router, queryClient };
  render(
    <AppProviders queryClient={queryClient} i18n={i18n}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return harness;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}

type Options = Readonly<{ queryClient?: QueryClient }>;

function Providers({
  children,
  queryClient,
}: Readonly<{ children: ReactNode; queryClient: QueryClient }>): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </QueryClientProvider>
  );
}

/** Rendu avec i18n `fr` et un client TanStack Query sans relance. */
export function renderWithProviders(ui: ReactElement, options: Options = {}): RenderResult {
  const queryClient = options.queryClient ?? createTestQueryClient();
  return render(<Providers queryClient={queryClient}>{ui}</Providers>);
}

/** Rendu d'un ensemble de routes dans un routeur mémoire, à partir de `path`. */
export function renderRoutes(
  routes: RouteObject[],
  path: string,
  options: Options = {},
): RenderResult & { router: ReturnType<typeof createMemoryRouter> } {
  const queryClient = options.queryClient ?? createTestQueryClient();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>,
  );
  return { ...result, router };
}

export { i18n as testI18n };
