import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

import type { Env } from '../config/env.schema';

import { translateBodyParserErrors } from './body-parser-errors.middleware';

export const API_PREFIX = 'api/v1';
const JSON_BODY_LIMIT = '1mb';

/**
 * Durcissement HTTP commun à `main.ts` et aux tests d'intégration (SECURITY.md, API.md §11-12).
 * L'API ne sert que du JSON : CSP minimale, aucune ressource chargeable, aucun cadre.
 */
export function configureHttp(app: NestExpressApplication, env: Env): void {
  app.setGlobalPrefix(API_PREFIX);
  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(translateBodyParserErrors);
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-origin' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.enableShutdownHooks();
}
