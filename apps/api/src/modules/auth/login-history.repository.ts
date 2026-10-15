import { Inject, Injectable } from '@nestjs/common';

import { type ScopedPrismaClient, TENANT_PRISMA } from '../../platform/database/scoped-prisma';

export type LoginEventRow = Readonly<{
  id: string;
  eventType: string;
  failureCode: string | null;
  occurredAt: Date;
  ip: string | null;
  userAgentLabel: string | null;
}>;

export type HistoryPosition = Readonly<{ occurredAt: Date; id: string }>;

const LOGIN_EVENT_SELECT = {
  id: true,
  eventType: true,
  failureCode: true,
  occurredAt: true,
  ip: true,
  userAgentLabel: true,
} as const;

/** Historique `login_events` de l'utilisateur courant, par le client cloisonné (ADR-007-3). */
@Injectable()
export class LoginHistoryRepository {
  constructor(@Inject(TENANT_PRISMA) private readonly db: ScopedPrismaClient) {}

  /** Pagination par clé (occurred_at, id) décroissante ; `take` inclut la ligne sentinelle. */
  page(take: number, after: HistoryPosition | null): Promise<LoginEventRow[]> {
    return this.db.loginEvent.findMany({
      where:
        after === null
          ? {}
          : {
              OR: [
                { occurredAt: { lt: after.occurredAt } },
                { occurredAt: after.occurredAt, id: { lt: after.id } },
              ],
            },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take,
      select: LOGIN_EVENT_SELECT,
    });
  }
}
