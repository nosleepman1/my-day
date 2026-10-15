import { Catch, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { ErrorResponse } from '@orbit/contracts';

import { ERROR_REPORTER, type ErrorReporter } from '../observability/error-reporter';

import { toApiError } from './error-mapping';

type RequestWithId = Request & { id?: unknown };

/** `details.retryAfterSeconds` d'une erreur 429 devient l'en-tête `Retry-After` (API.md §5.2). */
function retryAfterOf(details: unknown): number | undefined {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return undefined;
  const value = (details as Record<string, unknown>)['retryAfterSeconds'];
  return typeof value === 'number' ? value : undefined;
}

/**
 * Filtre unique : toute erreur sort au format `{ error: { code, message, details?, requestId } }` (API.md §5.1).
 * Les 5xx sont journalisées avec la cause ; le client ne reçoit jamais de détail interne.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(GlobalExceptionFilter.name) private readonly logger: PinoLogger,
    @Inject(ERROR_REPORTER) private readonly reporter: ErrorReporter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const apiError = toApiError(exception);
    const requestId = typeof request.id === 'string' ? request.id : '';

    if (apiError.status >= 500) {
      this.logger.error({ err: exception, code: apiError.code, requestId }, 'request.failed');
      this.reporter.capture(exception, { requestId, code: apiError.code });
    }

    const error: ErrorResponse['error'] = {
      code: apiError.code,
      message: apiError.message,
      requestId,
      ...(apiError.details === undefined
        ? {}
        : { details: apiError.details as ErrorResponse['error']['details'] }),
    };
    const retryAfter = retryAfterOf(apiError.details);
    if (apiError.code === 'RATE_LIMITED' && retryAfter !== undefined) {
      response.setHeader('Retry-After', String(retryAfter));
    }
    response.status(apiError.status).json({ error });
  }
}
