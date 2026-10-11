import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { HealthResponseSchema, type HealthResponse } from '@orbit/contracts';

import { http } from '@/lib/http/client';

/** Fabrique de clés de requête du module (FRONTEND.md §4.2). */
export const healthKeys = {
  all: ['health'] as const,
  live: () => [...healthKeys.all, 'live'] as const,
};

export function fetchLiveness(signal: AbortSignal): Promise<HealthResponse> {
  return http('/health/live', HealthResponseSchema, { signal });
}

export function useLiveness(): UseQueryResult<HealthResponse> {
  return useQuery({ queryKey: healthKeys.live(), queryFn: ({ signal }) => fetchLiveness(signal) });
}
