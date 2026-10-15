import { isUniqueViolation } from '../../../platform/database/prisma-error.mapper';
import { DomainError } from '../../../platform/errors/domain-error';
import { defaultMessageOf } from '../../../platform/http/error-mapping';

export type CreateOnceResult<T> = Readonly<{ row: T; created: boolean }>;

/**
 * Création idempotente par identifiant client (ADR-016, file hors ligne) : si `clientId` existe déjà chez
 * cet utilisateur, l'élément existant est renvoyé. Un identifiant déjà pris par un autre utilisateur reste
 * invisible (lecture cloisonnée) et donne un 409 générique, sans rien révéler.
 */
export async function createOnce<T>(
  clientId: string | undefined,
  find: (id: string) => Promise<T | null>,
  create: () => Promise<T>,
): Promise<CreateOnceResult<T>> {
  if (clientId !== undefined) {
    const existing = await find(clientId);
    if (existing !== null) return { row: existing, created: false };
  }
  try {
    return { row: await create(), created: true };
  } catch (error) {
    if (clientId === undefined || !isUniqueViolation(error)) throw error;
    // Course entre deux rejeux du même élément : le gagnant est relu.
    const existing = await find(clientId);
    if (existing !== null) return { row: existing, created: false };
    throw new DomainError('CONFLICT', defaultMessageOf('CONFLICT'));
  }
}
