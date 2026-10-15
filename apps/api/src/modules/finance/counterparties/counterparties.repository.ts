import { Injectable } from '@nestjs/common';
import type { Counterparty, CounterpartyKind, Prisma } from '@prisma/client';

import { DomainError } from '../../../platform/errors/domain-error';
import { decodeCursor, encodeCursor } from '../../../platform/http/cursor';
import { FinanceContext } from '../shared/finance-context';

export interface CreateCounterpartyDbInput {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly kind: CounterpartyKind;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly notes?: string | null;
}

export interface UpdateCounterpartyDbInput {
  readonly name?: string;
  readonly kind?: CounterpartyKind;
  readonly phone?: string | null;
  readonly email?: string | null;
  readonly notes?: string | null;
}

export interface ListCounterpartiesFilters {
  readonly kind?: CounterpartyKind;
  readonly search?: string;
  readonly includeArchived?: boolean;
  readonly limit: number;
  readonly cursor?: string;
}

export type CounterpartyWithCount = Counterparty & {
  readonly _count?: { readonly transactions: number };
};

export interface CounterpartyPage {
  readonly rows: readonly CounterpartyWithCount[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

@Injectable()
export class CounterpartiesRepository {
  constructor(private readonly ctx: FinanceContext) {}

  async create(data: CreateCounterpartyDbInput): Promise<CounterpartyWithCount> {
    return this.ctx.db.counterparty.create({
      data: {
        id: data.id,
        userId: data.userId,
        name: data.name,
        kind: data.kind,
        phone: data.phone ?? null,
        email: data.email ?? null,
        notes: data.notes ?? null,
      },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async findById(userId: string, id: string): Promise<CounterpartyWithCount | null> {
    return this.ctx.db.counterparty.findFirst({
      where: { userId, id },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async findByName(userId: string, name: string): Promise<Counterparty | null> {
    return this.ctx.db.counterparty.findFirst({
      where: {
        userId,
        name: { equals: name.trim(), mode: 'insensitive' },
      },
    });
  }

  async list(userId: string, filters: ListCounterpartiesFilters): Promise<CounterpartyPage> {
    const where: Prisma.CounterpartyWhereInput = {
      userId,
      ...(filters.includeArchived ? {} : { archivedAt: null }),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.search ? { name: { contains: filters.search.trim(), mode: 'insensitive' } } : {}),
    };

    const cursorFilter = this.buildCursorWhere(filters.cursor);
    const combinedWhere: Prisma.CounterpartyWhereInput = cursorFilter
      ? { AND: [where, cursorFilter] }
      : where;

    const items = await this.ctx.db.counterparty.findMany({
      where: combinedWhere,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: filters.limit + 1,
      include: { _count: { select: { transactions: true } } },
    });

    const hasMore = items.length > filters.limit;
    const pageRows = items.slice(0, filters.limit);
    const last = pageRows.at(-1);
    const nextCursor = hasMore && last ? encodeCursor(['name', last.name, last.id]) : null;

    return { rows: pageRows, hasMore, nextCursor };
  }

  private buildCursorWhere(cursor?: string): Prisma.CounterpartyWhereInput | null {
    if (!cursor) return null;
    const parts = decodeCursor(cursor, 3);
    if (parts[0] !== 'name') {
      throw new DomainError('INVALID_CURSOR', 'Curseur invalide.');
    }
    const [, cursorName = '', cursorId = ''] = parts;
    return {
      OR: [{ name: { gt: cursorName } }, { AND: [{ name: cursorName }, { id: { gt: cursorId } }] }],
    };
  }

  async update(userId: string, id: string, data: UpdateCounterpartyDbInput): Promise<CounterpartyWithCount> {
    return this.ctx.db.counterparty.update({
      where: { userId_id: { userId, id } },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.kind !== undefined ? { kind: data.kind } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async archive(userId: string, id: string, archivedAt: Date): Promise<CounterpartyWithCount> {
    return this.ctx.db.counterparty.update({
      where: { userId_id: { userId, id } },
      data: { archivedAt },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async unarchive(userId: string, id: string): Promise<CounterpartyWithCount> {
    return this.ctx.db.counterparty.update({
      where: { userId_id: { userId, id } },
      data: { archivedAt: null },
      include: { _count: { select: { transactions: true } } },
    });
  }

  async countTransactions(userId: string, id: string): Promise<number> {
    return this.ctx.db.transaction.count({
      where: { userId, counterpartyId: id },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.ctx.db.counterparty.delete({
      where: { userId_id: { userId, id } },
    });
  }

  async merge(userId: string, sourceId: string, targetId: string): Promise<void> {
    await this.ctx.db.$transaction(async (tx) => {
      await tx.transaction.updateMany({
        where: { userId, counterpartyId: sourceId },
        data: { counterpartyId: targetId },
      });

      await tx.noteLink.updateMany({
        where: { userId, counterpartyId: sourceId },
        data: { counterpartyId: targetId },
      });

      await tx.counterparty.delete({
        where: { userId_id: { userId, id: sourceId } },
      });
    });
  }
}
