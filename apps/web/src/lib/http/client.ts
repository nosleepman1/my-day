import type { z } from 'zod';

import { ErrorResponseSchema, type ErrorCode } from '@orbit/contracts';

/** Même origine (ADR-006, ADR-038) : jamais d'URL absolue d'API dans le code. */
export const API_BASE = '/api/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

/** Erreur renvoyée par l'API. Le front décide sur `code`, jamais sur le message (FRONTEND.md §3.2). */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'UNKNOWN',
    readonly details: unknown,
    readonly requestId: string | undefined,
  ) {
    super(code);
  }
}

/** Réseau coupé, DNS, délai dépassé : la requête n'a pas reçu de réponse. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = Readonly<{
  method?: HttpMethod;
  body?: unknown;
  /** UUIDv7 client, obligatoire sur les créations financières et le rejeu hors ligne (FRONTEND.md §3.1). */
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
}>;

function buildHeaders(options: RequestOptions): Headers {
  const headers = new Headers({ Accept: 'application/json', 'X-Requested-With': 'orbit' });
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.idempotencyKey !== undefined) headers.set('Idempotency-Key', options.idempotencyKey);
  return headers;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers: buildHeaders(options),
    credentials: 'include',
    signal: options.signal === undefined ? timeout : AbortSignal.any([options.signal, timeout]),
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  };
  try {
    return await fetch(new URL(`${API_BASE}${path}`, globalThis.location.origin), init);
  } catch (error: unknown) {
    throw new NetworkError('Network request failed', { cause: error });
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const parsed = ErrorResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    return new ApiError(
      response.status,
      'UNKNOWN',
      undefined,
      response.headers.get('X-Request-Id') ?? undefined,
    );
  }
  const { code, details, requestId } = parsed.data.error;
  return new ApiError(response.status, code, details, requestId);
}

/**
 * Seul point d'appel HTTP du front (FRONTEND.md §2.1, §3) : cookie de session HttpOnly envoyé par le
 * navigateur, en-tête anti-CSRF, réponse validée par le schéma de `@orbit/contracts`.
 * @throws {ApiError} si l'API répond en erreur ; {NetworkError} si aucune réponse n'arrive.
 */
export async function http<T>(path: string, schema: z.ZodType<T>, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (!response.ok) throw await toApiError(response);
  return schema.parse(response.status === 204 ? undefined : await readJson(response));
}
