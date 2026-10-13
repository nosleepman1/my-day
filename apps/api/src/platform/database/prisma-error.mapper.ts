import { Prisma } from '@prisma/client';

import type { ErrorCode } from '@orbit/contracts';

/**
 * Correspondances Prisma → codes d'API (API.md §5.3). Une FK composite violée signifie qu'une référence
 * pointe hors de l'espace de l'utilisateur : on répond NOT_FOUND, jamais un détail (ADR-007).
 * Base injoignable ou pool saturé : SERVICE_UNAVAILABLE plutôt qu'une erreur interne.
 */
const PRISMA_TO_API: Readonly<Record<string, ErrorCode>> = {
  P2002: 'CONFLICT',
  P2003: 'NOT_FOUND',
  P2025: 'NOT_FOUND',
  P2024: 'SERVICE_UNAVAILABLE',
};

/** Renvoie le code d'API d'une erreur Prisma, ou `undefined` si ce n'est pas une erreur Prisma. */
export function mapPrismaError(error: unknown): ErrorCode | undefined {
  if (error instanceof Prisma.PrismaClientInitializationError) return 'SERVICE_UNAVAILABLE';
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;
  return PRISMA_TO_API[error.code] ?? 'INTERNAL_ERROR';
}

/** Violation d'unicité (P2002), par exemple deux inscriptions simultanées sur la même adresse. */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
