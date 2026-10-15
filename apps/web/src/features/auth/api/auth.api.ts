import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { z } from 'zod';

import {
  AcceptedResponseSchema,
  EmailVerifiedResponseSchema,
  LoginResponseSchema,
  type AcceptedResponse,
  type ConfirmEmailChangeRequest,
  type EmailVerifiedResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type LoginResponse,
  type ReauthRequest,
  type RegisterRequest,
  type ResendVerificationRequest,
  type ResetPasswordRequest,
  type VerifyEmailRequest,
} from '@orbit/contracts';

import { http } from '@/lib/http/client';
import { sessionKeys } from '@/lib/query-keys';

/** Réponse 204 : aucun corps. */
const NoContentSchema = z.undefined();

const post = <T>(path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> =>
  http(path, schema, { method: 'POST', ...(body === undefined ? {} : { body }) });

/** Appels `/auth/*` (API.md §14.2) ; les messages affichés restent génériques (PHASE-02 §7). */
export const authApi = {
  login: (body: LoginRequest): Promise<LoginResponse> => post('/auth/login', LoginResponseSchema, body),
  logout: (): Promise<undefined> => post('/auth/logout', NoContentSchema),
  register: (body: RegisterRequest): Promise<AcceptedResponse> =>
    post('/auth/register', AcceptedResponseSchema, body),
  resendVerification: (body: ResendVerificationRequest): Promise<AcceptedResponse> =>
    post('/auth/email/verify/resend', AcceptedResponseSchema, body),
  verifyEmail: (body: VerifyEmailRequest): Promise<EmailVerifiedResponse> =>
    post('/auth/email/verify', EmailVerifiedResponseSchema, body),
  forgotPassword: (body: ForgotPasswordRequest): Promise<AcceptedResponse> =>
    post('/auth/password/forgot', AcceptedResponseSchema, body),
  resetPassword: (body: ResetPasswordRequest): Promise<undefined> =>
    post('/auth/password/reset', NoContentSchema, body),
  reauth: (body: ReauthRequest): Promise<undefined> => post('/auth/reauth', NoContentSchema, body),
  confirmEmailChange: (body: ConfirmEmailChangeRequest): Promise<undefined> =>
    post('/auth/email/change/confirm', NoContentSchema, body),
};

/** Connexion : le profil renvoyé amorce le cache ; les préférences sont relues. */
export function useLogin(): UseMutationResult<LoginResponse, Error, LoginRequest> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: async (response) => {
      // Aucune donnée d'un compte précédent (déconnexion depuis un autre onglet, PHASE-02 §7).
      queryClient.clear();
      queryClient.setQueryData(sessionKeys.me(), { data: response.data.user });
      await queryClient.invalidateQueries({ queryKey: sessionKeys.preferences() });
    },
  });
}

export function useAuthMutation<TBody, TResult>(
  mutationFn: (body: TBody) => Promise<TResult>,
): UseMutationResult<TResult, Error, TBody> {
  return useMutation({ mutationFn });
}
