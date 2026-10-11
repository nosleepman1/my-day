import { Prisma } from '@prisma/client';

import type { ErrorCode } from '@orbit/contracts';

/**
 * Correspondances Prisma → codes d'API (API.md §5.3). Une FK composite violée signifie qu'une référence
 * pointe hors de l'espace de l'utilisateur : on répond NOT_FOUND, jamais un détail (ADR-007).
 */
const PRISMA_TO_API: Readonly<Record<string, ErrorCode>> = {
  P2002: 'CONFLICT',
  P2003: 'NOT_FOUND',
  P2025: 'NOT_FOUND',
};

/** Renvoie le code d'API d'une erreur Prisma connue, ou `undefined` si l'erreur n'est pas une erreur Prisma traitée. */
export function mapPrismaError(error: unknown): ErrorCode | undefined {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return PRISMA_TO_API[error.code] ?? 'INTERNAL_ERROR';
}
