import { HttpException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';

import { httpStatusOf, type ErrorCode, type FieldIssue } from '@orbit/contracts';

import { mapPrismaError } from '../database/prisma-error.mapper';
import { DomainError, type ErrorDetails } from '../errors/domain-error';

export type ApiError = Readonly<{
  status: number;
  code: ErrorCode;
  message: string;
  details?: readonly FieldIssue[] | ErrorDetails;
}>;

/** Messages par défaut, en français, sans aucun détail interne (API.md §5.1). */
const DEFAULT_MESSAGES: Partial<Record<ErrorCode, string>> = {
  VALIDATION_FAILED: 'La requête contient des champs invalides.',
  INVALID_CURSOR: 'Curseur de pagination invalide.',
  INVALID_JSON: 'Le corps de la requête est illisible.',
  UNAUTHENTICATED: 'Authentification requise.',
  NOT_FOUND: 'Ressource introuvable.',
  METHOD_NOT_ALLOWED: 'Méthode non autorisée.',
  CONFLICT: 'Cette valeur est déjà utilisée.',
  PAYLOAD_TOO_LARGE: 'La requête est trop volumineuse.',
  UNSUPPORTED_MEDIA_TYPE: 'Type de contenu non accepté.',
  RATE_LIMITED: 'Trop de requêtes. Réessayez plus tard.',
  SERVICE_UNAVAILABLE: 'Service momentanément indisponible.',
  INVALID_CREDENTIALS: 'Adresse e-mail ou mot de passe incorrect.',
  CSRF_REJECTED: 'Requête refusée.',
  REAUTH_REQUIRED: 'Confirmez votre mot de passe pour continuer.',
  REAUTH_FAILED: 'Mot de passe incorrect.',
  EMAIL_NOT_VERIFIED: "Votre adresse e-mail n'est pas encore vérifiée.",
  GONE: 'Ce lien ou cette ressource a expiré.',
  VERSION_CONFLICT: 'La ressource a été modifiée entre-temps.',
  PRECONDITION_REQUIRED: 'Version de la ressource requise.',
  BUSINESS_RULE_VIOLATION: 'Cette opération est refusée.',
  UPSTREAM_ERROR: 'Un service externe est en erreur.',
  UPSTREAM_TIMEOUT: 'Un service externe ne répond pas.',
};

/**
 * Statuts des exceptions du framework (routes inconnues, guards…) → codes d'API.
 * 403 devient NOT_FOUND : une route ou une ressource interdite ne confirme jamais son existence (SECURITY.md §6.2).
 */
const HTTP_STATUS_TO_CODE: Readonly<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'NOT_FOUND',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  410: 'GONE',
  412: 'VERSION_CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'BUSINESS_RULE_VIOLATION',
  428: 'PRECONDITION_REQUIRED',
  429: 'RATE_LIMITED',
  502: 'UPSTREAM_ERROR',
  503: 'SERVICE_UNAVAILABLE',
  504: 'UPSTREAM_TIMEOUT',
};

/** Erreurs émises par body-parser (Express) avant le routage. */
const BODY_PARSER_TO_CODE: Readonly<Record<string, ErrorCode>> = {
  'entity.parse.failed': 'INVALID_JSON',
  'entity.too.large': 'PAYLOAD_TOO_LARGE',
};

const INTERNAL_MESSAGE = 'Une erreur inattendue est survenue.';

function fromCode(code: ErrorCode, details?: ApiError['details']): ApiError {
  const message = DEFAULT_MESSAGES[code] ?? INTERNAL_MESSAGE;
  return details === undefined
    ? { status: httpStatusOf(code), code, message }
    : { status: httpStatusOf(code), code, message, details };
}

function toFieldIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => (typeof segment === 'number' ? segment : String(segment))),
    code: issue.code,
    message: issue.message,
  }));
}

export function bodyParserCode(error: unknown): ErrorCode | undefined {
  if (typeof error !== 'object' || error === null || !('type' in error)) return undefined;
  const { type } = error;
  return typeof type === 'string' ? BODY_PARSER_TO_CODE[type] : undefined;
}

/**
 * Traduit n'importe quelle exception en erreur d'API stable (API.md §5). Fonction pure, testée unitairement.
 * Toute erreur inconnue devient INTERNAL_ERROR, sans fuite de message, de SQL ou de pile.
 */
export function toApiError(exception: unknown): ApiError {
  if (exception instanceof DomainError) {
    const base = { status: httpStatusOf(exception.code), code: exception.code, message: exception.message };
    return exception.details === undefined ? base : { ...base, details: exception.details };
  }
  if (exception instanceof ZodValidationException) {
    return fromCode('VALIDATION_FAILED', toFieldIssues(exception.getZodError() as ZodError));
  }
  const parserCode = bodyParserCode(exception);
  if (parserCode !== undefined) return fromCode(parserCode);
  const prismaCode = mapPrismaError(exception);
  if (prismaCode !== undefined) return fromCode(prismaCode);
  if (exception instanceof HttpException) {
    return fromCode(HTTP_STATUS_TO_CODE[exception.getStatus()] ?? 'INTERNAL_ERROR');
  }
  return fromCode('INTERNAL_ERROR');
}

/** Message utilisateur par defaut associe a un code. */
export function defaultMessageOf(code: ErrorCode): string {
  return fromCode(code).message;
}
