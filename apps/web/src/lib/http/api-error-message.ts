import { z } from 'zod';

import { FieldIssueSchema, type ErrorCode } from '@orbit/contracts';

import { ApiError, ContractError, NetworkError } from './client';

/** Codes affichables : ceux de l'API, plus les cas client sans réponse exploitable. */
export type DisplayErrorCode = ErrorCode | 'UNKNOWN' | 'NETWORK' | 'CONTRACT';

export type FieldIssue = Readonly<{ path: readonly (string | number)[]; message: string }>;

const RetryAfterSchema = z.object({ retryAfterSeconds: z.number().int().nonnegative() });
const FieldIssuesSchema = z.array(FieldIssueSchema);

/** Le front décide sur le code, jamais sur le message de l'API (FRONTEND.md §3.2). */
export function displayCodeOf(error: unknown): DisplayErrorCode {
  if (error instanceof ApiError) return error.code;
  if (error instanceof NetworkError) return 'NETWORK';
  if (error instanceof ContractError) return 'CONTRACT';
  return 'UNKNOWN';
}

/** Délai annoncé par un 429 (`details.retryAfterSeconds`), sinon `null`. */
export function retryAfterOf(error: unknown): number | null {
  if (!(error instanceof ApiError) || error.code !== 'RATE_LIMITED') return null;
  const parsed = RetryAfterSchema.safeParse(error.details);
  return parsed.success ? parsed.data.retryAfterSeconds : null;
}

/** Erreurs de champ d'un `VALIDATION_FAILED` (vide pour tout autre cas). */
export function fieldIssuesOf(error: unknown): readonly FieldIssue[] {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_FAILED') return [];
  const parsed = FieldIssuesSchema.safeParse(error.details);
  return parsed.success ? parsed.data : [];
}

/** Référence support affichée sous une erreur serveur (FRONTEND.md §3.4, 5xx). */
export function requestIdOf(error: unknown): string | undefined {
  return error instanceof ApiError ? error.requestId : undefined;
}
