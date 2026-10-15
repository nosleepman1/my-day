import type { Response } from 'express';

import { DomainError } from '../../../platform/errors/domain-error';
import { defaultMessageOf } from '../../../platform/http/error-mapping';

/** Concurrence optimiste (API.md §10) : `version` reflétée dans `ETag: W/"<version>"`. */

const IF_MATCH = /^(?:W\/)?"?([0-9]{1,9})"?$/;

/** Version attendue lue dans `If-Match` ; `undefined` si l'en-tête est absent ou vaut `*`. */
export function parseIfMatch(header: string | undefined): number | undefined {
  if (header === undefined || header.trim() === '*') return undefined;
  const match = IF_MATCH.exec(header.trim());
  if (match?.[1] === undefined) {
    throw new DomainError('VALIDATION_FAILED', defaultMessageOf('VALIDATION_FAILED'), [
      { path: ['If-Match'], code: 'invalid_format', message: 'En-tête If-Match invalide.' },
    ]);
  }
  return Number.parseInt(match[1], 10);
}

/** @throws {DomainError} PRECONDITION_REQUIRED si `If-Match` manque (notes, API.md §10). */
export function requireIfMatch(header: string | undefined): number {
  const version = parseIfMatch(header);
  if (version === undefined) {
    throw new DomainError('PRECONDITION_REQUIRED', defaultMessageOf('PRECONDITION_REQUIRED'));
  }
  return version;
}

export function setEtag(response: Response, version: number): void {
  response.setHeader('ETag', `W/"${version}"`);
}

export function versionConflict(currentVersion: number): DomainError {
  return new DomainError('VERSION_CONFLICT', defaultMessageOf('VERSION_CONFLICT'), { currentVersion });
}

export function notFound(): DomainError {
  return new DomainError('NOT_FOUND', defaultMessageOf('NOT_FOUND'));
}
