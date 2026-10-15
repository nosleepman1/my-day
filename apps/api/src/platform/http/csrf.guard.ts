import { type CanActivate, type ExecutionContext, Inject, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import { DomainError } from '../errors/domain-error';

import { defaultMessageOf } from './error-mapping';

/** Jeton d'injection de l'origine publique du front (`APP_ORIGIN`). */
export const CSRF_APP_ORIGIN = Symbol('CSRF_APP_ORIGIN');

const SKIP_CSRF_KEY = 'orbit:skipCsrf';
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);
const REQUIRED_HEADER_VALUE = 'orbit';

/** Route authentifiée autrement que par cookie (webhooks signés, SECURITY.md §12) : pas de contrôle CSRF. */
export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);

type HeaderBag = Readonly<Record<string, string | string[] | undefined>>;
export type CsrfRequest = Readonly<{ method: string; headers: HeaderBag }>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * SECURITY.md §3.9 : une mutation exige `X-Requested-With: orbit` et `Origin` égal à `APP_ORIGIN` ;
 * sans `Origin`, `Sec-Fetch-Site: same-origin` ; sans les deux, refus.
 */
export function isCsrfSafe(request: CsrfRequest, appOrigin: string): boolean {
  if (SAFE_METHODS.has(request.method.toUpperCase())) return true;
  if (single(request.headers['x-requested-with']) !== REQUIRED_HEADER_VALUE) return false;
  const origin = single(request.headers['origin']);
  if (origin !== undefined) return origin === appOrigin;
  return single(request.headers['sec-fetch-site']) === 'same-origin';
}

/** Guard global, exécuté avant le guard de session : une mutation forgée est refusée d'emblée. */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(CSRF_APP_ORIGIN) private readonly appOrigin: string,
    @InjectPinoLogger(CsrfGuard.name) private readonly logger: PinoLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean | undefined>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip === true) return true;
    const request = context.switchToHttp().getRequest<CsrfRequest>();
    if (isCsrfSafe(request, this.appOrigin)) return true;
    this.logger.warn(
      {
        method: request.method,
        origin: single(request.headers['origin']) ?? null,
        secFetchSite: single(request.headers['sec-fetch-site']) ?? null,
      },
      'security.csrf_rejected',
    );
    throw new DomainError('CSRF_REJECTED', defaultMessageOf('CSRF_REJECTED'));
  }
}
