import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

import type { Env } from '../config/env.schema';
import type { IdGeneratorPort } from '../ids/id-generator.port';
import { ID_GENERATOR } from '../ids/ids.module';
import { requestIdGenerator } from '../observability/logger.options';

import { translateBodyParserErrors } from './body-parser-errors.middleware';

export const API_PREFIX = 'api/v1';
const JSON_BODY_LIMIT = '1mb';
const HSTS_MAX_AGE_SECONDS = 63_072_000;
const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';

type RequestWithId = Request & { id?: unknown };

/** Attribue l'identifiant de requête avant tout autre middleware : même une erreur de parsing le porte. */
function assignRequestId(ids: IdGeneratorPort) {
  const generate = requestIdGenerator(ids);
  return (request: RequestWithId, response: Response, next: NextFunction): void => {
    // eslint-disable-next-line no-param-reassign -- convention Express : pino-http et le filtre lisent request.id
    request.id = generate(request, response);
    next();
  };
}

/** L'API ne renvoie jamais de contenu cachable ni n'utilise de capteur (SECURITY.md §3.10). */
function apiResponseHeaders(_request: Request, response: Response, next: NextFunction): void {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
  next();
}

/**
 * Durcissement HTTP commun à `main.ts` et aux tests d'intégration (SECURITY.md §3.10, API.md §11-12).
 * Ordre volontaire : identifiant de requête, en-têtes de sécurité, puis parsing du corps, pour que les
 * réponses 400 et 413 de body-parser portent elles aussi `X-Request-Id` et les en-têtes.
 */
export function configureHttp(app: NestExpressApplication, env: Env): void {
  app.setGlobalPrefix(API_PREFIX);
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.use(assignRequestId(app.get<IdGeneratorPort>(ID_GENERATOR)));
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"], sandbox: [] },
      },
      strictTransportSecurity: { maxAge: HSTS_MAX_AGE_SECONDS, includeSubDomains: true },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(apiResponseHeaders);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(translateBodyParserErrors);
  app.enableShutdownHooks();
}
