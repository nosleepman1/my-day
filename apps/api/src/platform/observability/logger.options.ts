import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Params } from 'nestjs-pino';

import type { Env } from '../config/env.schema';
import type { IdGeneratorPort } from '../ids/id-generator.port';

import { REDACT_CENSOR, REDACT_PATHS } from './redaction';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Réutilise un `X-Request-Id` entrant bien formé, sinon en génère un, et le renvoie au client (API.md §12). */
export function requestIdGenerator(ids: IdGeneratorPort) {
  return (request: IncomingMessage & { id?: unknown }, response: ServerResponse): string => {
    // Déjà attribué par le premier middleware (configure-http) : pino-http réutilise le même identifiant.
    if (typeof request.id === 'string') return request.id;
    const incoming = request.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof incoming === 'string' && REQUEST_ID_FORMAT.test(incoming) ? incoming : ids.next();
    response.setHeader('X-Request-Id', requestId);
    return requestId;
  };
}

/** Options pino-http : JSON structuré, `requestId`, masquage central, aucun corps journalisé (CODING_STANDARDS §7). */
export function buildLoggerParams(env: Env, ids: IdGeneratorPort): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: requestIdGenerator(ids),
      redact: { paths: [...REDACT_PATHS], censor: REDACT_CENSOR },
      serializers: {
        req: (request: { id: unknown; method: unknown; url: unknown }) => ({
          id: request.id,
          method: request.method,
          url: request.url,
        }),
        res: (response: { statusCode: unknown }) => ({ statusCode: response.statusCode }),
      },
      ...(env.APP_ENV === 'local'
        ? { transport: { target: 'pino-pretty', options: { singleLine: true } } }
        : {}),
    },
  };
}
