import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { JSX, ReactNode } from 'react';

type AppProvidersProps = Readonly<{ queryClient: QueryClient; children: ReactNode }>;

/** Fournisseurs globaux. i18n, thème et notifications arrivent en PHASE-02 (FRONTEND.md §2). */
export function AppProviders({ queryClient, children }: AppProvidersProps): JSX.Element {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
