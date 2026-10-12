import type { ErrorCode, FieldIssue } from '@orbit/contracts';

export type ErrorDetails = Readonly<Record<string, unknown>>;

/**
 * Erreur métier levée par les services (CODING_STANDARDS §6.2). Jamais `HttpException` dans un service :
 * le filtre global traduit `code` en statut HTTP (`@orbit/contracts`). Le message est destiné à l'utilisateur.
 */
export class DomainError extends Error {
  override readonly name = 'DomainError';

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: ErrorDetails | readonly FieldIssue[],
  ) {
    super(message);
  }
}
