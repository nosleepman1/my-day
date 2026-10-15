import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError, ContractError } from '@/lib/http/client';

const MAX_QUERY_RETRIES = 2;

/**
 * Les erreurs 4xx et les réponses hors contrat ne sont jamais relancées ; les lectures en 5xx ou réseau
 * le sont deux fois (FRONTEND.md §3.4, §4.1).
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ContractError) return false;
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export type QueryClientOptions = Readonly<{
  /** Appelé sur tout 401 (session expirée) : vidage du cache et retour à la connexion (FRONTEND.md §3.4). */
  onUnauthorized?: () => void;
}>;

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  const onError = (error: unknown): void => {
    // Seule une session absente ou expirée déconnecte : `INVALID_CREDENTIALS` (401 aussi) est une erreur de saisie.
    if (error instanceof ApiError && error.code === 'UNAUTHENTICATED') options.onUnauthorized?.();
  };
  return new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
