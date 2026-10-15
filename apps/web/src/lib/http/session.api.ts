import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { z } from 'zod';

import {
  MeResponseSchema,
  PreferencesResponseSchema,
  type MeResponse,
  type PreferencesResponse,
  type UpdatePreferencesRequest,
} from '@orbit/contracts';

import { captureQueue } from '@/lib/offline/capture-queue';
import { sessionKeys } from '@/lib/query-keys';

import { http } from './client';

/**
 * Requêtes de session lues par le shell et les gardes (FRONTEND.md §5). Elles vivent ici, hors des
 * modules, pour que le chunk initial n'embarque pas les pages de paramètres ou d'authentification.
 */
export const sessionApi = {
  me: (signal?: AbortSignal): Promise<MeResponse> =>
    http('/me', MeResponseSchema, signal === undefined ? {} : { signal }),
  preferences: (signal?: AbortSignal): Promise<PreferencesResponse> =>
    http('/me/preferences', PreferencesResponseSchema, signal === undefined ? {} : { signal }),
  updatePreferences: (body: UpdatePreferencesRequest): Promise<PreferencesResponse> =>
    http('/me/preferences', PreferencesResponseSchema, { method: 'PATCH', body }),
  logout: (): Promise<undefined> => http('/auth/logout', z.undefined(), { method: 'POST' }),
};

export function useMe(): UseQueryResult<MeResponse> {
  return useQuery({ queryKey: sessionKeys.me(), queryFn: ({ signal }) => sessionApi.me(signal) });
}

export function usePreferences(enabled = true): UseQueryResult<PreferencesResponse> {
  return useQuery({
    queryKey: sessionKeys.preferences(),
    queryFn: ({ signal }) => sessionApi.preferences(signal),
    enabled,
  });
}

export function useUpdatePreferences(): UseMutationResult<
  PreferencesResponse,
  Error,
  UpdatePreferencesRequest
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: sessionApi.updatePreferences,
    onSuccess: (response) => {
      queryClient.setQueryData(sessionKeys.preferences(), response);
    },
  });
}

/** Déconnexion : le cache est vidé quoi qu'il arrive (aucune donnée d'un compte précédent, PHASE-02 §7). */
export function useLogout(): UseMutationResult<undefined, Error, void> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => sessionApi.logout(),
    onSettled: () => {
      queryClient.clear();
      // Captures hors ligne non synchronisées : effacées pour ne rien laisser au compte suivant.
      void captureQueue.clear();
    },
  });
}
