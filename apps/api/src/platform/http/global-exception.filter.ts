import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

import type { ErrorResponse } from '@orbit/contracts';

import { toApiError } from './error-mapping';

type RequestWithId = Request & { id?: unknown };

/**
 * Filtre unique : toute erreur sort au format `{ error: { code, message, details?, requestId } }` (API.md §5.1).
 * Les 5xx sont journalisées avec la cause ; le client ne reçoit jamais de détail interne.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(GlobalExceptionFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const apiError = toApiError(exception);
    const requestId = typeof request.id === 'string' ? request.id : '';

    if (apiError.status >= 500) {
      this.logger.error({ err: exception, code: apiError.code, requestId }, 'request.failed');
    }

    const error: ErrorResponse['error'] = {
      code: apiError.code,
      message: apiError.message,
      requestId,
      ...(apiError.details === undefined
        ? {}
        : { details: apiError.details as ErrorResponse['error']['details'] }),
    };
    response.status(apiError.status).json({ error });
  }
}
