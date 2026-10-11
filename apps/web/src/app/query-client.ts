import { QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/lib/http/client';

const MAX_QUERY_RETRIES = 2;

/** Les erreurs 4xx ne sont jamais relancées ; les lectures en 5xx ou réseau le sont deux fois (FRONTEND.md §3.4, §4.1). */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: shouldRetry },
      mutations: { retry: false },
    },
  });
}
