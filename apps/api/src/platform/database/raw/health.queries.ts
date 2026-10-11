import type { PrismaClient } from '@prisma/client';

/** Délai maximal de la sonde de disponibilité (INFRASTRUCTURE.md, healthchecks). */
export const DATABASE_PING_TIMEOUT_MS = 1_000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`database ping timed out after ${ms} ms`));
    }, ms).unref();
  });
}

/**
 * Vérifie que PostgreSQL répond (`SELECT 1`). Ce fichier est dans `raw/`, seul dossier autorisé pour le SQL brut (ADR-028).
 * @returns `true` si la base répond dans le délai ; sinon l'erreur est relancée à l'appelant.
 */
export async function pingDatabase(
  prisma: PrismaClient,
  timeoutMs = DATABASE_PING_TIMEOUT_MS,
): Promise<true> {
  await Promise.race([prisma.$queryRaw`SELECT 1`, timeout(timeoutMs)]);
  return true;
}
