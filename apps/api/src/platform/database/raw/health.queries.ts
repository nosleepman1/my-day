import type { PrismaClient } from '@prisma/client';

/** Délai maximal de la sonde de disponibilité (INFRASTRUCTURE.md, healthchecks). */
export const DATABASE_PING_TIMEOUT_MS = 1_000;

/**
 * Vérifie que PostgreSQL répond (`SELECT 1`). Ce fichier est dans `raw/`, seul dossier autorisé pour le SQL brut (ADR-028).
 * @returns `true` si la base répond dans le délai ; sinon l'erreur (échec ou délai dépassé) est relancée à l'appelant.
 */
export async function pingDatabase(
  prisma: PrismaClient,
  timeoutMs = DATABASE_PING_TIMEOUT_MS,
): Promise<true> {
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`database ping timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    timer.unref();
  });
  const query = Promise.resolve(prisma.$queryRaw`SELECT 1`);
  // Si le délai l'emporte, la requête peut encore échouer plus tard : son rejet est absorbé ici, déjà signalé par le délai.
  void query.catch(() => undefined);
  try {
    await Promise.race([query, deadline]);
  } finally {
    clearTimeout(timer);
  }
  return true;
}
