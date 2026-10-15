import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { z } from 'zod';

import {
  AcceptedResponseSchema,
  LoginEventListResponseSchema,
  MeResponseSchema,
  SessionListResponseSchema,
  type AcceptedResponse,
  type ChangeEmailRequest,
  type ChangePasswordRequest,
  type LoginEventListResponse,
  type MeResponse,
  type SessionListResponse,
  type UpdateProfileRequest,
} from '@orbit/contracts';

import { http } from '@/lib/http/client';
import { sessionKeys } from '@/lib/query-keys';

const NoContentSchema = z.undefined();

/** Appels `/me*` (API.md §14.3). */
export const meApi = {
  updateProfile: (body: UpdateProfileRequest): Promise<MeResponse> =>
    http('/me', MeResponseSchema, { method: 'PATCH', body }),
  changeEmail: (body: ChangeEmailRequest): Promise<AcceptedResponse> =>
    http('/me/email', AcceptedResponseSchema, { method: 'POST', body }),
  changePassword: (body: ChangePasswordRequest): Promise<undefined> =>
    http('/me/password', NoContentSchema, { method: 'POST', body }),
  sessions: (signal?: AbortSignal): Promise<SessionListResponse> =>
    http('/me/sessions', SessionListResponseSchema, signal === undefined ? {} : { signal }),
  revokeSession: (id: string): Promise<undefined> =>
    http(`/me/sessions/${encodeURIComponent(id)}`, NoContentSchema, { method: 'DELETE' }),
  revokeOtherSessions: (): Promise<undefined> =>
    http('/me/sessions/revoke-others', NoContentSchema, { method: 'POST' }),
  loginEvents: (cursor: string | null, signal?: AbortSignal): Promise<LoginEventListResponse> =>
    http(
      cursor === null ? '/me/login-events' : `/me/login-events?cursor=${encodeURIComponent(cursor)}`,
      LoginEventListResponseSchema,
      signal === undefined ? {} : { signal },
    ),
};

export { useMe, usePreferences, useUpdatePreferences } from '@/lib/http/session.api';

export function useUpdateProfile(): UseMutationResult<MeResponse, Error, UpdateProfileRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: meApi.updateProfile,
    onSuccess: (response) => {
      queryClient.setQueryData(sessionKeys.me(), response);
    },
  });
}

export function useSessions(): UseQueryResult<SessionListResponse> {
  return useQuery({ queryKey: sessionKeys.sessions(), queryFn: ({ signal }) => meApi.sessions(signal) });
}

export type RevokeTarget = Readonly<{ sessionId: string }> | 'others';

/** Révocation (une session, ou toutes les autres) puis relecture de la liste. */
export function useRevokeSessions(): UseMutationResult<undefined, Error, RevokeTarget> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (target) =>
      target === 'others' ? meApi.revokeOtherSessions() : meApi.revokeSession(target.sessionId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionKeys.sessions() }),
  });
}

export function useLoginEvents(): UseInfiniteQueryResult<InfiniteData<LoginEventListResponse>> {
  return useInfiniteQuery({
    queryKey: sessionKeys.loginEvents(),
    queryFn: ({ pageParam, signal }) => meApi.loginEvents(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : null),
  });
}
