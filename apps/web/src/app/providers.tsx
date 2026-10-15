import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import type { JSX, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import { EnvironmentBanner } from '@/components/environment-banner';
import { Toaster } from '@/components/ui/toaster';

import { ThemeProvider } from './theme';

type AppProvidersProps = Readonly<{ queryClient: QueryClient; i18n: i18n; children: ReactNode }>;

/** Fournisseurs globaux : requêtes, traductions, thème, notifications (FRONTEND.md §2). */
export function AppProviders({ queryClient, i18n, children }: AppProvidersProps): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider>
          <EnvironmentBanner appEnv={import.meta.env.VITE_APP_ENV} />
          {children}
          <Toaster />
        </ThemeProvider>
      </I18nextProvider>
    </QueryClientProvider>
  );
}
