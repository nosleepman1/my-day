import { Injectable } from '@nestjs/common';

import type { LoginEventListResponse, PaginationQuery } from '@orbit/contracts';

import { DomainError } from '../../platform/errors/domain-error';
import { decodeCursor, encodeCursor } from '../../platform/http/cursor';
import { defaultMessageOf } from '../../platform/http/error-mapping';
import { ipPrefix } from '../../platform/http/ip-prefix';

import { type HistoryPosition, LoginHistoryRepository } from './login-history.repository';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function positionOf(cursor: string | undefined): HistoryPosition | null {
  if (cursor === undefined) return null;
  const [occurredAt = '', id = ''] = decodeCursor(cursor, 2);
  const instant = new Date(occurredAt);
  if (Number.isNaN(instant.getTime()) || !UUID.test(id)) {
    throw new DomainError('INVALID_CURSOR', defaultMessageOf('INVALID_CURSOR'));
  }
  return { occurredAt: instant, id };
}

/** `GET /me/login-events` : historique paginé par curseur, IP tronquée à l'affichage (§9.1). */
@Injectable()
export class LoginHistoryService {
  constructor(private readonly history: LoginHistoryRepository) {}

  async list(query: PaginationQuery): Promise<LoginEventListResponse> {
    const rows = await this.history.page(query.limit + 1, positionOf(query.cursor));
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return {
      data: page.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        failureCode: row.failureCode,
        occurredAt: row.occurredAt.toISOString(),
        ip: ipPrefix(row.ip),
        device: row.userAgentLabel,
      })),
      meta: {
        limit: query.limit,
        hasMore,
        nextCursor:
          hasMore && last !== undefined ? encodeCursor([last.occurredAt.toISOString(), last.id]) : null,
      },
    };
  }
}
