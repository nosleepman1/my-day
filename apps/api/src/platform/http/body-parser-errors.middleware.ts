import type { NextFunction, Request, Response } from 'express';

import { DomainError } from '../errors/domain-error';

import { bodyParserCode, defaultMessageOf } from './error-mapping';

/**
 * Middleware d erreur Express place juste apres body-parser. Nest convertit sinon toute SyntaxError de
 * body-parser en BadRequestException et perd la cause : on la traduit avant (INVALID_JSON, PAYLOAD_TOO_LARGE).
 */
export function translateBodyParserErrors(
  error: unknown,
  _request: Request,
  _response: Response,
  next: NextFunction,
): void {
  const code = bodyParserCode(error);
  next(code === undefined ? error : new DomainError(code, defaultMessageOf(code)));
}
