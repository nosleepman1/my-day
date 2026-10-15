import { DomainError } from '../errors/domain-error';

import { defaultMessageOf } from './error-mapping';

/** Curseur opaque de pagination (API.md §7) : liste de chaînes encodée en base64url. */
export function encodeCursor(parts: readonly string[]): string {
  return Buffer.from(JSON.stringify(parts), 'utf8').toString('base64url');
}

/** @throws {DomainError} INVALID_CURSOR si le curseur n'est pas un tableau de `arity` chaînes. */
export function decodeCursor(cursor: string, arity: number): string[] {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (
      Array.isArray(parsed) &&
      parsed.length === arity &&
      parsed.every((part) => typeof part === 'string')
    ) {
      return parsed;
    }
  } catch {
    // Contenu illisible : même réponse qu'une forme inattendue.
  }
  throw new DomainError('INVALID_CURSOR', defaultMessageOf('INVALID_CURSOR'));
}
